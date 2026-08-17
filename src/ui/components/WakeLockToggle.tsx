import { useEffect, useRef, useState } from 'preact/hooks';

// Minimal Wake Lock tipleri (DOM lib sürümünden bağımsız kalmak için).
interface Sentinel {
  released: boolean;
  release: () => Promise<void>;
}
interface WakeLockNav {
  wakeLock?: { request: (type: 'screen') => Promise<Sentinel> };
}

/** "Antrenmanda ekranı açık tut" (D42 notu). Ekran gizlenince kilit düşer;
 *  geri dönünce yeniden alınır. Desteklenmiyorsa render edilmez. */
export function WakeLockToggle() {
  const nav = navigator as Navigator & WakeLockNav;
  const supported = typeof nav.wakeLock?.request === 'function';
  const [on, setOn] = useState(false);
  const ref = useRef<Sentinel | null>(null);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || ref.current) return;
      try {
        const s = await nav.wakeLock!.request('screen');
        if (cancelled) {
          void s.release();
          return;
        }
        ref.current = s;
      } catch {
        /* reddedildi/başarısız */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      const s = ref.current;
      ref.current = null;
      if (s && !s.released) void s.release();
    };
  }, [on, nav]);

  if (!supported) return null;
  return (
    <label class="wakelock">
      <input type="checkbox" checked={on} onChange={(e) => setOn((e.currentTarget as HTMLInputElement).checked)} />{' '}
      Antrenmanda ekranı açık tut
    </label>
  );
}
