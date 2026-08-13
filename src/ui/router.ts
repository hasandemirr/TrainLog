// Hash yönlendirme (D40). Yalnızca dört üst görünüm; iç durumlar (gün, hafta, slot)
// ileriki sprintlerde replaceState ile yazılacak — geri tuşu cehennemi yasak.

export type TopView = 'workout' | 'progress' | 'program' | 'settings';

const TOP: readonly TopView[] = ['workout', 'progress', 'program', 'settings'];
const DEFAULT: TopView = 'workout';
const CHANGE = 'trainlog:route';

function parse(): TopView {
  const raw = location.hash.replace(/^#\/?/, '');
  return (TOP as readonly string[]).includes(raw) ? (raw as TopView) : DEFAULT;
}

export function getRoute(): TopView {
  return parse();
}

/** Üst görünüme geçiş — pushState (D40: yalnızca üst görünümler geçmişe yazılır). */
export function goTop(view: TopView): void {
  if (parse() === view) return;
  history.pushState(null, '', `#/${view}`);
  window.dispatchEvent(new Event(CHANGE));
}

/** Geri/ileri (popstate) ve programatik geçişleri dinle. Aboneliği söken fonksiyon döner. */
export function onRouteChange(cb: (view: TopView) => void): () => void {
  const handler = () => cb(parse());
  window.addEventListener('popstate', handler);
  window.addEventListener(CHANGE, handler);
  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener(CHANGE, handler);
  };
}
