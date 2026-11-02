import { useEffect, useRef, useState } from 'react';
import { translator, describeResult } from './i18n/translate';
import { decodeReplay, encodeReplay, validateSeed } from './engine';
import type { Action, GameConfig } from './engine';
import type { InitialSave } from './store/use-saved-game';
import { useSavedGame } from './store/use-saved-game';
import { StatsScreen } from './ui/StatsScreen';
import { PlayScreen } from './ui/PlayScreen';
import { ResultScreen } from './ui/ResultScreen';
import { titleArtwork } from './ui/card-image';

function showHash(hash: string) {
  history.replaceState(history.state, '', hash);
}

export function App({ initial }: { initial: InitialSave }) {
  const { data, dispatch, preferences, problem, isSaving, initialLinkError, retry } =
    useSavedGame(initial);
  const { session, preferences: settings } = data;
  const { language, reducedMotion, config } = settings;
  const setLanguage = (value: typeof language) => preferences({ language: value });
  const setReducedMotion = (value: boolean) => preferences({ reducedMotion: value });
  const [panel, setPanel] = useState<'settings' | 'about' | 'enterSeed' | 'replaceRun'>('about');
  const [linkError, setLinkError] = useState(initialLinkError);
  const [seedInput, setSeedInput] = useState('');
  const [seedError, setSeedError] = useState(false);
  const pendingRun = useRef<{ seed: string; rules: GameConfig } | null>(null);
  const main = useRef<HTMLElement>(null);
  const game = session.game;
  const onTitle = session.screen === 'title';
  const dialog = useRef<HTMLDialogElement>(null);
  const preferredLocale =
    navigator.languages
      .map((tag) => tag.split('-')[0].toLowerCase())
      .find((tag) => tag === 'en' || tag === 'zh') ?? 'en';
  const locale = language === 'auto' ? preferredLocale : language;
  const t = translator(locale);
  async function start(seed: string, rules = config) {
    validateSeed(seed);
    if (game?.status === 'playing') {
      pendingRun.current = { seed, rules };
      setPanel('replaceRun');
      if (!dialog.current?.open) dialog.current?.showModal();
      return;
    }
    await beginRun(seed, rules);
  }
  async function beginRun(seed: string, rules: GameConfig) {
    if (!(await dispatch({ type: 'start', seed, config: rules }))) return;
    showHash(encodeReplay(seed, rules));
    setLinkError(false);
    dialog.current?.close();
  }
  useEffect(() => {
    if (panel === 'replaceRun') dialog.current?.querySelector('button')?.focus();
  }, [panel]);
  function newRun() {
    start(crypto.getRandomValues(new Uint32Array(1))[0].toString(36));
  }
  async function title() {
    if (await dispatch({ type: 'title' })) showHash('#/');
  }
  async function continueRun() {
    if (game) {
      if (await dispatch({ type: 'continue' })) showHash(encodeReplay(game.seed, game.config));
    }
  }
  function act(action: Action) {
    dispatch({ type: 'act', action });
  }
  useEffect(() => {
    main.current?.focus();
  }, [session.screen, game?.status]);
  useEffect(() => {
    async function change() {
      if (location.hash === '#main') return;
      if (!location.hash || location.hash === '#/') {
        dispatch({ type: 'title' });
        return;
      }
      try {
        const { seed, config: rules } = decodeReplay(location.hash);
        if (!(await dispatch({ type: 'start', seed, config: rules }))) return;
        setLinkError(false);
      } catch {
        setLinkError(true);
      }
    }
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  function openPanel(next: 'settings' | 'about' | 'enterSeed') {
    setPanel(next);
    setSeedError(false);
    dialog.current?.showModal();
  }

  return (
    <>
      {problem && (
        <div className="save-notice" role="alert">
          <p>
            {t(
              problem === 'unreadable'
                ? 'saveUnreadable'
                : problem === 'unsupported'
                  ? 'saveUnsupported'
                  : problem === 'unavailable'
                    ? 'saveUnavailable'
                    : problem === 'conflict'
                      ? 'saveConflict'
                      : 'saveFailed',
            )}
          </p>
          {problem === 'write-failed' ? (
            <button onClick={retry}>{t('retrySave')}</button>
          ) : (
            <button
              onClick={() => {
                history.replaceState(null, '', '#/');
                location.reload();
              }}
            >
              {t('reloadSave')}
            </button>
          )}
        </div>
      )}
      <div
        className="shell"
        data-reduced-motion={reducedMotion}
        data-save-status={isSaving ? 'saving' : problem ? 'unsaved' : 'saved'}
        inert={problem === 'conflict'}
      >
        <a
          className="skip"
          href="#main"
          onClick={(event) => {
            event.preventDefault();
            main.current?.focus();
            main.current?.scrollIntoView();
          }}
        >
          {t('skip')}
        </a>
        {session.screen === 'play' && game?.status !== 'playing' && (
          <header className="topbar">
            <div className="wordmark">
              <span className="mark" aria-hidden="true" />
              <span className="brand">{t('gameName')}</span>
            </div>
            {!onTitle && (
              <nav className="nav" aria-label={t('mainMenu')}>
                <>
                  <span className="tag">
                    {t(
                      game &&
                        (game.config.allowConsecutiveEscapes ||
                          game.config.unlimitedPotions ||
                          !game.config.weaponDegradation)
                        ? 'customRules'
                        : 'defaultRules',
                    )}
                  </span>
                  <button onClick={title}>{t('menu')}</button>
                </>
                <button onClick={() => openPanel('settings')}>{t('settings')}</button>
                <button onClick={() => openPanel('about')}>{t('about')}</button>
              </nav>
            )}
          </header>
        )}
        {linkError && (
          <p className="link-error" role="alert">
            {t('invalidReplay')}
          </p>
        )}
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className={onTitle ? 'title-layout' : 'play-screen'}
        >
          {onTitle ? (
            <>
              <section className="intro" aria-labelledby="title">
                <p className="kicker">{t('kicker')}</p>
                <div className="intro-copy">
                  <h1 id="title">
                    <svg className="game-icon" viewBox="0 0 40 48" fill="none" aria-hidden="true">
                      <rect x="4" y="3" width="30" height="40" rx="4" transform="rotate(-6 4 3)" />
                      <path d="M12 39V23a8 8 0 0 1 16 0v16M9 39h22" />
                      <path className="game-icon-door" d="M16 39V24a4 4 0 0 1 8 0v15Z" />
                      <path d="M18 9h4M20 7v4" />
                    </svg>
                    <span>{t('gameName')}</span>
                  </h1>
                  <p className="lead">
                    <span>{t('leadOne')}</span> <span>{t('leadTwo')}</span>{' '}
                    <span>{t('leadThree')}</span>
                  </p>
                  <p className="game-description muted">{t('gameDescription')}</p>
                </div>
                <div className="start">
                  {game?.status === 'playing' && (
                    <button className="primary wide" onClick={continueRun}>
                      {t('continueRun')}
                    </button>
                  )}
                  <button
                    className={game?.status === 'playing' ? 'wide' : 'primary wide new-run-full'}
                    onClick={newRun}
                  >
                    {t('newRun')}
                  </button>
                  {game?.status === 'playing' && (
                    <button
                      onClick={async () => {
                        if (await dispatch({ type: 'discard' })) showHash('#/');
                      }}
                    >
                      {t('discardRun')}
                    </button>
                  )}
                  <button
                    className={game?.status === 'playing' ? 'wide' : 'wide new-run-full'}
                    onClick={() => openPanel('enterSeed')}
                  >
                    {t('enterSeed')}
                  </button>
                  <nav className="title-links" aria-label={t('mainMenu')}>
                    <button onClick={() => dispatch({ type: 'stats' })}>{t('stats')}</button>
                    <button onClick={() => openPanel('settings')}>{t('settings')}</button>
                    <button onClick={() => openPanel('about')}>{t('about')}</button>
                  </nav>
                </div>
              </section>
              <div className="fan" role="group" aria-label={t('fanLabel')}>
                <img
                  className="one"
                  src={titleArtwork.weapon}
                  alt={t('weaponAlt')}
                  width="1024"
                  height="1536"
                />
                <img
                  className="two"
                  src={titleArtwork.potion}
                  alt={t('potionAlt')}
                  width="1024"
                  height="1536"
                />
                <img
                  className="three"
                  src={titleArtwork.monster}
                  alt={t('monsterAlt')}
                  width="1024"
                  height="1536"
                />
                <div className="fan-caption">
                  <strong>{t('fanTitle')}</strong>
                </div>
              </div>
            </>
          ) : session.screen === 'stats' ? (
            <StatsScreen
              session={session}
              locale={locale}
              t={t}
              onReplay={(record) => start(record.seed, record.config)}
              onTitle={title}
            />
          ) : game?.status === 'playing' ? (
            <PlayScreen
              game={game}
              selected={session.selected}
              t={t}
              onSelect={(cardId) => dispatch({ type: 'select', cardId })}
              onAct={act}
              onTitle={title}
            />
          ) : game ? (
            <ResultScreen
              game={game}
              t={t}
              onReplay={() => start(game.seed, game.config)}
              onTitle={title}
            />
          ) : null}
        </main>
        <p className="sr-only" role="status" aria-live="polite">
          {session.result && describeResult(session.result, t)}
        </p>
        <dialog
          ref={dialog}
          aria-labelledby="panel-title"
          aria-describedby={panel === 'replaceRun' ? 'replacement-note' : undefined}
          onClose={() => {
            pendingRun.current = null;
          }}
        >
          <div className="dialog-head">
            <h2 id="panel-title">{t(panel)}</h2>
            {panel !== 'replaceRun' && (
              <button autoFocus onClick={() => dialog.current?.close()}>
                {t('close')}
              </button>
            )}
          </div>
          {panel === 'replaceRun' ? (
            <div className="preferences">
              <p id="replacement-note">{t('replacementNote')}</p>
              <div className="confirmation-actions">
                <button autoFocus onClick={() => dialog.current?.close()}>
                  {t('cancel')}
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    const request = pendingRun.current;
                    if (!request) return;
                    pendingRun.current = null;
                    void beginRun(request.seed, request.rules);
                  }}
                >
                  {t('confirmNewRun')}
                </button>
              </div>
            </div>
          ) : panel === 'enterSeed' ? (
            <form
              className="preferences"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  validateSeed(seedInput);
                  start(seedInput);
                } catch {
                  setSeedError(true);
                }
              }}
            >
              <label htmlFor="seed-input">{t('seedLabel')}</label>
              <input
                id="seed-input"
                value={seedInput}
                maxLength={32}
                aria-describedby="seed-hint"
                aria-invalid={seedError}
                onChange={(event) => {
                  setSeedInput(event.target.value);
                  setSeedError(false);
                }}
              />
              <p id="seed-hint" className="muted">
                {t('seedHint')}
              </p>
              {seedError && <p role="alert">{t('invalidSeed')}</p>}
              <button className="primary" type="submit">
                {t('startSeed')}
              </button>
            </form>
          ) : panel === 'settings' ? (
            <div className="preferences">
              <label htmlFor="language">{t('language')}</label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as typeof language)}
              >
                <option value="auto">{t('automatic')}</option>
                <option value="en">{t('english')}</option>
                <option value="zh">{t('chinese')}</option>
              </select>
              <p className="muted">{t('rulesForNewRuns')}</p>
              {(['allowConsecutiveEscapes', 'unlimitedPotions', 'weaponDegradation'] as const).map(
                (key) => (
                  <div key={key}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={config[key]}
                        aria-describedby={
                          key === 'weaponDegradation' ? 'weapon-degradation-help' : undefined
                        }
                        onChange={(event) => {
                          const checked = event.target.checked;
                          void preferences((latest) => ({
                            config: { ...latest.config, [key]: checked },
                          }));
                        }}
                      />
                      {t(key)}
                    </label>
                    {key === 'weaponDegradation' && (
                      <p id="weapon-degradation-help" className="setting-help muted">
                        {t('weaponDegradationHelp')}
                      </p>
                    )}
                  </div>
                ),
              )}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(event) => setReducedMotion(event.target.checked)}
                />
                {t('reducedMotion')}
              </label>
            </div>
          ) : (
            <div className="about">
              <p className="muted">{t('defaultRules')}</p>
              <p>{t('aboutIntro')}</p>
              <p>{t('aboutRooms')}</p>
              <p>{t('aboutCombat')}</p>
              <p>{t('aboutEscape')}</p>
              <p>{t('credits')}</p>
              <p>
                <a href="https://stfj.net/art/2011/Scoundrel.pdf">{t('originalRules')}</a>
              </p>
              <p>
                <a href="https://github.com/davidcai/scoundrel">{t('sourceCode')}</a>
              </p>
            </div>
          )}
        </dialog>
      </div>
    </>
  );
}
