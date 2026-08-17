import { useEffect, useState } from 'preact/hooks';
import type { Timer } from '../../domain/types';

/**
 * Dinlenme sayacı çubuğu (D42/43): mutlak tEnd'den kalan süre — kilit/dönüş sonrası
 * doğru. Bitişte SES YOK, görsel uyarı. Yerel interval yalnızca yeniden çizim için.
 */
export function TimerBar({ timer, onClear }: { timer: Timer; onClear: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((timer.tEnd - Date.now()) / 1000));
  const done = remaining === 0;

  return (
    <div class={'timerbar' + (done ? ' timerbar--done' : '')} role="status">
      <span>
        {done ? 'Dinlenme bitti' : `Dinlenme: ${remaining} sn`} · {timer.label}
      </span>
      <button type="button" onClick={onClear}>
        {done ? 'Tamam' : 'Kapat'}
      </button>
    </div>
  );
}
