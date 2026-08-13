import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import type { PersistStatus } from '../app/ports';
import { TabBar } from './components/TabBar';
import { UpdateBar } from './components/UpdateBar';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

interface Props {
  bootCount: number;
  requestPersist: () => Promise<PersistStatus>;
  registerSW: (onReady: (apply: () => void) => void) => void;
}

export function App({ bootCount, requestPersist, registerSW }: Props) {
  const [route, setRoute] = useState<TopView>(getRoute());
  const [persist, setPersist] = useState<PersistStatus>('unknown');
  const [apply, setApply] = useState<(() => void) | null>(null);

  useEffect(() => onRouteChange(setRoute), []);
  useEffect(() => {
    requestPersist()
      .then(setPersist)
      .catch(() => setPersist('unsupported'));
  }, [requestPersist]);
  useEffect(() => {
    registerSW((fn) => setApply(() => fn));
  }, [registerSW]);

  return (
    <>
      <main class="content">
        {route === 'workout' && <WorkoutView />}
        {route === 'progress' && <ProgressView />}
        {route === 'program' && <ProgramView />}
        {route === 'settings' && <SettingsView persist={persist} bootCount={bootCount} />}
      </main>
      {apply && <UpdateBar onApply={apply} />}
      <TabBar active={route} onSelect={goTop} />
    </>
  );
}
