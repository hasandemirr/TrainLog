// adapters/backup.file.ts — yedek dışa aktarma (D27, ARCH §5).
//
// ŞART 1 (yapısal kısıt, test değil): dışa aktarma JEST-SENKRON. onClick'ten
// navigator.share'e giden yolda HİÇBİR `await` yoktur — JSON zaten senkron store'dan
// hazır gelir, File kurulumu ve canShare kontrolü senkron bloktur, `share()` çağrısı
// jestin İLK asenkron sınırıdır. Araya "önce state'i tazele" gibi bir asenkron adım
// girerse iOS jest penceresi sessizce ölür; bu masaüstü Chromium'da GÖRÜNMEZ, Playwright
// yakalayamaz — o yüzden şart koda yapıyla girer. Zincir: share → indirme → metin.

import type { ExportResult } from '../app/backup';

/**
 * İçerik çağıran (UI) tarafından SENKRON hazırlanır (store senkron). Jestin İÇİNDE.
 * `mime` yedeğin JSON'u (D27) ile CSV dışa aktarmasını (D28) ayırır — zincir aynıdır.
 */
export function exportFile(content: string, filename: string, mime: string): ExportResult {
  // ── jest-senkron gövde: buraya await EKLENMEZ ─────────────────────────────
  const file = new File([content], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  const canShareFiles =
    typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });

  if (canShareFiles) {
    // share() = jestin ilk asenkron sınırı; dosya yukarıda SENKRON kuruldu
    return { outcome: 'shared', promise: nav.share({ files: [file], title: filename }), text: content };
  }

  // Fallback: <a download> (iOS standalone'da sessizce çalışmayabilir → 3. seçenek metin)
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { outcome: 'downloaded', text: content };
  } catch {
    return { outcome: 'copy', text: content }; // kopyalanabilir metin (son fallback)
  }
}

/** JSON yedeği (D27) — tam sadakatli tek yedek biçimi. */
export const exportBackup = (json: string, filename: string): ExportResult =>
  exportFile(json, filename, 'application/json');

/** CSV (D28) — YALNIZCA dışa aktarma; içe alma biçimi değildir. */
export const exportCsv = (csv: string, filename: string): ExportResult =>
  exportFile(csv, filename, 'text/csv;charset=utf-8');
