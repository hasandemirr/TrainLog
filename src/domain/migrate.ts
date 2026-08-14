// domain/migrate.ts — v1 (prototip yedeği) → v2 göçü (D20/D38). Saf; import yok.
// D20: v1 YALNIZCA içe alma yolunda tanınır; kanonik anahtar asla buradan okunmaz.
// Tohum kataloğu enjekte edilir (v1 program tanımını içermez; kind/inc/zone tohumdan).
// now/idgen enjekte — determinizm. Tarih aritmetiği UTC (belirlenimci).
import { asExerciseId, asRunId, recordKey, sessionId } from './ids';
import type { ExerciseId, IdGen, ISODate, RecordKey, SessionId } from './ids';
import type {
  AppState,
  ExRecord,
  Exercise,
  MeasureRow,
  Meta,
  Prescribed,
  Program,
  Run,
  Session,
  SetEntry,
} from './types';

export interface SeedCatalog {
  exercises: Record<ExerciseId, Exercise>;
  program: Program; // aktif program: gün sırası + her günün slot sırası
}

export type V1Set = [number | null, number | null];
export interface V1ExEntry {
  sets: V1Set[];
  rir?: string;
  note?: string;
}
export interface V1Log {
  date: string; // BOŞ STRING OLABİLİR
  ex: Record<string, V1ExEntry>;
}
export interface V1Measure {
  date: string;
  [field: string]: number | string | null;
}
export interface V1Backup {
  v: 1;
  week?: number;
  day?: string;
  lastBackup?: number;
  logs: Record<string, V1Log>;
  measures?: V1Measure[];
}

const CANONICAL_DAYS = ['Pull', 'Home 1', 'Leg', 'Home 2', 'Push'];

function isoFromEpoch(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}
function isoAddDays(iso: ISODate, days: number): ISODate {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseRir(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number.parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function toSetEntries(v1sets: V1Set[]): SetEntry[] {
  const out: SetEntry[] = v1sets.map(([kg, reps]) => ({ kg: kg ?? null, reps: reps ?? null }));
  while (out.length > 0) {
    const last = out[out.length - 1]!;
    if (last.kg === null && last.reps === null) out.pop();
    else break;
  }
  return out;
}

export function migrateV1(v1: V1Backup, seed: SeedCatalog, deps: { now: number; idgen: IdGen }): AppState {
  const { now, idgen } = deps;
  const prog = seed.program;

  // Katalog tohumdan başlar; eşleşmeyen adlar için savunma amaçlı hareket eklenir.
  const exercises: Record<ExerciseId, Exercise> = { ...seed.exercises };
  const nameToEx = new Map<string, ExerciseId>();
  for (const ex of Object.values(seed.exercises)) nameToEx.set(ex.name, ex.id);
  const resolveExId = (name: string): ExerciseId => {
    const hit = nameToEx.get(name);
    if (hit) return hit;
    const id = asExerciseId(idgen());
    exercises[id] = { id, name, kind: 'mac', zone: '', inc: 2.5 }; // savunma (spec)
    nameToEx.set(name, id);
    return id;
  };

  const dayInfo = (dayName: string): { dayId: string; dayOrder: number; items: Prescribed[] } => {
    let idx = prog.days.findIndex((d) => d.label === dayName);
    if (idx < 0) idx = CANONICAL_DAYS.indexOf(dayName);
    if (idx >= 0 && idx < prog.days.length) {
      const d = prog.days[idx]!;
      return { dayId: d.dayId, dayOrder: idx, items: d.items };
    }
    return { dayId: dayName, dayOrder: prog.days.length, items: [] }; // bilinmeyen → serbest
  };

  const logs = v1.logs ?? {};
  const logDates = Object.values(logs)
    .map((l) => l.date)
    .filter((d) => d.length > 0);
  const startDate: ISODate = logDates.length > 0 ? logDates.reduce((a, b) => (a < b ? a : b)) : isoFromEpoch(now);

  const runId = asRunId(idgen());
  const run: Run = { id: runId, familyId: prog.familyId, currentProgId: prog.id, startDate };

  interface Pending {
    week: number;
    dayOrder: number;
    dayId: string;
    items: Prescribed[];
    date: ISODate;
    ex: Record<string, V1ExEntry>;
  }
  const pendings: Pending[] = [];
  for (const [key, log] of Object.entries(logs)) {
    const bar = key.indexOf('|');
    const week = Number(key.slice(1, bar)); // "w{W}"
    const { dayId, dayOrder, items } = dayInfo(key.slice(bar + 1));
    const date = log.date.length > 0 ? log.date : isoAddDays(startDate, (week - 1) * 7 + dayOrder);
    pendings.push({ week, dayOrder, dayId, items, date, ex: log.ex });
  }

  // Aynı tarihe düşenler: (hafta, günSırası) sırasıyla #1, #2 … (D17)
  const byDate = new Map<string, Pending[]>();
  for (const p of pendings) {
    const arr = byDate.get(p.date);
    if (arr) arr.push(p);
    else byDate.set(p.date, [p]);
  }

  const sessions: Record<SessionId, Session> = {};
  const records: Record<RecordKey, ExRecord> = {};
  for (const [date, group] of byDate) {
    group.sort((a, b) => a.week - b.week || a.dayOrder - b.dayOrder);
    group.forEach((p, i) => {
      const sid = sessionId(date, i + 1);
      sessions[sid] = { id: sid, date, runId, progId: prog.id, dayId: p.dayId, week: p.week };
      let free = p.items.length;
      for (const [name, entry] of Object.entries(p.ex)) {
        const exId = resolveExId(name);
        let slot = p.items.findIndex((it) => it.exId === exId);
        if (slot < 0) slot = free++;
        const rir = parseRir(entry.rir);
        const note = entry.note !== undefined && entry.note.length > 0 ? entry.note : undefined;
        records[recordKey(sid, slot)] = {
          exId,
          sets: toSetEntries(entry.sets),
          updatedAt: now,
          ...(rir !== undefined ? { rir } : {}),
          ...(note !== undefined ? { note } : {}),
        };
      }
    });
  }

  // measures dizisi → tarih haritası; aynı tarihte son kayıt geçerli; null/boş atılır.
  const measures: Record<ISODate, MeasureRow> = {};
  for (const m of v1.measures ?? []) {
    if (!m.date) continue;
    const row: MeasureRow = {};
    for (const [k, val] of Object.entries(m)) {
      if (k === 'date' || val === null) continue;
      if (typeof val === 'number') row[k] = val;
      else if (typeof val === 'string' && val.length > 0) row[k] = val;
    }
    measures[m.date] = row;
  }

  const meta: Meta = { deviceId: idgen(), rev: 1, updatedAt: now, lastBackup: v1.lastBackup ?? 0 };

  return {
    v: 2,
    meta,
    catalog: { exercises, programs: { [prog.id]: prog } },
    runs: { [runId]: run },
    sessions,
    records,
    measures,
  };
}
