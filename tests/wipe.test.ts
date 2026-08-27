import { describe, expect, it } from 'vitest';
import { createStore, freshState, initState } from '../src/app/store';
import { reduce } from '../src/app/actions';
import { isAppState } from '../src/domain/validate';
import { createSession } from '../src/domain/session';
import { asExerciseId } from '../src/domain/ids';
import { activeRun, programOf } from '../src/app/selectors';
import type { StoragePort } from '../src/app/ports';
import type { AppState } from '../src/domain/types';
import { SEED } from '../src/content/seed';

/** Bellek içi StoragePort — clear() dahil (adapters/storage.local'ın sözleşmesi). */
function memStorage(): StoragePort & { raw: () => string | null } {
  let value: string | null = null;
  return {
    load: () => value,
    save: (r) => {
      value = r;
    },
    clear: () => {
      value = null;
    },
    raw: () => value,
  };
}

const deps = { now: 1000, today: '2026-08-27', deviceId: 'dev-1', idgen: () => 'id-1' };

/** Dolu bir durum: seans + kayıt + ölçüm + profil + sayaç. */
function filled(state: AppState): AppState {
  const run = activeRun(state)!;
  const program = programOf(state, run)!;
  const session = createSession({
    date: '2026-08-27',
    seq: 1,
    runId: run.id,
    progId: program.id,
    dayId: 'Gün 1',
    week: 1,
  });
  const at = { session, slot: 0, exId: asExerciseId('ex_barbell_row'), targetSets: 3 };
  let s = reduce(state, { type: 'setSet', at, setIdx: 0, patch: { kg: 60 }, updatedAt: 2000 });
  s = reduce(s, { type: 'setMeasure', date: '2026-08-27', field: 'kilo', value: 78.5, updatedAt: 2000 });
  s = reduce(s, { type: 'setProfile', patch: { name: 'Metha' }, updatedAt: 2000 });
  s = reduce(s, { type: 'startTimer', tEnd: 9_999_999, label: 'Barbell Row', updatedAt: 2000 });
  s = reduce(s, { type: 'markBackup', at: 2000 });
  return s;
}

describe('freshState — "tüm verileri sil" sonrası taze durum (F4.6)', () => {
  it('ilk açılışla AYNI yolu kullanır (emptyState + sow), özel-durum kodu yok', () => {
    const storage = memStorage();
    const viaInit = initState(storage, SEED, deps);
    expect(freshState(SEED, deps)).toEqual(viaInit);
  });

  it('veri gider, katalog ve aktif koşu ilk açılıştaki gibi gelir', () => {
    const fresh = freshState(SEED, deps);
    expect(Object.keys(fresh.sessions)).toEqual([]);
    expect(Object.keys(fresh.records)).toEqual([]);
    expect(Object.keys(fresh.measures)).toEqual([]);
    expect(fresh.profile).toBeUndefined();
    expect(fresh.timer).toBeUndefined();
    expect(fresh.meta.lastBackup).toBe(0);
    expect(Object.keys(fresh.catalog.exercises).length).toBe(22);
    expect(activeRun(fresh)?.endedAt).toBeUndefined();
    expect(isAppState(fresh)).toBe(true);
  });

  it('silme yolu (clear + replace) dolu durumu taze duruma indirir ve KALICILAŞTIRIR', () => {
    const storage = memStorage();
    const store = createStore(filled(initState(storage, SEED, deps)), storage);
    store.dispatch({ type: 'markBackup', at: 3000 }); // dolu durum diske yazılsın
    expect(storage.raw()).toContain('"kilo"');

    // main.ts'in wipeAll'ı: önce anahtarı temizle, sonra taze durumu yaz
    storage.clear();
    expect(storage.raw()).toBeNull();
    store.replace(freshState(SEED, deps));

    const persisted = JSON.parse(storage.raw() as string) as unknown;
    expect(isAppState(persisted)).toBe(true);
    expect(store.getState().records).toEqual({});
    expect(store.getState().profile).toBeUndefined();
    expect(JSON.stringify(persisted)).not.toContain('Metha');
  });

  it('silme sonrası uygulama yeniden açılırsa taze durum korunur (yeniden ekim çift yaratmaz)', () => {
    const storage = memStorage();
    storage.save(JSON.stringify(freshState(SEED, deps)));
    const reopened = initState(storage, SEED, { ...deps, now: 5000, today: '2026-08-28' });
    expect(Object.keys(reopened.runs).length).toBe(1);
    expect(Object.keys(reopened.records)).toEqual([]);
  });
});
