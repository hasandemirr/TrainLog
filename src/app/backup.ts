// app/backup.ts — yedek içe alma (D27). Geri yükleme EZME değil BİRLEŞTİRME:
// domain/merge.ts'in ikinci müşterisi burada bağlanır. v1 yalnızca içe alma
// yolunda tanınır (D20) ve tohum ENJEKTE edilir — çağıran content/seed.ts'ten
// SEED verir (tek kaynak: ekim + göç enjeksiyonu aynı nesne).
import { migrateV1 } from '../domain/migrate';
import type { SeedCatalog, V1Backup } from '../domain/migrate';
import { isAppState } from '../domain/validate';
import { merge } from '../domain/merge';
import type { AppState } from '../domain/types';
import type { IdGen } from '../domain/ids';

export type ImportResult = { ok: true; state: AppState } | { ok: false; error: string };

export function importBackup(
  current: AppState,
  rawJson: string,
  seed: SeedCatalog,
  deps: { now: number; idgen: IdGen },
): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Geçersiz JSON' };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, error: 'Geçersiz yedek' };
  }

  const v = (parsed as { v?: unknown }).v;
  let incoming: AppState;
  if (v === 1) {
    incoming = migrateV1(parsed as V1Backup, seed, deps); // D20 + tek kaynak SEED
  } else if (isAppState(parsed)) {
    incoming = parsed;
  } else {
    return { ok: false, error: 'Tanınmayan yedek biçimi' };
  }

  return { ok: true, state: merge(current, incoming) }; // D27: geri yükleme = birleştirme
}
