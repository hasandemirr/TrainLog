import type { BackupStatus, ExportResult } from '../../app/backup';
import { BACKUP_REMIND_DAYS } from '../../app/backup';
import { ExportButton } from './ExportButton';

/**
 * 21 gün hatırlatması (D29). Metin SEMANTİKTİR: "21 gündür yedek yok" — tahliye
 * tahmini değil. Yalnızca kayıt varken görünür (boş uygulamayı rahatsız etmez);
 * "Şimdi değil" yalnızca bu oturumluk UI durumudur (D8), AppState'e girmez.
 */
export function BackupReminder({
  status,
  run,
  onDismiss,
}: {
  status: BackupStatus;
  run: () => ExportResult;
  onDismiss: () => void;
}) {
  const text =
    status.reason === 'never'
      ? 'Hiç yedek almadın. Verin yalnızca bu cihazda duruyor.'
      : `${status.ageDays} gündür yedek yok (eşik ${BACKUP_REMIND_DAYS} gün).`;

  return (
    <div class="card firstrun" role="status">
      <strong>Yedek hatırlatması</strong>
      <p class="view__hint">{text} Dışa aktar → Dosyalara Kaydet.</p>
      <div class="exercise__actions">
        <ExportButton label="Dışa aktar" run={run} />
        <button type="button" class="link" onClick={onDismiss}>
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
