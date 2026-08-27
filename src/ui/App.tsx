import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import type { PersistStatus } from '../app/ports';
import type { Store } from '../app/store';
import type { BackupServices } from '../app/backup';
import { backupStatus } from '../app/backup';
import { TabBar } from './components/TabBar';
import { UpdateBar } from './components/UpdateBar';
import { TimerBar } from './components/TimerBar';
import { FirstRunBanner } from './components/FirstRunBanner';
import { BackupReminder } from './components/BackupReminder';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

interface Props {
  store: Store;
  today: string;
  services: BackupServices;
  idgen: () => string;
  requestPersist: () => Promise<PersistStatus>;
  registerSW: (onReady: (apply: () => void) => void) => void;
}

export function App({ store, today, services, idgen, requestPersist, registerSW }: Props) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState<TopView>(getRoute());
  const [persist, setPersist] = useState<PersistStatus>('unknown');
  const [apply, setApply] = useState<(() => void) | null>(null);
  const [remindOff, setRemindOff] = useState(false); // oturumluk UI durumu (D8)

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
  const backup = backupStatus(state, Date.now()); // D29 — yalnızca kayıt varken uyarır

  return (
    <>
      <main class="content">
        {route === 'workout' && isFresh && <FirstRunBanner services={services} />}
        {route === 'workout' && backup.remind && !remindOff && (
          <BackupReminder status={backup} run={services.exportNow} onDismiss={() => setRemindOff(true)} />
        )}
        {route === 'workout' && <WorkoutView state={state} today={today} dispatch={store.dispatch} />}
        {route === 'progress' && <ProgressView state={state} today={today} dispatch={store.dispatch} />}
        {route === 'program' && <ProgramView state={state} today={today} dispatch={store.dispatch} idgen={idgen} />}
        {route === 'settings' && <SettingsView state={state} services={services} persist={persist} dispatch={store.dispatch} />}
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
