import type { PersistStatus } from '../../app/ports';
import type { AppState } from '../../domain/types';

const PERSIST_TEXT: Record<PersistStatus, string> = {
  unknown: 'Kalıcı depolama: denetleniyor…',
  persisted: 'Kalıcı depolama: açık',
  transient: 'Kalıcı depolama: geçici (tarayıcı temizleyebilir)',
  unsupported: 'Kalıcı depolama: desteklenmiyor',
};

interface Props {
  persist: PersistStatus;
  state: AppState;
}

export function SettingsView({ persist, state }: Props) {
  const exerciseCount = Object.keys(state.catalog.exercises).length;
  const recordCount = Object.keys(state.records).length;

  return (
    <section class="view">
      <h1 class="view__title">Ayarlar</h1>

      <div class="card">
        <p class={'status' + (persist === 'persisted' ? ' status--ok' : '')}>
          {PERSIST_TEXT[persist]}
        </p>
      </div>

      <div class="card">
        <p class="view__hint">Tanılama</p>
        <p>Şema: v{state.v}</p>
        <p>Hareket: {exerciseCount} · Kayıt: {recordCount}</p>
      </div>

      <p class="view__hint">Yedek, hatırlatma ve yayın cilası S6'da gelecek.</p>
    </section>
  );
}
