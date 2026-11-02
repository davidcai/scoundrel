import { useCallback, useEffect, useReducer, useState } from 'react';
import { isMonster, type RuleConfig } from './engine';
import { AnnouncerProvider } from './ui/components/Announcer';
import { PlayScreen } from './ui/screens/PlayScreen';
import { ResultScreen } from './ui/screens/ResultScreen';
import { TitleScreen } from './ui/screens/TitleScreen';
import { createSession, sessionReducer, type UiSession } from './store/gameSession';
import { newRunSeed } from './store/seed';
import { PreferencesProvider, usePreferences } from './store/preferences';
import { currentRoute, navigate, parseRoute, playPath, type Route } from './ui/routes';

/**
 * Application shell: providers, hash route, and the session reducer. The engine
 * state lives in the session; selection/preview state never enters the engine.
 */
function AppRoot() {
  const { t } = usePreferences();
  const [session, dispatch] = useReducer(sessionReducer, null as UiSession | null);
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute());
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  // Keep one session matching the current play route, including direct links.
  useEffect(() => {
    if (route.name === 'title') {
      if (session !== null) dispatch({ type: 'clear' });
      return;
    }
    if (
      session !== null &&
      session.state.seed === route.seed &&
      session.state.config === route.config
    ) {
      return;
    }
    try {
      dispatch({ type: 'replace', session: createSession(route.seed, route.config) });
    } catch {
      dispatch({ type: 'clear' });
      navigate('/');
      setRoute({ name: 'title' });
    }
  }, [route, session]);

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  const startRun = useCallback((config: RuleConfig) => {
    const seed = newRunSeed();
    const path = playPath(seed, config);
    dispatch({ type: 'replace', session: createSession(seed, config) });
    navigate(path);
    setRoute(parseRoute(`#${path}`));
  }, []);

  const backToTitle = useCallback(() => {
    dispatch({ type: 'clear' });
    navigate('/');
    setRoute({ name: 'title' });
  }, []);

  const startAnotherRun = useCallback(() => {
    if (session !== null) startRun(session.state.config);
  }, [session, startRun]);

  return (
    <div className="app-shell">
      {route.name === 'title' ? <TitleScreen onStart={startRun} /> : null}
      {route.name === 'play' && session !== null ? (
        session.state.result === null ? (
          <PlayScreen key={session.runId} session={session} dispatch={dispatch} />
        ) : (
          <ResultScreen
            result={session.state.result}
            remainingMonsters={session.state.dungeon.filter(isMonster).length}
            onNewRun={startAnotherRun}
            onBackToTitle={backToTitle}
          />
        )
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <PreferencesProvider>
      <AnnouncerProvider>
        <AppRoot />
      </AnnouncerProvider>
    </PreferencesProvider>
  );
}

export default App;
