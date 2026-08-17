import { useState } from 'preact/hooks';
import type { BackupServices } from '../../app/backup';

/** Yedekten yükle — dosya veya yapıştırılan metin. Geri yükleme = merge (D27). */
export function BackupImport({ services }: { services: BackupServices }) {
  const [msg, setMsg] = useState<string | null>(null);

  const restore = (text: string) => {
    if (!text.trim()) return;
    const res = services.restore(text);
    setMsg(res.ok ? 'Yedek yüklendi (birleştirildi).' : `Hata: ${res.error}`);
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
        <input type="file" accept="application/json,.json" onChange={onFile} hidden />
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
      {msg && <p class="status">{msg}</p>}
    </div>
  );
}
