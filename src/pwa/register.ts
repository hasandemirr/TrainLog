// SW kaydı + güncelleme algılama (D41). Sessiz otomatik yenileme YOK:
// yeni SW 'waiting'e düşünce onUpdateReady tetiklenir; asıl geçiş kullanıcı
// "Yenile"ye dokununca (skipWaiting → controllerchange → tek sefer reload).
// Not: 'load' beklemiyoruz — kayıt useEffect içinde (paint sonrası) çağrılır,
// o an 'load' çoktan geçmiş olabilir; doğrudan kaydediyoruz.

export function registerServiceWorker(onUpdateReady: (apply: () => void) => void): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return; // SW yalnızca üretim derlemesinde

  // Reload YALNIZCA kullanıcı "Yenile"ye basınca (açık uygula bayrağı). İlk-yük
  // claim'i de controllerchange tetikler ama o reload edilmez — yoksa her ilk
  // açılışta gereksiz bir reload olur.
  let applying = false;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  void navigator.serviceWorker
    .register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
    .then((reg) => {
      const apply = () => {
        applying = true;
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      };

      if (reg.waiting) onUpdateReady(apply);

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // Zaten bir kontrolör varsa: bu bir güncellemedir (ilk kurulum değil)
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdateReady(apply);
          }
        });
      });

      // Ön plana gelişte güncelleme denetimi (D41)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update();
      });
    })
    .catch(() => {
      /* D35: konsolu kirletme */
    });
}
