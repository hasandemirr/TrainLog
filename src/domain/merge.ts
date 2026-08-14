// domain/merge.ts — durum birleştirme (D27). Saf; import yok.
// Müşteri: yedek geri yükleme (bugün) + senkron (ileride).
// Kurallar: kayıtlar updatedAt son-yazan-kazanır; diğer koleksiyonlar anahtar
// bazında birleşir, çakışmada belirlenimci (kararlı seri) seçim. Sonuç idempotent
// ve DATA açısından sıra bağımsızdır. meta.deviceId kimliktir → yerel (base) korunur;
// bu tek asimetridir (rev/lastBackup/updatedAt = max, dolayısıyla simetrik).
import type { AppState } from './types';

function sortDeep(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x !== null && typeof x === 'object') {
    const src = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortDeep(src[k]);
    return out;
  }
  return x;
}
const stable = (x: unknown): string => JSON.stringify(sortDeep(x));

/** Belirlenimci simetrik seçim: kararlı serisi büyük olan (eşitse aynı içerik). */
const byStable = <T>(x: T, y: T): T => (stable(x) >= stable(y) ? x : y);

/** Son-yazan-kazanır; eşit updatedAt'te kararlı seriyle çözülür (simetri). */
const lww = <T extends { updatedAt: number }>(x: T, y: T): T =>
  x.updatedAt > y.updatedAt ? x : y.updatedAt > x.updatedAt ? y : byStable(x, y);

function mergeMap<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  pick: (x: T, y: T) => T,
): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const k of Object.keys(b)) {
    const bv = b[k] as T;
    const av = out[k];
    out[k] = av === undefined ? bv : pick(av, bv);
  }
  return out;
}

export function merge(base: AppState, incoming: AppState): AppState {
  return {
    v: 2,
    meta: {
      deviceId: base.meta.deviceId, // kimlik: yerel korunur (tek asimetri)
      rev: Math.max(base.meta.rev, incoming.meta.rev),
      updatedAt: Math.max(base.meta.updatedAt, incoming.meta.updatedAt),
      lastBackup: Math.max(base.meta.lastBackup, incoming.meta.lastBackup),
    },
    catalog: {
      exercises: mergeMap(base.catalog.exercises, incoming.catalog.exercises, byStable),
      programs: mergeMap(base.catalog.programs, incoming.catalog.programs, byStable),
    },
    runs: mergeMap(base.runs, incoming.runs, byStable),
    sessions: mergeMap(base.sessions, incoming.sessions, byStable),
    records: mergeMap(base.records, incoming.records, lww),
    measures: mergeMap(base.measures, incoming.measures, byStable),
    ...(base.timer !== undefined ? { timer: base.timer } : {}),
  };
}
