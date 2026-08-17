import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import type { PersistStatus } from '../app/ports';
import type { Store } from '../app/store';
import { TabBar } from './components/TabBar';
import { UpdateBar } from './components/UpdateBar';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

interface Props {
  store: Store;
  today: string;
  requestPersist: () => Promise<PersistStatus>;
  registerSW: (onReady: (apply: () => void) => void) => void;
}

export function App({ store, today, requestPersist, registerSW }: Props) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState<TopView>(getRoute());
  const [persist, setPersist] = useState<PersistStatus>('unknown');
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
  useEffect(() => onRouteChange(setRoute), []);
  useEffect(() => {
    requestPersist()
      .then(setPersist)
      .catch(() => setPersist('unsupported'));
  }, [requestPersist]);
  useEffect(() => {
    registerSW((fn) => setApply(() => fn));
  }, [registerSW]);

  const state = store.getState();

  return (
    <>
      <main class="content">
        {route === 'workout' && <WorkoutView state={state} today={today} dispatch={store.dispatch} />}
        {route === 'progress' && <ProgressView />}
        {route === 'program' && <ProgramView />}
        {route === 'settings' && <SettingsView persist={persist} state={state} />}
      </main>
      {apply && <UpdateBar onApply={apply} />}
      <TabBar active={route} onSelect={goTop} />
    </>
  );
}
