import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import type { PersistStatus } from '../app/ports';
import type { Store } from '../app/store';
import type { BackupServices } from '../app/backup';
import { TabBar } from './components/TabBar';
import { UpdateBar } from './components/UpdateBar';
import { TimerBar } from './components/TimerBar';
import { FirstRunBanner } from './components/FirstRunBanner';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

interface Props {
  store: Store;
  today: string;
  services: BackupServices;
  requestPersist: () => Promise<PersistStatus>;
  registerSW: (onReady: (apply: () => void) => void) => void;
}

export function App({ store, today, services, requestPersist, registerSW }: Props) {
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
  const isFresh = Object.keys(state.sessions).length === 0 && Object.keys(state.records).length === 0;

  return (
    <>
      <main class="content">
        {route === 'workout' && isFresh && <FirstRunBanner services={services} />}
        {route === 'workout' && <WorkoutView state={state} today={today} dispatch={store.dispatch} />}
        {route === 'progress' && <ProgressView />}
        {route === 'program' && <ProgramView />}
        {route === 'settings' && <SettingsView state={state} services={services} persist={persist} />}
      </main>
      {state.timer && (
        <TimerBar
          timer={state.timer}
          onClear={() => store.dispatch({ type: 'clearTimer', updatedAt: Date.now() })}
        />
      )}
      {apply && <UpdateBar onApply={apply} />}
      <TabBar active={route} onSelect={goTop} />
    </>
  );
}
