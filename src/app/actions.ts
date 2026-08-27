// app/actions.ts — aksiyonlar + saf indirgeyici (D6). Zaman/kimlik payload'da gelir
// (edge'de yakalanır); reduce saftır. Kayıtlar tembel doğar; seans ilk kayıtla doğar
// (D17) — tarih at.session'da açılışta sabittir, reduce "şimdi" kullanmaz.
import { recordKey } from '../domain/ids';
import type { ExerciseId, ISODate, RecordKey, RunId, SessionId } from '../domain/ids';
import { openRun } from '../domain/program';
import type { AppState, ExRecord, Exercise, Profile, Program, Run, Session, SetEntry } from '../domain/types';

/** Bir kaydın yeri + tembel doğum için gereken bilgi. */
export interface RecordAt {
  session: Session; // hedef seans; yoksa doğar (D17)
  slot: number;
  exId: ExerciseId;
  targetSets: number; // yeni kayıt bu boyutta doğar (prescribed set sayısı)
}

export type Action =
  // patch tek alan (kg VEYA reps) — reduce CANLI kayda uygular; aynı tuşta iki
  // commit birbirini ezmez (dispatch senkron, ikinci canlı state'i görür).
  | { type: 'setSet'; at: RecordAt; setIdx: number; patch: Partial<SetEntry>; updatedAt: number }
  | { type: 'addSet'; at: RecordAt; updatedAt: number }
  | { type: 'setRir'; at: RecordAt; rir: number | null; updatedAt: number }
  | { type: 'setNote'; at: RecordAt; note: string; updatedAt: number }
  | { type: 'takePrevious'; at: RecordAt; sets: SetEntry[]; updatedAt: number }
  | { type: 'finish'; sessionId: SessionId; finishedAt: number }
  // Sayaç: mutlak tEnd (D42) AppState'te tutulur — D8 istisnası (yeniden kurulamayan
  // geçici gerçek; bellekten atılma sonrası ancak depodan döner).
  | { type: 'startTimer'; tEnd: number; label: string; updatedAt: number }
  | { type: 'clearTimer'; updatedAt: number }
  // İkame (D47): yalnızca o seanslık — kayıttaki exId değişir, program sürümüne
  // DOKUNULMAZ. Yeni hareket kataloğa kullanıcı içeriği olarak girer (userModified).
  | { type: 'substitute'; at: RecordAt; newExId: ExerciseId; updatedAt: number }
  | { type: 'addExercise'; exercise: Exercise; updatedAt: number }
  | { type: 'markBackup'; at: number } // yedek alındı → meta.lastBackup (D29)
  // Kişisel bilgiler (F4.5): asgari, hepsi isteğe bağlı; null → alanı sil, hepsi
  // boşalırsa profil düşer. Yalnızca cihazda; yedeğe girer, hiçbir yere gönderilmez.
  | { type: 'setProfile'; patch: ProfilePatch; updatedAt: number }
  // Ölçüm (F2.4): measures tarih anahtarlı; aynı tarihe alan yazımı son-yazan-kazanır.
  | { type: 'setMeasure'; date: ISODate; field: string; value: number | string | null; updatedAt: number }
  // Program yönetimi (F3, S5)
  | { type: 'startRun'; program?: Program; run: Run; today: ISODate; updatedAt: number } // yeni koşu (mevcutu kapatır)
  | { type: 'saveProgramVersion'; program: Program; runId: RunId; updatedAt: number } // düzenleme = yeni sürüm + işaretçi (D15)
  | { type: 'archiveExercise'; exId: ExerciseId; updatedAt: number }; // silme yok; arşivle

export type ProfilePatch = Partial<{ name: string | null; birthYear: number | null; heightCm: number | null }>;

/** Profil alanlarını yamala; null → alanı düşür. Boşalırsa undefined döner. */
function patchProfile(cur: Profile | undefined, patch: ProfilePatch, updatedAt: number): Profile | undefined {
  const next: Profile = { ...(cur ?? {}), updatedAt };
  for (const key of ['name', 'birthYear', 'heightCm'] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === null) delete next[key];
    else Object.assign(next, { [key]: v });
  }
  const filled = next.name !== undefined || next.birthYear !== undefined || next.heightCm !== undefined;
  return filled ? next : undefined;
}

const emptySet = (): SetEntry => ({ kg: null, reps: null });
const emptySets = (n: number): SetEntry[] => Array.from({ length: n }, emptySet);

function ensureRecord(
  records: Record<RecordKey, ExRecord>,
  key: RecordKey,
  at: RecordAt,
  updatedAt: number,
): ExRecord {
  return records[key] ?? { exId: at.exId, sets: emptySets(at.targetSets), updatedAt };
}

/** rir/note'u koruyarak yeniden kur; null → alanı düşür. */
function rebuild(cur: ExRecord, updatedAt: number, ch: { rir?: number | null; note?: string | null }): ExRecord {
  const rir = ch.rir !== undefined ? ch.rir : cur.rir ?? null;
  const note = ch.note !== undefined ? ch.note : cur.note ?? null;
  const rec: ExRecord = { exId: cur.exId, sets: cur.sets, updatedAt };
  if (rir !== null) rec.rir = rir;
  if (note !== null) rec.note = note;
  return rec;
}

