import { useState } from 'react';
import { randomSeed } from '../../engine';
import { useT } from '../../i18n';
import { useGameStore } from '../../store/game-store';
import { loadSettings } from '../../store/settings';
import { navigate } from '../router';

export function TitleScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const startRun = useGameStore((s) => s.startRun);
  const [seedInput, setSeedInput] = useState('');
  const [showSeedEntry, setShowSeedEntry] = useState(false);

  const newRun = () => {
    startRun(randomSeed(), loadSettings().config);
    navigate('#/play');
  };

  const continueRun = () => navigate('#/play');

  const startSeeded = () => {
    const seed = seedInput.trim();
    if (seed === '') return;
    startRun(seed, loadSettings().config);
    navigate('#/play');
  };

  return (
    <main className="screen title">
      <div className="title-art" aria-hidden="true" />
      <div className="title-inner">
        <h1 className="title-word">Scoundrel</h1>
        <p className="title-tagline">{t('tagline')}</p>

        <nav className="title-menu" aria-label={t('mainMenu')}>
          {game !== null && game.phase === 'playing' && (
            <button type="button" className="btn primary title-continue" onClick={continueRun}>
              {t('continueRun', { seed: game.seed })}
            </button>
          )}
          <button type="button" className="btn primary" onClick={newRun}>
            {t('newRun')}
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={showSeedEntry}
            onClick={() => setShowSeedEntry((v) => !v)}
          >
            {t('enterSeed')}
          </button>
          {showSeedEntry && (
            <form
              className="seed-entry"
              onSubmit={(e) => {
                e.preventDefault();
                startSeeded();
              }}
            >
              <label htmlFor="seed-input" className="hud-label">
                {t('seedFromFriend')}
              </label>
              <input
                id="seed-input"
                className="text-input"
                type="text"
                value={seedInput}
                placeholder={t('seedPlaceholder')}
                onChange={(e) => setSeedInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn">
                {t('playSeed')}
              </button>
            </form>
          )}
          <button type="button" className="btn" onClick={() => navigate('#/stats')}>
            {t('stats')}
          </button>
          <button type="button" className="btn" onClick={() => navigate('#/settings')}>
            {t('settings')}
          </button>
          <button type="button" className="btn" onClick={() => navigate('#/about')}>
            {t('about')}
          </button>
        </nav>
      </div>
    </main>
  );
}
