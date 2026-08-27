// app/backup.ts — yedek içe alma (D27). Geri yükleme EZME değil BİRLEŞTİRME:
// domain/merge.ts'in ikinci müşterisi burada bağlanır. v1 yalnızca içe alma
// yolunda tanınır (D20) ve tohum ENJEKTE edilir — çağıran content/seed.ts'ten
// SEED verir (tek kaynak: ekim + göç enjeksiyonu aynı nesne).
import { migrateV1 } from '../domain/migrate';
import type { SeedCatalog, V1Backup } from '../domain/migrate';
import { isAppState } from '../domain/validate';
import { merge } from '../domain/merge';
import { closeStale } from '../domain/session';
import type { AppState } from '../domain/types';
import type { IdGen, ISODate } from '../domain/ids';

export interface MergeStats {
  recordsAdded: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  measuresAdded: number;
  measuresUpdated: number;
  measuresUnchanged: number;
}

export type ImportResult = { ok: true; state: AppState; stats: MergeStats } | { ok: false; error: string };

function countDiff<T>(
  current: Record<string, T>,
  incoming: Record<string, T>,
  merged: Record<string, T>,
): { added: number; updated: number; unchanged: number } {
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const k of Object.keys(incoming)) {
    if (!(k in current)) added += 1;
    else if (JSON.stringify(merged[k]) !== JSON.stringify(current[k])) updated += 1;
    else unchanged += 1;
  }
  return { added, updated, unchanged };
}

export type ExportOutcome = 'shared' | 'downloaded' | 'copy';
export interface ExportResult {
  outcome: ExportOutcome;
  promise?: Promise<void>;
  text: string;
}

/** main.ts'in kabloladığı yedek yetenekleri; ui yalnızca bunları tüketir. */
export interface BackupServices {
  exportNow: () => ExportResult; // JEST-SENKRON (şart 1) — onClick'ten çağrılır
  restore: (text: string) => ImportResult; // içe al + store.replace
}

/** Yedeğe yazılacak durum — sayaç SOYULUR (D42 istisnası: yarım sayaç yedekte
 *  işi yok). Dışa aktarma bunu serileştirir. */
export function toBackupState(state: AppState): AppState {
  if (state.timer === undefined) return state;
  const out: AppState = { ...state };
  delete out.timer;
  return out;
}

export function importBackup(
  current: AppState,
  rawJson: string,
  seed: SeedCatalog,
  deps: { now: number; today: ISODate; idgen: IdGen },
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

  // D27: geri yükleme = birleştirme. Ardından oto-kapanış (D46): yüklenen yedekteki
  // geçmiş tarihli bitmemiş seanslar "bugünkü açık seans" gibi dirilmesin.
  const merged = merge(current, incoming);
  const rec = countDiff(current.records, incoming.records, merged.records);
  const mea = countDiff(current.measures, incoming.measures, merged.measures);
  const stats: MergeStats = {
    recordsAdded: rec.added,
    recordsUpdated: rec.updated,
    recordsUnchanged: rec.unchanged,
    measuresAdded: mea.added,
    measuresUpdated: mea.updated,
    measuresUnchanged: mea.unchanged,
  };
  return { ok: true, state: closeStale(merged, deps.today, deps.now), stats };
}

// ── Yedek yaşı + hatırlatma (D29, S6) ─────────────────────────────────────
// SEMANTİK: eşik "21 gündür yedek yok" der; tahliye/veri kaybı TAHMİNİ DEĞİLDİR.
// Tarayıcının veriyi ne zaman atacağı bilinemez (D25: persist garanti değil).

export const BACKUP_REMIND_DAYS = 21; // ürün politikası (D29)

const DAY_MS = 86_400_000;

export type BackupReason = 'never' | 'stale';

export interface BackupStatus {
  lastBackup: number; // 0 = hiç alınmadı
  ageDays: number | null; // hiç alınmadıysa null
  hasData: boolean; // kayıt yoksa boş uygulamayı rahatsız etmeyiz
  remind: boolean;
  reason: BackupReason | null;
}

/** Yedek yaşı (saf, D8 türetme). `now` edge'de yakalanır, param olarak gelir. */
export function backupStatus(state: AppState, now: number): BackupStatus {
  const lastBackup = state.meta.lastBackup;
  const hasData = Object.keys(state.records).length > 0;
  const ageDays = lastBackup > 0 ? Math.max(0, Math.floor((now - lastBackup) / DAY_MS)) : null;
  const reason: BackupReason | null = ageDays === null ? 'never' : ageDays >= BACKUP_REMIND_DAYS ? 'stale' : null;
  return { lastBackup, ageDays, hasData, remind: hasData && reason !== null, reason };
}
