import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import type { RecordAt } from '../src/app/actions';
import { closeStale, createSession } from '../src/domain/session';
import { activeRun, sessionSummary, workoutModel } from '../src/app/selectors';
import { asExerciseId } from '../src/domain/ids';
import { SEED } from '../src/content/seed';

const rowId = asExerciseId('ex_barbell_row');

function withRun() {
  const s = sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_seed' });
  const run = activeRun(s)!;
  const prog = s.catalog.programs[run.currentProgId]!;
  const mk = (date: string, seq: number, dayId: string, week: number) =>
    createSession({ date, seq, runId: run.id, progId: prog.id, dayId, week });
  const setSet = (state: typeof s, session: ReturnType<typeof mk>, at: Omit<RecordAt, 'session'>, setIdx: number, patch: { kg?: number | null; reps?: number | null }, updatedAt: number) =>
    reduce(state, { type: 'setSet', at: { session, ...at }, setIdx, patch, updatedAt });
  return { s, mk, setSet };
}

describe('D46 tamamlama + oto-kapanış', () => {
  it('finish seansı finishedAt ile kapatır; öneri ilerler', () => {
    const { s, mk, setSet } = withRun();
    const sess = mk('2026-08-01', 1, 'Gün 1', 1);
    let st = setSet(s, sess, { slot: 0, exId: rowId, targetSets: 3 }, 0, { kg: 60, reps: 8 }, 1);
    st = reduce(st, { type: 'finish', sessionId: sess.id, finishedAt: 999 });
    expect(st.sessions[sess.id]?.finishedAt).toBe(999);
    expect(workoutModel(st, { today: '2026-08-01' }).suggestion.dayId).toBe('Gün 2');
  });

  it('yeni seans açılınca önceki bitmemiş oto-kapanır (D46)', () => {
    const { s, mk, setSet } = withRun();
    const d1 = mk('2026-08-01', 1, 'Gün 1', 1);
    let st = setSet(s, d1, { slot: 0, exId: rowId, targetSets: 3 }, 0, { kg: 60, reps: 8 }, 1);
    const d2 = mk('2026-08-01', 2, 'Gün 2', 1);
    st = setSet(st, d2, { slot: 0, exId: asExerciseId('ex_lateral_raise_db'), targetSets: 4 }, 0, { reps: 15 }, 2);
    expect(st.sessions[d1.id]?.finishedAt).toBe(2);
    expect(st.sessions[d2.id]?.finishedAt).toBeUndefined();
  });

  it('closeStale: ileri tarihte açılış geçmiş bitmemişi kapatır (D46)', () => {
    const { s, mk, setSet } = withRun();
    const past = mk('2026-07-30', 1, 'Gün 1', 1);
    let st = setSet(s, past, { slot: 0, exId: rowId, targetSets: 3 }, 0, { kg: 60, reps: 8 }, 1);
    st = closeStale(st, '2026-08-01', 5000);
    expect(st.sessions[past.id]?.finishedAt).toBe(5000);
  });

  it('closeStale bugünkü açık seansa dokunmaz', () => {
    const { s, mk, setSet } = withRun();
    const today = mk('2026-08-01', 1, 'Gün 1', 1);
    let st = setSet(s, today, { slot: 0, exId: rowId, targetSets: 3 }, 0, { kg: 60, reps: 8 }, 1);
    st = closeStale(st, '2026-08-01', 5000);
    expect(st.sessions[today.id]?.finishedAt).toBeUndefined();
  });

  it('sessionSummary: hacim + set toplamı türetir, boşları atlar (D8)', () => {
    const { s, mk, setSet } = withRun();
    const sess = mk('2026-08-01', 1, 'Gün 1', 1);
    let st = setSet(s, sess, { slot: 0, exId: rowId, targetSets: 3 }, 0, { kg: 60, reps: 8 }, 1);
    st = setSet(st, sess, { slot: 0, exId: rowId, targetSets: 3 }, 1, { kg: 60, reps: 8 }, 1);
    const sum = sessionSummary(st, st.sessions[sess.id]!);
    expect(sum.dayLabel).toBe('Pull');
    expect(sum.entries).toHaveLength(1);
    expect(sum.entries[0]?.volume).toBe(960);
    expect(sum.totalSets).toBe(2);
  });
});
