/**
 * App shell: theme wrapper, hash router, and the game's screen switch.
 * The live region mounts once at root so announcements survive screen swaps.
 */
import type { StoreApi } from 'zustand';
import { gameStore, GameStoreProvider, type GameStoreState } from './store/gameStore';
import { useHashRoute } from './ui/router/useHashRoute';
import { AboutScreen } from './ui/screens/AboutScreen';
import { PlayScreen } from './ui/screens/PlayScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { TitleScreen } from './ui/screens/TitleScreen';
import { LiveRegion } from './ui/components/LiveRegion';
import './ui/components/controls.css';

interface AppProps {
  /** Test hook: inject a scripted store. Production uses the singleton. */
  store?: StoreApi<GameStoreState>;
}

export default function App({ store = gameStore }: AppProps) {
  const route = useHashRoute();
  return (
    <GameStoreProvider value={store}>
      <div className="theme-scoundrel">
        <LiveRegion />
        {route.name === 'title' && <TitleScreen />}
        {route.name === 'play' && <PlayScreen route={route} />}
        {route.name === 'stats' && <StatsScreen />}
        {route.name === 'settings' && <SettingsScreen />}
        {route.name === 'about' && <AboutScreen />}
      </div>
    </GameStoreProvider>
  );
}
