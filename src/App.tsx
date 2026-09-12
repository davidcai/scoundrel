import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { LiveAnnouncer } from './ui/LiveAnnouncer';
import { PlayScreen } from './ui/PlayScreen';
import { useHashRoute } from './ui/router';
import { AboutScreen } from './ui/screens/AboutScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { TitleScreen } from './ui/screens/TitleScreen';

export default function App() {
  const route = useHashRoute();
  const hydrate = useGameStore((s) => s.hydrate);

  // Restore any saved run once per page load; the title screen's "Continue"
  // resumes it. The app always opens on the title screen for predictability.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  let screen;
  switch (route.path) {
    case '/play':
      screen = <PlayScreen />;
      break;
    case '/stats':
      screen = <StatsScreen />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    case '/about':
      screen = <AboutScreen />;
      break;
    default:
      screen = <TitleScreen />;
  }

  return (
    <div className="app-root">
      <LiveAnnouncer />
      {screen}
    </div>
  );
}
