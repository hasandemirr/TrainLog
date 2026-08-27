import type { PersistStatus } from '../../app/ports';
import type { AppState } from '../../domain/types';
import type { BackupServices, BackupStatus } from '../../app/backup';
import { backupStatus } from '../../app/backup';
import { BackupImport } from '../components/BackupImport';
import { ExportButton } from '../components/ExportButton';

const PERSIST_TEXT: Record<PersistStatus, string> = {
  unknown: 'Kalıcı depolama: denetleniyor…',
  persisted: 'Kalıcı depolama: açık',
  transient: 'Kalıcı depolama: geçici (tarayıcı temizleyebilir)',
  unsupported: 'Kalıcı depolama: desteklenmiyor',
};

/** Yedek yaşı metni (D29) — semantik: "N gündür yedek yok", tahliye tahmini değil. */
function backupAgeText(b: BackupStatus): string {
  if (b.ageDays === null) return 'Son yedek: hiç';
  const when = new Date(b.lastBackup).toLocaleString('tr');
  const age = b.ageDays === 0 ? 'bugün' : `${b.ageDays} gün önce`;
  return `Son yedek: ${age} (${when})`;
}

interface Props {
  state: AppState;
  services: BackupServices;
  persist: PersistStatus;
}

export function SettingsView({ state, services, persist }: Props) {
  const exerciseCount = Object.keys(state.catalog.exercises).length;
  const recordCount = Object.keys(state.records).length;
  const backup = backupStatus(state, Date.now());

  return (
    <section class="view">
      <h1 class="view__title">Ayarlar</h1>

      <div class="card">
        <p class={'status' + (persist === 'persisted' ? ' status--ok' : '')}>{PERSIST_TEXT[persist]}</p>
      </div>

      <div class="card">
        <p class="view__hint">Yedek</p>
        <p class={'status' + (backup.remind ? ' status--warn' : '')}>{backupAgeText(backup)}</p>
        <ExportButton label="Dışa aktar" run={services.exportNow} />
        <BackupImport services={services} />
      </div>

      <div class="card">
        <p class="view__hint">Tanılama</p>
        <p>Şema: v{state.v}</p>
        <p>Hareket: {exerciseCount} · Kayıt: {recordCount}</p>
      </div>
    </section>
  );
}
