import { h, render } from 'preact';
import { App } from './ui/App';
import { createLocalStorage, requestPersist } from './adapters/storage.local';
import { loadOrInit } from './app/store';
import { registerServiceWorker } from './pwa/register';
import './ui/styles.css';

const storage = createLocalStorage();

// Yükle → doğrula → geçersizse taze (S0 iskelet {count} anahtarı böyle temizlenir).
// Zaman/kimlik burada (kablolama) üretilir; domain'e parametreyle geçer.
const deviceId = globalThis.crypto?.randomUUID?.() ?? `dev-${Date.now()}`;
const state = loadOrInit(storage, { now: Date.now(), deviceId });

const root = document.getElementById('app');
if (root) {
  // Temiz başlangıç URL'si (D40: üst görünüm hash'i)
  if (!location.hash) history.replaceState(null, '', '#/workout');
  render(h(App, { state, requestPersist, registerSW: registerServiceWorker }), root);
}
