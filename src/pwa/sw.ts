/// <reference lib="webworker" />
// Service worker — bağımsız derlenir (tsconfig'de hariç; webworker bağlamı).
// Derlemede kendi Vite eklentimiz sürüm ve ön-önbellek yer tutucularını
// doldurur (D36: hash'li app-shell ön-önbelleği, elle sürüm artırma yok).
declare const self: ServiceWorkerGlobalScope;

const VERSION = '__CACHE_VERSION__';
const CACHE = `trainlog-${VERSION}`;
const ASSETS: string[] = ['__PRECACHE__'];

self.addEventListener('install', (event) => {
  // skipWaiting YOK — yeni SW 'waiting'e düşer; kullanıcı çubuğa dokununca
  // geçer. Sessiz otomatik yenileme yasak (D41).
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(ASSETS);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch {
        // çevrimdışı gezinme → uygulama kabuğu (KL-C 2)
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
