import { describe, expect, it } from 'vitest';
import {
  DB_STEP_LIMIT,
  TIME_INCREMENT_SEC,
  VOLUME_DROP_RATIO,
  isDrop,
  progressionHint,
  sessionDropSummary,
  setVolume,
} from '../src/domain/progression';
import type { Prescribed } from '../src/domain/types';
import { asExerciseId } from '../src/domain/ids';
import { exercise, record } from './fixtures/build';

const presc = (over: Partial<Prescribed> = {}): Prescribed => ({
  exId: asExerciseId('e1'),
  sets: 3,
  lo: 6,
  hi: 8,
  rest: 90,
  ...over,
});

describe('sabitler pinlenir', () => {
  it('0.97 / 0.10 / +10sn', () => {
    expect(VOLUME_DROP_RATIO).toBe(0.97);
    expect(DB_STEP_LIMIT).toBe(0.1);
    expect(TIME_INCREMENT_SEC).toBe(10);
  });
});

describe('setVolume', () => {
  it('dolu setlerin Σ(kg×tekrar); null setler yok sayılır', () => {
    expect(setVolume([{ kg: 60, reps: 8 }, { kg: 60, reps: 7 }, { kg: null, reps: null }])).toBe(900);
  });
  it('time türü (kg=null) → hacim 0', () => {
    expect(setVolume([{ kg: null, reps: 30 }])).toBe(0);
  });
});

describe('progressionHint', () => {
  const bar = exercise('e1', { kind: 'bar', inc: 2.5 });

  it('set eksik → hold sets-incomplete', () => {
    expect(progressionHint(presc(), bar, record('e1', [[60, 8], [60, 8]], 1))).toEqual({
      kind: 'hold',
      reason: 'sets-incomplete',
    });
  });

  it('tekrar üst sınır altında → hold reps-below-top', () => {
    expect(progressionHint(presc(), bar, record('e1', [[60, 8], [60, 8], [60, 7]], 1))).toEqual({
      kind: 'hold',
      reason: 'reps-below-top',
    });
  });

  it('RIR alt sınırın altında → hold rir-not-maintained', () => {
    const p = presc({ rir: [1, 3] });
    const r = record('e1', [[60, 8], [60, 8], [60, 8]], 1, { rir: 0 });
    expect(progressionHint(p, bar, r)).toEqual({ kind: 'hold', reason: 'rir-not-maintained' });
  });

  it('normal bar, hepsi üst sınır → increase kg (inc)', () => {
    expect(progressionHint(presc(), bar, record('e1', [[60, 8], [60, 8], [60, 8]], 1))).toEqual({
      kind: 'increase',
      unit: 'kg',
      amount: 2.5,
    });
  });

  it('time → increase sec +10', () => {
    const t = exercise('e1', { kind: 'time', inc: 0 });
    const r = record('e1', [[null, 30], [null, 31], [null, 30]], 1);
    expect(progressionHint(presc({ hi: 30 }), t, r)).toEqual({ kind: 'increase', unit: 'sec', amount: 10 });
  });

  it('db kademe %10 aşıyor → hold db-step-too-big', () => {
    const db = exercise('e1', { kind: 'db', inc: 2.5 }); // 2.5/20 = 0.125 > 0.10
    expect(progressionHint(presc(), db, record('e1', [[20, 8], [20, 8], [20, 8]], 1))).toEqual({
      kind: 'hold',
      reason: 'db-step-too-big',
    });
  });

  it('db kademe %10 altında → increase kg', () => {
    const db = exercise('e1', { kind: 'db', inc: 2.5 }); // 2.5/30 = 0.083 < 0.10
    expect(progressionHint(presc(), db, record('e1', [[30, 8], [30, 8], [30, 8]], 1))).toEqual({
      kind: 'increase',
      unit: 'kg',
      amount: 2.5,
    });
  });
});

describe('isDrop', () => {
  const bar = exercise('e1', { kind: 'bar' });

  it('hacim önceki × 0.97 altına düşerse drop', () => {
    const prev = record('e1', [[60, 8], [60, 8], [60, 8]], 1); // 1440
    expect(isDrop(record('e1', [[60, 8], [60, 8], [50, 8]], 2), prev, bar)).toBe(true); // 1360
    expect(isDrop(record('e1', [[60, 8], [60, 8], [55, 8]], 2), prev, bar)).toBe(false); // 1400
  });

  it('hacim bilinmiyorsa (tekrar boş) ilk-set kg düşüşü', () => {
    const prev = record('e1', [[60, null]], 1); // vol 0, ilk kg 60
    expect(isDrop(record('e1', [[55, null]], 2), prev, bar)).toBe(true);
    expect(isDrop(record('e1', [[65, null]], 2), prev, bar)).toBe(false);
  });
});

describe('sessionDropSummary', () => {
  it('>1 düşüş → uyarı; ardışık seans → set −1', () => {
    expect(sessionDropSummary(2, false)).toEqual({ warn: true, reduceSet: false });
    expect(sessionDropSummary(1, true)).toEqual({ warn: false, reduceSet: true });
    expect(sessionDropSummary(0, true)).toEqual({ warn: false, reduceSet: false });
  });
});
