import { h, render } from 'preact';
import { App } from './ui/App';
import { createLocalStorage, requestPersist } from './adapters/storage.local';
import { createStore, initState } from './app/store';
import { exportBackup } from './adapters/backup.file';
import { importBackup, toBackupState } from './app/backup';
import type { BackupServices } from './app/backup';
import { registerServiceWorker } from './pwa/register';
import { SEED } from './content/seed';
import './ui/styles.css';

/** Yerel gün (D22) — edge'de yakalanır, domain'e param olarak geçer. */
function todayLocalISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const storage = createLocalStorage();
const now = Date.now();
const today = todayLocalISO();
const deviceId = globalThis.crypto?.randomUUID?.() ?? `dev-${now}`;
let idc = 0;
const idgen = () => globalThis.crypto?.randomUUID?.() ?? `id-${now}-${idc++}`;

// Yükle → doğrula → ek (tohum) → kalıcılaştır; sonra tek-yönlü akışlı store.
const state = initState(storage, SEED, { now, today, deviceId, idgen });
const store = createStore(state, storage);

// Yedek yetenekleri — exportNow JEST-SENKRON (şart 1): onClick → JSON → share, await yok.
const services: BackupServices = {
  exportNow: () => {
    const res = exportBackup(JSON.stringify(toBackupState(store.getState())), `trainlog-${todayLocalISO()}.json`);
    store.dispatch({ type: 'markBackup', at: Date.now() }); // share() sonrası senkron; jesti bloklamaz
    return res;
  },
  restore: (text) => {
    const res = importBackup(store.getState(), text, SEED, { now: Date.now(), today: todayLocalISO(), idgen });
    if (res.ok) store.replace(res.state);
    return res;
  },
};

const root = document.getElementById('app');
if (root) {
  if (!location.hash) history.replaceState(null, '', '#/workout');
  render(h(App, { store, today, services, requestPersist, registerSW: registerServiceWorker }), root);
}
