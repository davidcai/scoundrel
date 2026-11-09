import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  DEFAULT_RULE_CONFIG,
  isMonster,
  ruleOptions,
  type GameState,
  type RuleConfig,
  type RuleOptionName,
  type RuleOptions,
} from './engine';
import { resolveLocale } from './i18n';
import { saveFailureText, startFailureText, type SaveFailureReason } from './i18n/messages';
import {
  ScoundrelStoreProvider,
  createScoundrelStore,
  useScoundrelSnapshot,
  useScoundrelStore,
  type ScoundrelStore,
  type StartedRun,
  type StoredSettings,
} from './store';
import { createSessionFromState, sessionReducer, type UiSession } from './store/gameSession';
import { PreferencesProvider, usePreferences } from './store/preferences';
import { AnnouncerProvider, useAnnounce } from './ui/components/Announcer';
import { StorageNotice } from './ui/components/StorageNotice';
import { PlayScreen } from './ui/screens/PlayScreen';
import { ResultScreen } from './ui/screens/ResultScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { StatsScreen } from './ui/screens/StatsScreen';
import { TitleScreen, type StartOutcome } from './ui/screens/TitleScreen';
import {
  SETTINGS_PATH,
  STATS_PATH,
  currentRoute,
  navigate,
  parseRoute,
  playPath,
  type Route,
} from './ui/routes';
import { Button } from './ui/components/Button';

/** Which saved run the current interface session belongs to (REQ-010). */
interface RunBinding {
  storeRunId: string;
  seed: string;
  config: RuleConfig;
  /** The engine state last persisted by this tab, to detect another tab's writes. */
  lastSavedState: GameState;
  completedHandled: boolean;
}

interface ShellNotice {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

function browserDefaultSettings(): StoredSettings {
  if (typeof navigator === 'undefined') return { locale: 'en', reducedMotion: null };
  return { locale: resolveLocale(navigator.languages), reducedMotion: null };
}

function sessionOnlyFor(snapshot: ReturnType<typeof useScoundrelSnapshot>): boolean {
  if (!snapshot.storageAvailable) return true;
  if (snapshot.recovery.some((issue) => issue.shard === 'run')) return true;
  return snapshot.warnings.some(
    (warning) => warning.kind === 'write-failed' && warning.shard === 'run',
  );
}

/**
 * Application shell: saved-run store, hash route, transient interface session,
 * and the persistence effects that keep the saved run in step with play
 * (REQ-001/REQ-008/REQ-009/REQ-010).
 */
function AppRoot() {
  const store = useScoundrelStore();
  const snapshot = useScoundrelSnapshot();
  const announce = useAnnounce();
  const { t } = usePreferences();

  // Primitive snapshot facts that change when another tab writes. The
  // adoption effect below must depend on them to re-run after a refresh, but
  // it reads the store directly because this render's snapshot may predate
  // this tab's own save.
  const activeRunId = snapshot.activeRun?.runId ?? null;
  const activeRunState = snapshot.activeRun?.state ?? null;
  const completedRunId = snapshot.completedResult?.runId ?? null;

  const [session, dispatch] = useReducer(sessionReducer, null as UiSession | null);
  const [route, setRoute] = useState<Route>(currentRoute);
  const [ruleOptionsState, setRuleOptionsState] = useState<RuleOptions>(() =>
    ruleOptions(DEFAULT_RULE_CONFIG),
  );
  const [notice, setNotice] = useState<ShellNotice | null>(null);
  const bindingRef = useRef<RunBinding | null>(null);
  const noticeIdRef = useRef(0);

  const pushNotice = useCallback(
    (kind: ShellNotice['kind'], text: string) => {
      noticeIdRef.current += 1;
      setNotice({ id: noticeIdRef.current, kind, text });
      announce(text, kind === 'error' ? 'assertive' : 'polite');
    },
    [announce],
  );

  const clearSession = useCallback(() => {
    bindingRef.current = null;
    dispatch({ type: 'clear' });
  }, []);

  const toggleRuleOption = useCallback((name: RuleOptionName) => {
    setRuleOptionsState((previous) => ({ ...previous, [name]: !previous[name] }));
  }, []);

  const beginSession = useCallback((run: StartedRun) => {
    bindingRef.current = {
      storeRunId: run.runId,
      seed: run.seed,
      config: run.config,
      lastSavedState: run.state,
      completedHandled: false,
    };
    dispatch({ type: 'replace', session: createSessionFromState(run.state) });
    const path = playPath(run.seed, run.config);
    navigate(path);
    setRoute(parseRoute(`#${path}`));
  }, []);

  // Keep the hash route in sync with back/forward navigation.
  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute());
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  // The title route is not a running session; the saved run stays resumable.
  useEffect(() => {
    if (route.name === 'title' && session !== null) clearSession();
  }, [route.name, session, clearSession]);

