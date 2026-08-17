import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import type { RecordAt } from '../src/app/actions';
import { createSession } from '../src/domain/session';
import { activeRun, exerciseCard, lastRecordForExercise, resolveSession, workoutModel } from '../src/app/selectors';
import { asExerciseId } from '../src/domain/ids';
import type { SetEntry } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const rowId = asExerciseId('ex_barbell_row');
const seeded = () => sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_main' });

function logSets(state: ReturnType<typeof seeded>, at: RecordAt, entries: SetEntry[], updatedAt: number) {
  let s = state;
  entries.forEach((entry, setIdx) => {
    s = reduce(s, { type: 'setSet', at, setIdx, patch: entry, updatedAt });
  });
  return s;
}

describe('selectors', () => {
  it('activeRun tohum koşusunu döner', () => {
    expect(activeRun(seeded())?.familyId).toBe('fam_main');
  });

  it('workoutModel boş → Gün 1 önerisi; kartlar prescribed sırasında', () => {
    const m = workoutModel(seeded(), { today: '2026-08-01' });
    expect(m.suggestion.dayId).toBe('Gün 1');
    expect(m.day?.dayId).toBe('Gün 1');
    expect(m.cards).toHaveLength(6);
    expect(m.cards[0]?.exercise.name).toBe('Barbell Row');
    expect(m.cards[0]?.current).toBeNull();
  });

  it('ilk kayıt → seans doğar; sonraki öneri Gün 2 (D17, D44)', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const prog = s.catalog.programs[run.currentProgId]!;
    const session = resolveSession(s, run, prog, '2026-08-01', 'Gün 1', 1);
    s = reduce(s, { type: 'setSet', at: { session, slot: 0, exId: rowId, targetSets: 3 }, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(workoutModel(s, { today: '2026-08-02' }).suggestion.dayId).toBe('Gün 2');
  });

  it('bugün açık seans varsa o güne devam eder (reload UX)', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const prog = s.catalog.programs[run.currentProgId]!;
    const session = resolveSession(s, run, prog, '2026-08-01', 'Gün 1', 1);
    s = reduce(s, { type: 'setSet', at: { session, slot: 0, exId: rowId, targetSets: 3 }, setIdx: 0, patch: { kg: 60, reps: 8 }, updatedAt: 1 });
    const m = workoutModel(s, { today: '2026-08-01' }); // aynı gün tekrar açılış
    expect(m.day?.dayId).toBe('Gün 1');
    expect(m.cards[0]?.current?.sets[0]).toEqual({ kg: 60, reps: 8 });
  });

  it('lastRecordForExercise: önceki dolu kaydı bulur', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const prog = s.catalog.programs[run.currentProgId]!;
    const past = createSession({ date: '2026-07-25', seq: 1, runId: run.id, progId: prog.id, dayId: 'Gün 1', week: 1 });
    s = logSets(s, { session: past, slot: 0, exId: rowId, targetSets: 3 }, [{ kg: 62.5, reps: 8 }], 1);
    const last = lastRecordForExercise(s, rowId);
    expect(last?.record.sets[0]).toEqual({ kg: 62.5, reps: 8 });
    expect(last?.session.date).toBe('2026-07-25');
  });

  it('exerciseCard: geçen seans + düşüş + artır ipucu türetir', () => {
    let s = seeded();
    const run = activeRun(s)!;
    const prog = s.catalog.programs[run.currentProgId]!;
    const past = createSession({ date: '2026-07-25', seq: 1, runId: run.id, progId: prog.id, dayId: 'Gün 1', week: 1 });
    s = logSets(s, { session: past, slot: 0, exId: rowId, targetSets: 3 }, [
      { kg: 60, reps: 8 }, { kg: 60, reps: 8 }, { kg: 60, reps: 8 },
    ], 1); // hacim 1440
    const today = createSession({ date: '2026-08-01', seq: 1, runId: run.id, progId: prog.id, dayId: 'Gün 1', week: 1 });
    s = logSets(s, { session: today, slot: 0, exId: rowId, targetSets: 3 }, [
      { kg: 50, reps: 8 }, { kg: 50, reps: 8 }, { kg: 50, reps: 8 },
    ], 2); // hacim 1200 < 1440×0.97 → düşüş
    const card = exerciseCard(s, today, 0, prog.days[0]!.items[0]!)!;
    expect(card.last?.session.date).toBe('2026-07-25');
    expect(card.drop).toBe(true);
    expect(card.hint?.kind).toBe('increase'); // set/tekrar üst → kg+inc
  });
});
