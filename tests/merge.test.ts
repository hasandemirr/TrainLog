import { describe, expect, it } from 'vitest';
import { merge } from '../src/domain/merge';
import type { AppState } from '../src/domain/types';
import { exercise, makeState, record, rkey } from './fixtures/build';

const A = makeState({
  deviceId: 'A',
  rev: 2,
  updatedAt: 10,
  lastBackup: 5,
  exercises: [exercise('e1'), exercise('e2')],
  records: {
    [rkey('2026-08-01', 1, 0)]: record('e1', [[60, 8]], 1),
    [rkey('2026-08-01', 1, 1)]: record('e2', [[40, 10]], 3),
  },
});

const B = makeState({
  deviceId: 'B',
  rev: 1,
  updatedAt: 20,
  lastBackup: 9,
  exercises: [exercise('e2'), exercise('e3')],
  records: {
    [rkey('2026-08-01', 1, 0)]: record('e1', [], 2), // aynı anahtar, boşaltılmış, daha yeni
    [rkey('2026-08-03', 1, 0)]: record('e3', [[50, 5]], 1),
  },
});

const noDevice = (s: AppState): AppState => ({ ...s, meta: { ...s.meta, deviceId: '_' } });

describe('merge', () => {
  it('idempotent: merge(a, a) === a', () => {
    expect(merge(A, A)).toEqual(A);
  });

  it('sıra bağımsız — deviceId hariç (o kimliktir)', () => {
    expect(noDevice(merge(A, B))).toEqual(noDevice(merge(B, A)));
  });

  it('kayıt LWW: yeni updatedAt kazanır ve boşaltma dirilmez (D27)', () => {
    const m = merge(A, B);
    expect(m.records[rkey('2026-08-01', 1, 0)]).toEqual(record('e1', [], 2));
    expect(m.records[rkey('2026-08-01', 1, 1)]).toEqual(record('e2', [[40, 10]], 3));
    expect(m.records[rkey('2026-08-03', 1, 0)]).toEqual(record('e3', [[50, 5]], 1));
  });

  it('meta: rev/updatedAt/lastBackup = max; deviceId = base', () => {
    expect(merge(A, B).meta).toEqual({ deviceId: 'A', rev: 2, updatedAt: 20, lastBackup: 9 });
  });

  it('katalog anahtar bazında birleşir (union)', () => {
    expect(Object.keys(merge(A, B).catalog.exercises).sort()).toEqual(['e1', 'e2', 'e3']);
  });
});
