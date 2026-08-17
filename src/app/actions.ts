// app/actions.ts — aksiyonlar + saf indirgeyici (D6). Zaman/kimlik payload'da gelir
// (edge'de yakalanır); reduce saftır. Kayıtlar tembel doğar; seans ilk kayıtla doğar
// (D17) — tarih at.session'da açılışta sabittir, reduce "şimdi" kullanmaz.
import { recordKey } from '../domain/ids';
import type { ExerciseId, RecordKey, SessionId } from '../domain/ids';
import type { AppState, ExRecord, Session, SetEntry } from '../domain/types';

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
  | { type: 'finish'; sessionId: SessionId; finishedAt: number };

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
  }
}
