// domain/progression.ts — hacim, artır/beklet ipucu, düşüş tespiti (F1.5).
// Prototipte doğrulanmış ürün politikası; saf; import yok. "Beklet" gerekçeleri
// dil-bağımsız KOD döner (Türkçe metin UI'da; D8/D48).
import type { Exercise, ExerciseKind, ExRecord, Prescribed, SetEntry } from './types';

export const VOLUME_DROP_RATIO = 0.97; // güncel < önceki × 0.97 → düşüş
export const DB_STEP_LIMIT = 0.1; // db: inc/kg bunu aşarsa beklet
export const TIME_INCREMENT_SEC = 10; // time: üst sınır + bu

export type HoldReason =
  | 'sets-incomplete'
  | 'reps-below-top'
  | 'rir-not-maintained'
  | 'db-step-too-big';

export type Advice =
  | { kind: 'increase'; unit: 'kg' | 'sec'; amount: number }
  | { kind: 'hold'; reason: HoldReason };

function isFilled(s: SetEntry, kind: ExerciseKind): boolean {
  return kind === 'time' ? s.reps !== null : s.kg !== null && s.reps !== null;
}

/** Σ(kg×tekrar) — yalnızca kg ve tekrar dolu setler; time türünde hacim yok. */
export function setVolume(sets: SetEntry[]): number {
  let v = 0;
  for (const s of sets) if (s.kg !== null && s.reps !== null) v += s.kg * s.reps;
  return v;
}

function firstFilledKg(sets: SetEntry[]): number | null {
  for (const s of sets) if (s.kg !== null) return s.kg;
  return null;
}

/** Artır mı beklet mi — koşullar spec sırasıyla. */
export function progressionHint(p: Prescribed, ex: Exercise, rec: ExRecord): Advice {
  const filled = rec.sets.filter((s) => isFilled(s, ex.kind));
  if (filled.length < p.sets) return { kind: 'hold', reason: 'sets-incomplete' };

  const topN = filled.slice(0, p.sets);
  if (!topN.every((s) => s.reps !== null && s.reps >= p.hi)) {
    return { kind: 'hold', reason: 'reps-below-top' };
  }

  if (p.rir && rec.rir !== undefined && rec.rir < p.rir[0]) {
    return { kind: 'hold', reason: 'rir-not-maintained' };
  }

  if (ex.kind === 'time') return { kind: 'increase', unit: 'sec', amount: TIME_INCREMENT_SEC };

  if (ex.kind === 'db') {
    const kg = firstFilledKg(rec.sets);
    if (kg !== null && kg > 0 && ex.inc / kg > DB_STEP_LIMIT) {
      return { kind: 'hold', reason: 'db-step-too-big' };
    }
  }

  return { kind: 'increase', unit: 'kg', amount: ex.inc };
}

function volumeKnown(rec: ExRecord, ex: Exercise): boolean {
  return ex.kind !== 'time' && setVolume(rec.sets) > 0;
}

/** Aynı exId'nin önceki kaydına karşı düşüş. */
export function isDrop(current: ExRecord, previous: ExRecord, ex: Exercise): boolean {
  if (volumeKnown(current, ex) && volumeKnown(previous, ex)) {
    return setVolume(current.sets) < setVolume(previous.sets) * VOLUME_DROP_RATIO;
  }
  const cur = firstFilledKg(current.sets);
  const prev = firstFilledKg(previous.sets);
  if (cur !== null && prev !== null) return cur < prev;
  return false;
}

/** Seans düzeyi: >1 düşüş → uyarı; iki ardışık seansta düşüş → "set −1" (yalnız metin). */
export function sessionDropSummary(
  dropCount: number,
  prevSessionHadDrops: boolean,
): { warn: boolean; reduceSet: boolean } {
  return { warn: dropCount > 1, reduceSet: dropCount > 0 && prevSessionHadDrops };
}
