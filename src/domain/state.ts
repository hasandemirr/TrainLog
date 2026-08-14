// domain/state.ts — boş-geçerli v2 durum üreteci. Saf; zaman/kimlik enjekte edilir.
// S1 başlangıcı budur (tohum S2'de gelir).
import type { AppState } from './types';

export interface InitDeps {
  now: number;
  deviceId: string;
}

export function emptyState({ now, deviceId }: InitDeps): AppState {
  return {
    v: 2,
    meta: { deviceId, rev: 1, updatedAt: now, lastBackup: 0 },
    catalog: { exercises: {}, programs: {} },
    runs: {},
    sessions: {},
    records: {},
    measures: {},
  };
}
