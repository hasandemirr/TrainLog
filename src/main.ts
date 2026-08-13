import { h, render } from 'preact';
import { App } from './ui/App';
import { createLocalStorage, requestPersist } from './adapters/storage.local';
import { registerServiceWorker } from './pwa/register';
import './ui/styles.css';

const storage = createLocalStorage();

// S0 geçici: kalıcılık round-trip kanıtı (KL-C 8 — yenileme veri kaybettirmemeli).
// S1'de gerçek AppState + göç + tek-yönlü akışlı store ile değişecek.
let boot: { count: number } = { count: 0 };
try {
  const raw = storage.load();
  if (raw) boot = JSON.parse(raw);
} catch {
  /* bozuk kayıt → sıfırdan başla */
}
boot.count = (boot.count ?? 0) + 1;
storage.save(JSON.stringify(boot));

const root = document.getElementById('app');
if (root) {
  // Temiz başlangıç URL'si (D40: üst görünüm hash'i)
  if (!location.hash) history.replaceState(null, '', '#/workout');
  render(
    h(App, { bootCount: boot.count, requestPersist, registerSW: registerServiceWorker }),
    root,
  );
}
