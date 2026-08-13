import { useEffect, useState } from 'preact/hooks';
import { getRoute, goTop, onRouteChange } from './router';
import type { TopView } from './router';
import { TabBar } from './components/TabBar';
import { WorkoutView } from './views/WorkoutView';
import { ProgressView } from './views/ProgressView';
import { ProgramView } from './views/ProgramView';
import { SettingsView } from './views/SettingsView';

export function App() {
  const [route, setRoute] = useState<TopView>(getRoute());

  useEffect(() => onRouteChange(setRoute), []);

  return (
    <>
      <main class="content">
        {route === 'workout' && <WorkoutView />}
        {route === 'progress' && <ProgressView />}
        {route === 'program' && <ProgramView />}
        {route === 'settings' && <SettingsView />}
      </main>
      <TabBar active={route} onSelect={goTop} />
    </>
  );
}
