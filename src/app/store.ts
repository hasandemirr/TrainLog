// app/store.ts — asgari yükleme (S1). Tam tek-yönlü akışlı store + aksiyonlar S2'de.
// Kanonik anahtar yeniden kullanılır; doğrulamadan geçmeyen yük atılıp taze başlanır
// (iskelet {count} böyle temizlenir). Göç YALNIZCA içe alma yolunda (D20) — burada değil.
import type { StoragePort } from './ports';
import type { AppState } from '../domain/types';
import { isAppState } from '../domain/validate';
import { emptyState } from '../domain/state';
import type { InitDeps } from '../domain/state';

export function loadOrInit(storage: StoragePort, deps: InitDeps): AppState {
  const raw = storage.load();
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isAppState(parsed)) return parsed;
    } catch {
      /* bozuk JSON → taze başla */
    }
  }
  const fresh = emptyState(deps);
  storage.save(JSON.stringify(fresh)); // kanonik anahtarı geçerli v2 ile ez (iskelet temizliği)
  return fresh;
}
