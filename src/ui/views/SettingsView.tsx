import { useState } from 'preact/hooks';
import type { PersistStatus } from '../../app/ports';
import type { AppState } from '../../domain/types';
import type { Action, ProfilePatch } from '../../app/actions';
import type { BackupServices, BackupStatus } from '../../app/backup';
import { backupStatus } from '../../app/backup';
import { BackupImport } from '../components/BackupImport';
import { ExportButton } from '../components/ExportButton';
import { NumInput } from '../components/NumInput';
import { Guide } from '../components/Guide';

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
  dispatch: (a: Action) => void;
}

export function SettingsView({ state, services, persist, dispatch }: Props) {
  const [guide, setGuide] = useState(false);
  const exerciseCount = Object.keys(state.catalog.exercises).length;
  const recordCount = Object.keys(state.records).length;
  const backup = backupStatus(state, Date.now());

  if (guide) return <Guide onDone={() => setGuide(false)} />;

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
        <p class="view__hint">CSV</p>
        <p class="status">
          Tablo programı için tek yönlü dışa aktarma (noktalı virgül + BOM). CSV geri
          yüklenemez — kurtarma biçimi JSON yedeğidir.
        </p>
        <ExportButton label="CSV dışa aktar" run={services.exportCsvNow} variant="link" />
      </div>

      <ProfileSection state={state} dispatch={dispatch} />

      <div class="card">
        <p class="view__hint">Yardım</p>
        <button type="button" class="link" onClick={() => setGuide(true)}>
          Kullanım kılavuzu
        </button>
      </div>

      <DangerZone services={services} />

      <div class="card">
        <p class="view__hint">Tanılama</p>
        <p>Şema: v{state.v}</p>
        <p>Hareket: {exerciseCount} · Kayıt: {recordCount}</p>
      </div>
    </section>
  );
}

/**
 * Kişisel bilgiler (F4.5) — ASGARİ: ad, doğum yılı, boy; hepsi isteğe bağlı.
 * Yalnızca cihazda; yedeğe girer, hiçbir yere gönderilmez (D5 yerel-öncelikli).
 */
function ProfileSection({ state, dispatch }: { state: AppState; dispatch: (a: Action) => void }) {
  const p = state.profile;
  const set = (patch: ProfilePatch) => dispatch({ type: 'setProfile', patch, updatedAt: Date.now() });

  return (
    <div class="card">
      <p class="view__hint">Kişisel bilgiler</p>
      <p class="status">
        Tamamı isteğe bağlı; yalnızca bu cihazda durur ve yedeğine girer. Hiçbir sunucuya
        gönderilmez.
      </p>
      <div class="measform">
        <label class="measrow">
          <span>Ad</span>
          <input
            class="note"
            type="text"
            aria-label="Ad"
            value={p?.name ?? ''}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value.trim();
              set({ name: v.length > 0 ? v : null });
            }}
          />
        </label>
        <label class="measrow">
          <span>Doğum yılı</span>
          <NumInput
            value={p?.birthYear ?? null}
            placeholder="—"
            inputMode="numeric"
            ariaLabel="Doğum yılı"
            onCommit={(v) => set({ birthYear: v })}
          />
        </label>
        <label class="measrow">
          <span>Boy (cm)</span>
          <NumInput
            value={p?.heightCm ?? null}
            placeholder="—"
            inputMode="decimal"
            ariaLabel="Boy (cm)"
            onCommit={(v) => set({ heightCm: v })}
          />
        </label>
      </div>
    </div>
  );
}

/**
 * "Tüm verileri sil" (F4.6) — ÇİFT ONAY: düğme → uyarı paneli → ikinci düğme.
 * Merge dışındaki tek gerçek ezmedir (ARCH §3). SW önbelleğine dokunmaz (D36).
 */
function DangerZone({ services }: { services: BackupServices }) {
  const [arming, setArming] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div class="card danger">
      <p class="view__hint">Tüm verileri sil</p>
      <p class="status">
        Seanslar, kayıtlar, ölçümler, program sürümleri ve kişisel bilgiler silinir;
        uygulama ilk açılıştaki gibi (tohum programla) başlar. Geri alınamaz — önce yedek al.
      </p>
      {!arming && !done && (
        <button type="button" class="link danger__link" onClick={() => setArming(true)}>
          Tüm verileri sil…
        </button>
      )}
      {arming && (
        <>
          <p class="warn">Emin misin? Bu cihazdaki tüm antrenman verisi kalıcı olarak silinecek.</p>
          <div class="exercise__actions">
            <button type="button" class="btn" onClick={() => setArming(false)}>
              Vazgeç
            </button>
            <button
              type="button"
              class="link danger__link"
              onClick={() => {
                services.wipeAll();
                setArming(false);
                setDone(true);
              }}
            >
              Evet, hepsini sil
            </button>
          </div>
        </>
      )}
      {done && <p class="status">Tüm veriler silindi; uygulama ilk açılış durumunda.</p>}
    </div>
  );
}
