import { useState } from 'preact/hooks';
import type { PersistStatus } from '../../app/ports';
import type { AppState } from '../../domain/types';
import type { BackupServices } from '../../app/backup';
import { BackupImport } from '../components/BackupImport';

const PERSIST_TEXT: Record<PersistStatus, string> = {
  unknown: 'Kalıcı depolama: denetleniyor…',
  persisted: 'Kalıcı depolama: açık',
  transient: 'Kalıcı depolama: geçici (tarayıcı temizleyebilir)',
  unsupported: 'Kalıcı depolama: desteklenmiyor',
};

interface Props {
  state: AppState;
  services: BackupServices;
  persist: PersistStatus;
}

export function SettingsView({ state, services, persist }: Props) {
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const exerciseCount = Object.keys(state.catalog.exercises).length;
  const recordCount = Object.keys(state.records).length;
  const lastBackup = state.meta.lastBackup;

  const onExport = () => {
    const res = services.exportNow(); // JEST-SENKRON (şart 1) — önce çağır
    if (res.outcome === 'shared') {
      setExportMsg('Paylaşım açıldı…');
      res.promise
        ?.then(() => setExportMsg('Paylaşıldı.'))
        .catch(() => setExportMsg('Paylaşım kapandı — metinden kopyalayabilirsin.'));
    } else if (res.outcome === 'downloaded') {
      setExportMsg('İndirildi.');
    } else {
      setExportMsg('Paylaşım/indirme yok — metni elle kopyala.');
    }
  };

  return (
    <section class="view">
      <h1 class="view__title">Ayarlar</h1>

      <div class="card">
        <p class={'status' + (persist === 'persisted' ? ' status--ok' : '')}>{PERSIST_TEXT[persist]}</p>
      </div>

      <div class="card">
        <p class="view__hint">Yedek</p>
        <button type="button" class="btn" onClick={onExport}>
          Dışa aktar
        </button>
        {exportMsg && <p class="status">{exportMsg}</p>}
        <p class="status">Son yedek: {lastBackup > 0 ? new Date(lastBackup).toLocaleString('tr') : 'hiç'}</p>
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
