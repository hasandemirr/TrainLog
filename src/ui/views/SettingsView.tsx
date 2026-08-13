import type { PersistStatus } from '../../app/ports';

const PERSIST_TEXT: Record<PersistStatus, string> = {
  unknown: 'Kalıcı depolama: denetleniyor…',
  persisted: 'Kalıcı depolama: açık',
  transient: 'Kalıcı depolama: geçici (tarayıcı temizleyebilir)',
  unsupported: 'Kalıcı depolama: desteklenmiyor',
};

interface Props {
  persist: PersistStatus;
  bootCount: number;
}

export function SettingsView({ persist, bootCount }: Props) {
  return (
    <section class="view">
      <h1 class="view__title">Ayarlar</h1>

      <div class="card">
        <p class={'status' + (persist === 'persisted' ? ' status--ok' : '')}>
          {PERSIST_TEXT[persist]}
        </p>
      </div>

      <div class="card">
        <p class="view__hint">Tanılama (S0 geçici)</p>
        <p>Açılış sayısı: {bootCount}</p>
        <p class="status">Sürüm: S0 — yürüyen iskelet</p>
      </div>

      <p class="view__hint">Yedek, hatırlatma ve yayın cilası S6'da gelecek.</p>
    </section>
  );
}