export function reduce(state: AppState, action: Action): AppState {
  if (action.type === 'finish') {
    const s = state.sessions[action.sessionId];
    if (!s) return state;
    return {
      ...state,
      sessions: { ...state.sessions, [action.sessionId]: { ...s, finishedAt: action.finishedAt } },
      meta: { ...state.meta, updatedAt: action.finishedAt },
    };
  }

  if (action.type === 'startTimer') {
    return {
      ...state,
      timer: { tEnd: action.tEnd, label: action.label },
      meta: { ...state.meta, updatedAt: action.updatedAt },
    };
  }

  if (action.type === 'clearTimer') {
    if (state.timer === undefined) return state;
    const next: AppState = { ...state, meta: { ...state.meta, updatedAt: action.updatedAt } };
    delete next.timer;
    return next;
  }

  if (action.type === 'markBackup') {
    return { ...state, meta: { ...state.meta, lastBackup: action.at, updatedAt: action.at } };
  }

  if (action.type === 'setProfile') {
    const profile = patchProfile(state.profile, action.patch, action.updatedAt);
    const next: AppState = { ...state, meta: { ...state.meta, updatedAt: action.updatedAt } };
    if (profile === undefined) delete next.profile;
    else next.profile = profile;
    return next;
  }

  if (action.type === 'setMeasure') {
    const row = { ...(state.measures[action.date] ?? {}) };
    if (action.value === null) delete row[action.field];
    else row[action.field] = action.value;
    const measures = { ...state.measures };
    if (Object.keys(row).length === 0) delete measures[action.date];
    else measures[action.date] = row;
    return { ...state, measures, meta: { ...state.meta, updatedAt: action.updatedAt } };
  }

  if (action.type === 'startRun') {
    let s = state;
    if (action.program) {
      s = { ...s, catalog: { ...s.catalog, programs: { ...s.catalog.programs, [action.program.id]: action.program } } };
    }
    const opened = openRun(s, action.run, action.today); // mevcut aktif koşuyu kapatır
    return { ...opened, meta: { ...opened.meta, updatedAt: action.updatedAt } };
  }

  if (action.type === 'saveProgramVersion') {
    const run = state.runs[action.runId];
    const runs = run
      ? { ...state.runs, [action.runId]: { ...run, currentProgId: action.program.id } }
      : state.runs;
    return {
      ...state,
      catalog: { ...state.catalog, programs: { ...state.catalog.programs, [action.program.id]: action.program } },
      runs,
      meta: { ...state.meta, updatedAt: action.updatedAt },
    };
  }

  if (action.type === 'archiveExercise') {
    const ex = state.catalog.exercises[action.exId];
    if (ex === undefined) return state;
    return {
      ...state,
      catalog: {
        ...state.catalog,
        exercises: { ...state.catalog.exercises, [action.exId]: { ...ex, archived: true, userModified: true } },
      },
      meta: { ...state.meta, updatedAt: action.updatedAt },
    };
  }

  if (action.type === 'addExercise') {
    return {
      ...state,
      catalog: {
        ...state.catalog,
        exercises: { ...state.catalog.exercises, [action.exercise.id]: action.exercise },
      },
      meta: { ...state.meta, updatedAt: action.updatedAt },
    };
  }

  const { at, updatedAt } = action;
  const key = recordKey(at.session.id, at.slot);

  // Seans doğumu (D17): hedef yoksa ekle. Yeni seans açılınca aynı koşunun diğer
  // bitmemiş seansları otomatik kapanır (D46: "yeni seans açıldığında").
  let sessions = state.sessions;
  if (!state.sessions[at.session.id]) {
    sessions = { ...state.sessions };
    for (const s of Object.values(sessions)) {
      if (s.runId === at.session.runId && s.finishedAt === undefined) {
        sessions[s.id] = { ...s, finishedAt: updatedAt };
      }
    }
    sessions[at.session.id] = at.session;
  }

  const cur = ensureRecord(state.records, key, at, updatedAt);
  const commit = (rec: ExRecord): AppState => ({
    ...state,
    sessions,
    records: { ...state.records, [key]: rec },
    meta: { ...state.meta, updatedAt },
  });

  switch (action.type) {
    case 'setSet': {
      const sets = cur.sets.slice();
      while (sets.length <= action.setIdx) sets.push(emptySet());
      sets[action.setIdx] = { ...(sets[action.setIdx] ?? emptySet()), ...action.patch };
      return commit({ ...cur, sets, updatedAt });
    }
    case 'addSet':
      return commit({ ...cur, sets: [...cur.sets, emptySet()], updatedAt });
    case 'setRir':
      return commit(rebuild(cur, updatedAt, { rir: action.rir }));
    case 'setNote':
      return commit(rebuild(cur, updatedAt, { note: action.note.length > 0 ? action.note : null }));
    case 'takePrevious':
      return commit({ ...cur, sets: action.sets.map((s) => ({ ...s })), updatedAt });
    case 'substitute':
      // Yalnız bu slotta hareketi değiştir; taze kayıt (program sürümü değişmez, D47)
      return commit({ exId: action.newExId, sets: emptySets(at.targetSets), updatedAt });
  }
}
