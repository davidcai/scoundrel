import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useHashRoute } from './router';
import { AboutScreen } from './screens/AboutScreen';
import { PlayScreen } from './screens/PlayScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TitleScreen } from './screens/TitleScreen';

export default function App() {
  const { route, params } = useHashRoute();
  const hydrate = useGameStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  switch (route) {
    case 'play':
      return <PlayScreen params={params} />;
    case 'stats':
      return <StatsScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'about':
      return <AboutScreen />;
    default:
      return <TitleScreen />;
  }
}
