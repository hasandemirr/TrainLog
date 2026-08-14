import { describe, expect, it } from 'vitest';
import { migrateV1 } from '../src/domain/migrate';
import type { SeedCatalog, V1Backup } from '../src/domain/migrate';
import { asExerciseId, asProgramId, sessionId } from '../src/domain/ids';
import type { ExerciseId } from '../src/domain/ids';
import type { Exercise, Prescribed, Program } from '../src/domain/types';
import { isAppState } from '../src/domain/validate';
import { exercise, rkey } from './fixtures/build';

// --- sentetik tohum (D49) ---
const exArr: Exercise[] = [
  exercise('ex-row', { name: 'Barbell Row', kind: 'bar', inc: 2.5, zone: 'back' }),
  exercise('ex-pull', { name: 'Lat Pulldown', kind: 'mac', inc: 2.5, zone: 'back' }),
  exercise('ex-squat', { name: 'Squat', kind: 'bar', inc: 5, zone: 'leg' }),
  exercise('ex-plank', { name: 'Plank', kind: 'time', inc: 0, zone: 'core' }),
  exercise('ex-press', { name: 'DB Press', kind: 'db', inc: 2.5, zone: 'chest' }),
];
const exMap: Record<ExerciseId, Exercise> = {};
for (const e of exArr) exMap[e.id] = e;

const item = (exId: string, over: Partial<Prescribed> = {}): Prescribed => ({
  exId: asExerciseId(exId),
  sets: 3,
  lo: 6,
  hi: 8,
  rest: 90,
  ...over,
});

const program: Program = {
  id: asProgramId('prog-1'),
  familyId: 'fam-1',
  rev: 1,
  name: 'Program',
  days: [
    { dayId: 'd1', label: 'Pull', items: [item('ex-row'), item('ex-pull')] },
    { dayId: 'd2', label: 'Home 1', items: [item('ex-plank')] },
    { dayId: 'd3', label: 'Leg', items: [item('ex-squat')] },
    { dayId: 'd4', label: 'Home 2', items: [item('ex-press')] },
    { dayId: 'd5', label: 'Push', items: [item('ex-press')] },
  ],
};
const seed: SeedCatalog = { exercises: exMap, program };

// --- sentetik v1 yedeği ---
const v1: V1Backup = {
  v: 1,
  week: 3,
  day: 'Pull',
  lastBackup: 1723600000000,
  logs: {
    'w1|Pull': {
      date: '2026-08-01',
      ex: {
        'Barbell Row': { sets: [[60, 8], [60, 7], [null, null]], rir: '2', note: '' },
        'Lat Pulldown': { sets: [[40, 10]], rir: '1,5', note: 'ok' },
        'Face Pull': { sets: [[20, 15]], rir: '', note: '' }, // eşleşmeyen ad
      },
    },
    'w1|Home 1': { date: '', ex: { Plank: { sets: [[null, 30], [null, 35]], rir: '', note: '' } } },
    'w2|Pull': { date: '2026-08-08', ex: { 'Barbell Row': { sets: [[62.5, 8]], rir: '2', note: '' } } },
    'w1|Leg': { date: '2026-08-01', ex: { Squat: { sets: [[80, 5]], rir: '3', note: '' } } },
  },
  measures: [
    { date: '2026-08-01', kilo: 78.5, bel: null, note: '' },
    { date: '2026-08-01', kilo: 78.2, bel: 80, note: 'sabah' }, // aynı tarih → son geçerli
    { date: '2026-08-08', kilo: 78.0 },
  ],
};

const NOW = 1_700_000_000_000;
let n = 0;
const result = migrateV1(v1, seed, { now: NOW, idgen: () => `gen-${n++}` });

describe('migrateV1', () => {
  it('sonuç geçerli v2 (integration)', () => {
    expect(isAppState(result)).toBe(true);
  });

  it('tek koşu; startDate = en erken dolu log tarihi', () => {
    const runs = Object.values(result.runs);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ startDate: '2026-08-01', familyId: 'fam-1', currentProgId: asProgramId('prog-1') });
  });

  it('eşleşmeyen ad → yeni mac/2.5/"" hareket', () => {
    const fp = Object.values(result.catalog.exercises).find((e) => e.name === 'Face Pull');
    expect(fp).toMatchObject({ kind: 'mac', inc: 2.5, zone: '' });
  });

  it('aynı tarih çakışması: Pull #1, Leg #2 (hafta, günSırası)', () => {
    expect(result.sessions[sessionId('2026-08-01', 1)]).toMatchObject({ dayId: 'd1', week: 1 });
    expect(result.sessions[sessionId('2026-08-01', 2)]).toMatchObject({ dayId: 'd3', week: 1 });
  });

  it('boş tarih sentezi: Home 1 → startDate + 1 gün', () => {
    expect(result.sessions[sessionId('2026-08-02', 1)]).toMatchObject({ dayId: 'd2', week: 1 });
  });

  it('slot eşleme + trailing [null,null] kırpma + rir; note "" atılır', () => {
    expect(result.records[rkey('2026-08-01', 1, 0)]).toEqual({
      exId: asExerciseId('ex-row'),
      sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 7 }],
      rir: 2,
      updatedAt: NOW,
    });
    expect(result.records[rkey('2026-08-01', 1, 1)]).toEqual({
      exId: asExerciseId('ex-pull'),
      sets: [{ kg: 40, reps: 10 }],
      rir: 1.5,
      note: 'ok',
      updatedAt: NOW,
    });
  });

  it('program-dışı hareket serbest slota; rir bozuk/boş → yok', () => {
    const fp = Object.values(result.catalog.exercises).find((e) => e.name === 'Face Pull')!;
    expect(result.records[rkey('2026-08-01', 1, 2)]).toEqual({
      exId: fp.id,
      sets: [{ kg: 20, reps: 15 }],
      updatedAt: NOW,
    });
  });

  it('time türü setleri korunur (kg=null, reps=saniye)', () => {
    expect(result.records[rkey('2026-08-02', 1, 0)]).toEqual({
      exId: asExerciseId('ex-plank'),
      sets: [{ kg: null, reps: 30 }, { kg: null, reps: 35 }],
      updatedAt: NOW,
    });
  });

  it('measures tarih haritası; aynı tarihte son kayıt; null/boş atılır', () => {
    expect(result.measures['2026-08-01']).toEqual({ kilo: 78.2, bel: 80, note: 'sabah' });
    expect(result.measures['2026-08-08']).toEqual({ kilo: 78.0 });
  });

  it('meta taze: rev 1, updatedAt now, lastBackup taşınır', () => {
    expect(result.meta).toMatchObject({ rev: 1, updatedAt: NOW, lastBackup: 1723600000000 });
    expect(typeof result.meta.deviceId).toBe('string');
  });
});
