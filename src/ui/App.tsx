import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import type { PersistStatus } from '../app/ports';
import { TabBar } from './components/TabBar';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

interface Props {
  bootCount: number;
  requestPersist: () => Promise<PersistStatus>;
}

export function App({ bootCount, requestPersist }: Props) {
  const [route, setRoute] = useState<TopView>(getRoute());
  const [persist, setPersist] = useState<PersistStatus>('unknown');

  useEffect(() => onRouteChange(setRoute), []);
  useEffect(() => {
    requestPersist()
      .then(setPersist)
      .catch(() => setPersist('unsupported'));
  }, [requestPersist]);

  return (
    <>
      <main class="content">
        {route === 'workout' && <WorkoutView />}
        {route === 'progress' && <ProgressView />}
        {route === 'program' && <ProgramView />}
        {route === 'settings' && <SettingsView persist={persist} bootCount={bootCount} />}
      </main>
      <TabBar active={route} onSelect={goTop} />
    </>
  );
}
