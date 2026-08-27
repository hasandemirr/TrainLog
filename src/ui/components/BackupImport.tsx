import { useState } from 'preact/hooks';
import type { AppServices } from '../../app/backup';

/** Yedekten yükle — dosya veya yapıştırılan metin. Geri yükleme = merge (D27). */
export function BackupImport({ services }: { services: AppServices }) {
  const [msg, setMsg] = useState<string | null>(null);

  const restore = (text: string) => {
    if (!text.trim()) return;
    const res = services.restore(text);
    if (!res.ok) {
      setMsg(`Hata: ${res.error}`);
      return;
    }
    const s = res.stats;
    const changes = s.recordsAdded + s.recordsUpdated + s.measuresAdded + s.measuresUpdated;
    if (changes === 0) {
      setMsg('Yedek mevcut veriyle aynıydı.');
      return;
    }
    const parts: string[] = [];
    if (s.recordsAdded > 0) parts.push(`${s.recordsAdded} yeni kayıt`);
    if (s.recordsUpdated > 0) parts.push(`${s.recordsUpdated} güncelleme`);
    if (s.measuresAdded + s.measuresUpdated > 0) parts.push(`${s.measuresAdded + s.measuresUpdated} ölçüm`);
    setMsg(`İçe alındı: ${parts.join(', ')}`);
  };

  const onFile = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    file
      .text()
      .then(restore)
      .catch(() => setMsg('Dosya okunamadı'));
  };

  return (
    <div class="import">
      <label class="link">
        Dosyadan yükle
        <input class="visually-hidden" type="file" accept="application/json,.json" onChange={onFile} />
      </label>
      <details>
        <summary class="link">Metinden yükle</summary>
        <textarea
          class="note"
          rows={3}
          placeholder="Yedek JSON'unu yapıştır"
          onChange={(e) => restore((e.currentTarget as HTMLTextAreaElement).value)}
        />
      </details>
      {msg && (
        <p class="status" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
