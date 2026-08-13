import type { PersistStatus, StoragePort } from '../app/ports';

const KEY = 'trainlog.state';

/**
 * localStorage tabanlı StoragePort (D23). Depo erişilemezse sessizce no-op'a
 * düşer; çağıran bellek kopyasıyla çalışmaya devam eder (D26).
 * IndexedDB'ye geçiş tetiği yalnızca blob/medya ihtiyacıdır (D23).
 */
export function createLocalStorage(): StoragePort {
  return {
    load() {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    save(raw) {
      try {
        localStorage.setItem(KEY, raw);
      } catch {
        /* D26: sessizce düş; çağıran bellek kopyasıyla yaşar */
      }
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* yok say */
      }
    },
  };
}

/**
 * Açılışta kalıcılık kontrolü/talebi (D25). Risk azaltıcıdır, garanti değildir —
 * garanti olmadığı için 3. katman (yedek) vardır. Sonuç UI'da görünür kılınır.
 */
export async function requestPersist(): Promise<PersistStatus> {
  try {
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      return 'unsupported';
    }
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'transient';
  } catch {
    return 'unsupported';
  }
}