  // Restore the active saved run (reload/Continue) or start an explicit fresh
  // attempt from a play link. A link in the URL is an explicit start (REQ-014).
  useEffect(() => {
    if (route.name !== 'play') return;
    if (
      session !== null &&
      session.state.seed === route.seed &&
      session.state.config === route.config
    ) {
      return;
    }

    const current = store.getSnapshot();
    const active = current.activeRun;
    if (active !== null && active.seed === route.seed && active.config === route.config) {
      bindingRef.current = {
        storeRunId: active.runId,
        seed: active.seed,
        config: active.config,
        lastSavedState: active.state,
        completedHandled: false,
      };
      dispatch({ type: 'replace', session: createSessionFromState(active.state) });
      return;
    }

    if (
      current.completedResult !== null &&
      current.completedResult.seed === route.seed &&
      current.completedResult.config === route.config
    ) {
      return; // rendered from the saved completed result
    }

    // Direct play URLs remain an internal/testing entry point; the player UI
    // exposes seed entry only.
    const started = store.startFromSharedLink(
      `#${playPath(route.seed, route.config)}`,
      route.config,
    );
    if (started.ok) {
      beginSession(started.run);
      return;
    }
    pushNotice('error', startFailureText(t, started.reason));
    clearSession();
    navigate('/');
    setRoute({ name: 'title' });
  }, [route, session, store, t, beginSession, clearSession, pushNotice]);

  // Persist after every applied action (REQ-010).
  useEffect(() => {
    if (route.name !== 'play' || session === null) return;
    const binding = bindingRef.current;
    if (binding === null) return;
    if (binding.seed !== session.state.seed || binding.config !== session.state.config) return;
    if (session.state.status !== 'playing') return;
    if (binding.lastSavedState === session.state) return;

    const result = store.saveRunState(binding.storeRunId, session.state);
    binding.lastSavedState = session.state;
    if (result.ok) return;

    pushNotice('error', saveFailureText(t, result.reason));
    if (result.reason === 'run-replaced' || result.reason === 'run-completed') {
      store.refresh();
      clearSession();
      if (result.reason === 'run-replaced') {
        navigate('/');
        setRoute({ name: 'title' });
      }
    }
  }, [route.name, session, store, t, clearSession, pushNotice]);

  // Record the completed outcome exactly once (completeRun is idempotent).
  useEffect(() => {
    if (route.name !== 'play' || session === null) return;
    if (session.state.status === 'playing') return;
    const binding = bindingRef.current;
    if (binding === null || binding.completedHandled) return;
    binding.completedHandled = true;

    const result = store.completeRun(binding.storeRunId, session.state);
    if (!result.ok) {
      pushNotice('error', saveFailureText(t, result.reason as SaveFailureReason));
      store.refresh();
    }
  }, [route.name, session, store, t, pushNotice]);

  // Adopt another tab's saved run without dropping an in-flight selection.
  // Read the store directly: this tab's own save effect may have just persisted
  // a newer state than the snapshot this render was based on.
  useEffect(() => {
    if (route.name !== 'play' || session === null) return;
    const binding = bindingRef.current;
    if (binding === null) return;
    if (session.state.status !== 'playing') return;

    const current = store.getSnapshot();
    const active = current.activeRun;
    if (active !== null && active.runId === binding.storeRunId) {
      if (active.state === session.state) return;
      const selection = session.selectedCard;
      binding.lastSavedState = active.state;
      dispatch({ type: 'replace', session: createSessionFromState(active.state) });
      if (
        selection !== null &&
        active.state.room.cards.some((roomCard) => roomCard.card === selection)
      ) {
        dispatch({ type: 'select', card: selection });
      }
      return;
    }

    if (active === null && current.completedResult?.runId === binding.storeRunId) {
      // Another tab finished this run: show the saved result.
      clearSession();
      return;
    }

    if (active !== null && active.runId !== binding.storeRunId) {
      pushNotice('error', saveFailureText(t, 'run-replaced'));
      clearSession();
      navigate('/');
      setRoute({ name: 'title' });
    }
  }, [
    route.name,
    session,
    store,
    t,
    clearSession,
    pushNotice,
    activeRunId,
    activeRunState,
    completedRunId,
  ]);

