// ui/format.ts — sayı biçimleme (D22: virgüllü ondalık kabul + gösterim).

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
