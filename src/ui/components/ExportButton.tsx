import { useState } from 'preact/hooks';
import type { ExportResult } from '../../app/backup';

/**
 * Dışa aktarma düğmesi — ŞART 1 (jest-senkron): `run()` doğrudan onClick gövdesinde,
 * önünde await YOK (ARCH §5; iOS jest penceresi). Sonuç mesajı zincirin hangi
 * ayağına düşüldüğünü söyler: paylaşım → indirme → kopyalanabilir metin (D27).
 */
export function ExportButton({
  label,
  run,
  variant = 'btn',
}: {
  label: string;
  run: () => ExportResult;
  variant?: 'btn' | 'link';
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const onClick = () => {
    const res = run(); // ← jest-senkron sınır; buraya await eklenmez
    if (res.outcome === 'shared') {
      setMsg('Paylaşım açıldı…');
      res.promise
        ?.then(() => setMsg('Paylaşıldı.'))
        .catch(() => {
          setMsg('Paylaşım kapandı — metinden kopyalayabilirsin.');
          setText(res.text);
        });
    } else if (res.outcome === 'downloaded') {
      setMsg('İndirildi.');
    } else {
      setMsg('Paylaşım/indirme yok — metni elle kopyala.');
      setText(res.text);
    }
  };

  return (
    <>
      <button type="button" class={variant} onClick={onClick}>
        {label}
      </button>
      {msg && (
        <p class="status" role="status">
          {msg}
        </p>
      )}
      {text && <textarea class="note" rows={3} readOnly aria-label="Yedek metni" value={text} />}
    </>
  );
}
