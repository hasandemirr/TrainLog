// domain/types.ts — şema v2 (D13-D22). Saf tipler; import yok (D7).
// Normatif eskiz ARCHITECTURE §3'te; gerekçeler DECISIONS'ta (madde numaralarıyla).
import type { ExerciseId, ISODate, ProgramId, RecordKey, RunId, SessionId } from './ids';

export type ExerciseKind = 'bar' | 'db' | 'mac' | 'time';

export interface Exercise {
  id: ExerciseId;
  name: string;
  kind: ExerciseKind;
  zone: string;
  inc: number;
  media?: string;
  archived?: true;
  userModified?: true; // D39
}

export interface Prescribed {
  exId: ExerciseId;
  sets: number;
  lo: number;
  hi: number;
  rir?: [number, number];
  rest: number;
}

export interface ProgramDay {
  dayId: string;
  label?: string; // D44: "Gün 1" + isteğe bağlı etiket
  items: Prescribed[];
}

export interface Program {
  id: ProgramId;
  familyId: string; // D15: sürüm zinciri
  rev: number;
  name: string;
  userModified?: true;
  days: ProgramDay[];
}

export interface Run {
  id: RunId;
  familyId: string;
  currentProgId: ProgramId;
  startDate: ISODate;
  endedAt?: ISODate; // yoksa AKTİF koşu (en fazla bir tane). Salt-eklemeli → v:2 kalır.
}

export interface Session {
  id: SessionId;
  date: ISODate;
  runId: RunId;
  progId: ProgramId; // açıldığı andaki somut sürüm (D15)
  dayId: string;
  week: number; // D16: beyan edilen konum
  finishedAt?: number; // D46
}

export interface SetEntry {
  kg: number | null;
  reps: number | null; // time türünde saniye
}

export interface ExRecord {
  exId: ExerciseId; // ikame = farklı exId (D47)
  sets: SetEntry[];
  rir?: number;
  note?: string;
  updatedAt: number; // birleştirme anahtarı (D27)
}

export interface Meta {
  deviceId: string;
  rev: number;
  updatedAt: number;
  lastBackup: number; // D12, D29
}

/** Kişisel bilgiler (F4.5) — ASGARİ ve tamamı isteğe bağlı; yalnızca cihazda durur,
 *  yedeğe girer, hiçbir yere gönderilmez. Salt-eklemeli alan → şema v:2 kalır (S5 kuralı). */
export interface Profile {
  name?: string;
  birthYear?: number;
  heightCm?: number;
  updatedAt: number; // birleştirme anahtarı (LWW) — D27
}

export interface Timer {
  tEnd: number; // D42: mutlak bitiş
  label: string;
}

export type MeasureRow = Partial<Record<string, number | string>>;

export interface AppState {
  v: 2;
  meta: Meta;
  catalog: {
    exercises: Record<ExerciseId, Exercise>;
    programs: Record<ProgramId, Program>;
  };
  runs: Record<RunId, Run>;
  sessions: Record<SessionId, Session>;
  records: Record<RecordKey, ExRecord>;
  measures: Record<ISODate, MeasureRow>;
  timer?: Timer;
  profile?: Profile; // F4.5 — asgari kişisel bilgiler
}
