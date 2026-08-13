// Port sözleşmeleri (D7). İmza değişikliği karar önerisi gerektirir.
// SyncPort ve BackupPort ilgili sprintlerinde (senkron tetiği D11 / yedek S3) eklenir.

export interface StoragePort {
  /** Ham serileştirilmiş durumu döndürür; yoksa null. */
  load(): string | null;
  /** Ham serileştirilmiş durumu senkron yazar (D24). */
  save(raw: string): void;
  /** Kalıcı anahtarı temizler ("tüm verileri sil" yolunda kullanılacak). */
  clear(): void;
}

export type PersistStatus = 'unknown' | 'persisted' | 'transient' | 'unsupported';
