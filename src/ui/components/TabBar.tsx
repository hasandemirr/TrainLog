import type { TopView } from '../router';

const TABS: readonly { id: TopView; label: string }[] = [
  { id: 'workout', label: 'Antrenman' },
  { id: 'progress', label: 'İlerleme' },
  { id: 'program', label: 'Program' },
  { id: 'settings', label: 'Ayarlar' },
];

interface Props {
  active: TopView;
  onSelect: (view: TopView) => void;
}

export function TabBar({ active, onSelect }: Props) {
  return (
    <nav class="tabbar" aria-label="Ana gezinme">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          class={'tab' + (active === t.id ? ' tab--active' : '')}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