  // Re-read saved shards when the window regains focus (cross-tab refresh).
  useEffect(() => {
    const refresh = () => store.refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [store]);

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  const handleNewRun = useCallback(
    (config: RuleConfig): StartOutcome => {
      const result = store.startNewRun(config);
      if (!result.ok) return result.reason;
      beginSession(result.run);
      return null;
    },
    [store, beginSession, pushNotice, t],
  );

  const handleContinue = useCallback((): StartOutcome => {
    const active = store.getSnapshot().activeRun;
    if (active === null) return null;
    bindingRef.current = {
      storeRunId: active.runId,
      seed: active.seed,
      config: active.config,
      lastSavedState: active.state,
      completedHandled: false,
    };
    dispatch({ type: 'replace', session: createSessionFromState(active.state) });
    const path = playPath(active.seed, active.config);
    navigate(path);
    setRoute(parseRoute(`#${path}`));
    return null;
  }, [store]);

  const handleStartSeed = useCallback(
    (seed: string, config: RuleConfig): StartOutcome => {
      const result = store.startRunWithSeed(seed, config);
      if (!result.ok) return result.reason;
      beginSession(result.run);
      return null;
    },
    [store, beginSession, pushNotice, t],
  );

  const handleViewLastResult = useCallback(() => {
    const completed = store.getSnapshot().completedResult;
    if (completed === null) return;
    const path = playPath(completed.seed, completed.config);
    navigate(path);
    setRoute(parseRoute(`#${path}`));
  }, [store]);

  const handleReplay = useCallback(
    (runId: string) => {
      const result = store.replayHistoryEntry(runId);
      if (!result.ok) {
        pushNotice('error', startFailureText(t, result.reason));
        return;
      }
      beginSession(result.run);
    },
    [store, beginSession, pushNotice, t],
  );

  const backToTitle = useCallback(() => {
    clearSession();
    navigate('/');
    setRoute({ name: 'title' });
  }, [clearSession]);

  const openStatistics = useCallback(() => {
    navigate(STATS_PATH);
    setRoute({ name: 'stats' });
  }, []);

  const openSettings = useCallback(() => {
    navigate(SETTINGS_PATH);
    setRoute({ name: 'settings' });
  }, []);

  const resultConfig =
    session?.state.config ?? snapshot.completedResult?.config ?? DEFAULT_RULE_CONFIG;
  const handleNewRunFromResult = useCallback(() => {
    handleNewRun(resultConfig);
  }, [handleNewRun, resultConfig]);

  const activeRun = snapshot.activeRun;
  const completedResult = snapshot.completedResult;
  const sessionMatchesRoute =
    route.name === 'play' &&
    session !== null &&
    session.state.seed === route.seed &&
    session.state.config === route.config;
  const sessionResult = session !== null ? session.state.result : null;
  const storedResultMatchesRoute =
    route.name === 'play' &&
    session === null &&
    completedResult !== null &&
    completedResult.seed === route.seed &&
    completedResult.config === route.config;

  return (
    <div className="app-shell">
      <StorageNotice />

      {notice !== null ? (
        <div className={`shell-notice shell-notice--${notice.kind}`} data-testid="shell-notice">
          <p className="shell-notice__text">{notice.text}</p>
          <Button variant="ghost" onClick={() => setNotice(null)}>
            {t('storage.dismiss')}
          </Button>
        </div>
      ) : null}

      {route.name === 'title' ? (
        <TitleScreen
          activeRun={activeRun}
          hasCompletedResult={completedResult !== null}
          onNewRun={handleNewRun}
          onContinue={handleContinue}
          onStartSeed={handleStartSeed}
          ruleOptions={ruleOptionsState}
          onViewLastResult={handleViewLastResult}
          onOpenStatistics={openStatistics}
          onOpenSettings={openSettings}
        />
      ) : null}

      {route.name === 'stats' ? (
        <StatsScreen onBackToTitle={backToTitle} onReplay={handleReplay} />
      ) : null}

      {route.name === 'settings' ? (
        <SettingsScreen
          ruleOptions={ruleOptionsState}
          onToggleRule={toggleRuleOption}
          onClose={backToTitle}
        />
      ) : null}

      {route.name === 'play' && sessionMatchesRoute ? (
        sessionResult === null ? (
          <PlayScreen
            key={session.runId}
            session={session}
            dispatch={dispatch}
            sessionOnly={sessionOnlyFor(snapshot)}
            onBackToTitle={backToTitle}
          />
        ) : (
          <ResultScreen
            result={sessionResult}
            remainingMonsters={session.state.dungeon.filter(isMonster).length}
            onNewRun={handleNewRunFromResult}
            onBackToTitle={backToTitle}
            onViewStatistics={openStatistics}
          />
        )
      ) : null}

      {storedResultMatchesRoute ? (
        <ResultScreen
          result={completedResult.result}
          remainingMonsters={completedResult.state.dungeon.filter(isMonster).length}
          onNewRun={handleNewRunFromResult}
          onBackToTitle={backToTitle}
          onViewStatistics={openStatistics}
        />
      ) : null}
    </div>
  );
}

export interface AppProps {
  /** Injected store for tests; the browser app creates one persistent store. */
  store?: ScoundrelStore;
}

export function App({ store }: AppProps = {}) {
  const [defaultStore] = useState(() =>
    createScoundrelStore({ defaultSettings: browserDefaultSettings() }),
  );
  const activeStore = store ?? defaultStore;
  return (
    <ScoundrelStoreProvider store={activeStore}>
      <PreferencesProvider>
        <AnnouncerProvider>
          <AppRoot />
        </AnnouncerProvider>
      </PreferencesProvider>
    </ScoundrelStoreProvider>
  );
}

export default App;
