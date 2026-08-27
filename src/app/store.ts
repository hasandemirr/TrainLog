// app/store.ts — tek-yönlü akışlı store (D6): dispatch → saf reduce → SENKRON persist
// (D24) → çiz. Ayrıca boş yükleme (S1) + tohum ekimi (D39).
import type { StoragePort } from './ports';
import type { AppState, Exercise } from '../domain/types';
import type { ExerciseId, ISODate, IdGen } from '../domain/ids';
import { asRunId } from '../domain/ids';
import { isAppState } from '../domain/validate';
import { emptyState } from '../domain/state';
import { closeStale } from '../domain/session';
import { openRun } from '../domain/program';
import type { SeedCatalog } from '../domain/migrate';
import { reduce } from './actions';
import type { Action } from './actions';

export interface StoreDeps {
  now: number; // epoch ms — meta/kayıt updatedAt
  today: ISODate; // yerel gün (D22) — koşu startDate, seans tarihi edge'de yakalanır
  deviceId: string;
  idgen: IdGen;
}

export interface Store {
  getState(): AppState;
  dispatch(action: Action): void;
  /** Tüm durumu değiştir (yedek geri yükleme, "tümünü sil") — persist + çiz. */
  replace(next: AppState): void;
  subscribe(listener: () => void): () => void;
}

export function createStore(initial: AppState, storage: StoragePort): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      state = reduce(state, action); // saf geçiş
      storage.save(JSON.stringify(state)); // D24: her aksiyonda SENKRON persist
      listeners.forEach((l) => l()); // çiz
    },
    replace(next) {
      state = next;
      storage.save(JSON.stringify(state)); // senkron persist
      listeners.forEach((l) => l()); // çiz
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Boş yük atılıp taze başlanır (S1); geçerli v2 aynen döner. Göç değil (D20). */
export function loadOrInit(storage: StoragePort, deps: { now: number; deviceId: string }): AppState {
  const raw = storage.load();
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isAppState(parsed)) return parsed;
    } catch {
      /* bozuk JSON → taze */
    }
  }
  const fresh = emptyState(deps);
  storage.save(JSON.stringify(fresh)); // iskelet/bozuk anahtarı geçerli v2 ile ez
  return fresh;
}

/**
 * Tohum ekimi (D39): yeni girdileri ekler; userModified olmayanları tohumla değiştirir
 * (alan-düzeyi birleştirme yok); userModified'a dokunmaz. Koşu yoksa tohum programı için
 * bir koşu açar (startDate = bugün, yerel).
 */
export function sow(state: AppState, seed: SeedCatalog, deps: { today: ISODate; idgen: IdGen }): AppState {
  const exercises: Record<ExerciseId, Exercise> = { ...state.catalog.exercises };
  for (const ex of Object.values(seed.exercises)) {
    const cur = exercises[ex.id];
    if (!cur || !cur.userModified) exercises[ex.id] = ex;
  }

  const programs = { ...state.catalog.programs };
  const p = seed.program;
  const curP = programs[p.id];
  if (!curP || !curP.userModified) programs[p.id] = p;

  const withCatalog: AppState = { ...state, catalog: { exercises, programs } };

  // Koşu yoksa tohum programı için AÇ — startRun ile AYNI genel yol (openRun);
  // ekim koşusuna özel-durum kodu yok (devir maddesi).
  const hasRun = Object.values(state.runs).some((r) => r.familyId === p.familyId);
  if (hasRun) return withCatalog;
  const run = { id: asRunId(deps.idgen()), familyId: p.familyId, currentProgId: p.id, startDate: deps.today };
  return openRun(withCatalog, run, deps.today);
}

/**
 * "Tüm verileri sil" (F4.6) sonrası TAZE durum — kurulum yolundan farklı bir yol
 * YOKTUR: boş-geçerli v2 + ekim (sow), yani ilk açılışın aynısı. Silme yalnızca
 * uygulama VERİSİNE dokunur; SW önbelleğine dokunmaz (D36 — önbellek temizliği
 * veriye dokunmaz, tersi de geçerli).
 */
export function freshState(seed: SeedCatalog, deps: StoreDeps): AppState {
  return sow(emptyState(deps), seed, deps);
}

/** Yükle → ek → kalıcılaştır. main.ts bunu çağırıp createStore'a verir. */
export function initState(storage: StoragePort, seed: SeedCatalog, deps: StoreDeps): AppState {
  const loaded = loadOrInit(storage, deps);
  const sown = sow(loaded, seed, deps);
  const closed = closeStale(sown, deps.today, deps.now); // D46: ileri tarihte açılış
  storage.save(JSON.stringify(closed)); // ekim + oto-kapanış kalıcı
  return closed;
}
