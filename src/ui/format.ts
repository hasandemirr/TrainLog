// ui/format.ts — sayı biçimleme (D22: virgüllü ondalık kabul + gösterim).
import type { SetEntry } from '../domain/types';

/** Ham metni sayıya çevirir; virgül kabul; boş/bozuk → null. */
export function parseNum(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Sayıyı Türkçe gösterime (virgül) çevirir; null → boş. */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n).replace('.', ',');
}

/** Set dizisini "60×8, 60×7" / "30 sn" özetine çevirir (boş setler atlanır). */
export function setsSummary(sets: SetEntry[]): string {
  const parts = sets
    .filter((s) => s.reps !== null)
    .map((s) => (s.kg !== null ? `${fmtNum(s.kg)}×${s.reps}` : `${s.reps} sn`));
  return parts.length > 0 ? parts.join(', ') : '—';
}
