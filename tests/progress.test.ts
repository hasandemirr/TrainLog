import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/state';
import { sow } from '../src/app/store';
import { reduce } from '../src/app/actions';
import { createSession } from '../src/domain/session';
import {
  exerciseSeries,
  generalStats,
  measureFields,
  measureSeries,
  sessionsByDate,
  trackedExercises,
} from '../src/app/selectors';
import { asExerciseId } from '../src/domain/ids';
import type { Session } from '../src/domain/types';
import { SEED } from '../src/content/seed';

const rowId = asExerciseId('ex_barbell_row');

function base() {
  const s = sow(emptyState({ now: 0, deviceId: 'd' }), SEED, { today: '2026-08-01', idgen: () => 'run_seed' });
  const run = Object.values(s.runs)[0]!;
  const prog = s.catalog.programs[run.currentProgId]!;
  const mk = (date: string, seq: number, day: string, week: number) =>
    createSession({ date, seq, runId: run.id, progId: prog.id, dayId: day, week });
  return { s, mk };
}

function logRow(state: ReturnType<typeof base>['s'], session: Session, sets: [number, number][], updatedAt: number) {
  let st = state;
  sets.forEach(([kg, reps], i) => {
    st = reduce(st, { type: 'setSet', at: { session, slot: 0, exId: rowId, targetSets: 3 }, setIdx: i, patch: { kg, reps }, updatedAt });
  });
  return st;
}

describe('ilerleme selectors (F2, D8)', () => {
  it('exerciseSeries tarihe göre sıralı; topKg + volume', () => {
    const { s, mk } = base();
    let st = logRow(s, mk('2026-08-08', 1, 'Gün 1', 2), [[62.5, 8], [62.5, 8]], 2);
    st = logRow(st, mk('2026-08-01', 1, 'Gün 1', 1), [[60, 8], [60, 8]], 1);
    const series = exerciseSeries(st, rowId);
    expect(series.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-08']);
    expect(series[0]).toMatchObject({ topKg: 60, volume: 960 });
    expect(series[1]).toMatchObject({ topKg: 62.5, volume: 1000 });
  });

  it('trackedExercises + generalStats', () => {
    const { s, mk } = base();
    const st = logRow(s, mk('2026-08-01', 1, 'Gün 1', 1), [[60, 8]], 1);
    expect(trackedExercises(st).map((e) => e.id)).toEqual([rowId]);
    expect(generalStats(st)).toMatchObject({ sessions: 1, records: 1, totalVolume: 480, exercisesTracked: 1 });
  });

  it('setMeasure LWW + measureSeries/Fields (F2.4)', () => {
    const { s } = base();
    let st = reduce(s, { type: 'setMeasure', date: '2026-08-01', field: 'kilo', value: 78.5, updatedAt: 1 });
    st = reduce(st, { type: 'setMeasure', date: '2026-08-01', field: 'kilo', value: 78.2, updatedAt: 2 });
    st = reduce(st, { type: 'setMeasure', date: '2026-08-08', field: 'kilo', value: 77.9, updatedAt: 3 });
    expect(measureFields(st)).toEqual(['kilo']);
    expect(measureSeries(st, 'kilo')).toEqual([
      { date: '2026-08-01', value: 78.2 },
      { date: '2026-08-08', value: 77.9 },
    ]);
  });

  it('setMeasure null → alanı siler; boş satır → tarihi siler', () => {
    const { s } = base();
    let st = reduce(s, { type: 'setMeasure', date: '2026-08-01', field: 'kilo', value: 78, updatedAt: 1 });
    st = reduce(st, { type: 'setMeasure', date: '2026-08-01', field: 'kilo', value: null, updatedAt: 2 });
    expect(st.measures['2026-08-01']).toBeUndefined();
  });

  it('sessionsByDate indeksler', () => {
    const { s, mk } = base();
    const st = logRow(s, mk('2026-08-01', 1, 'Gün 1', 1), [[60, 8]], 1);
    expect(Object.keys(sessionsByDate(st))).toEqual(['2026-08-01']);
  });
});
