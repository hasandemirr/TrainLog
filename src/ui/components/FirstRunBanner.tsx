import type { BackupServices } from '../../app/backup';
import { BackupImport } from './BackupImport';

/** F0.2 — ilk açılışta (veri yokken) yedekten yükle + kurulum yönlendirmesi (D27). */
export function FirstRunBanner({ services }: { services: BackupServices }) {
  return (
    <div class="card firstrun">
      <strong>Hoş geldin</strong>
      <p class="view__hint">
        Verini başka bir cihazdan ya da yedekten getirebilirsin. Kurulu uygulama Safari
        sekmesinden ayrı depolama kullanır — cihaz/mod değişiminde yedekten yükle.
      </p>
      <BackupImport services={services} />
      <p class="status">Kurulum: Safari → Paylaş → “Ana Ekrana Ekle”.</p>
    </div>
  );
}
