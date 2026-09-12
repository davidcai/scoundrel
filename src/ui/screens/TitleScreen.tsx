import { useState } from 'react';
import { randomSeed } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { loadSettings } from '../../store/settings';
import { navigate } from '../router';

export function TitleScreen() {
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
        <p className="title-tagline">A lone scoundrel. A deck of cards. One way out.</p>

        <nav className="title-menu" aria-label="Main menu">
          {game !== null && game.phase === 'playing' && (
            <button type="button" className="btn primary title-continue" onClick={continueRun}>
              Continue run ({game.seed})
            </button>
          )}
          <button type="button" className="btn primary" onClick={newRun}>
            New run
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={showSeedEntry}
            onClick={() => setShowSeedEntry((v) => !v)}
          >
            Enter seed
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
                Seed from a friend
              </label>
              <input
                id="seed-input"
                className="text-input"
                type="text"
                value={seedInput}
                placeholder="e.g. 1a2b3c"
                onChange={(e) => setSeedInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn">
                Play seed
              </button>
            </form>
          )}
          <button type="button" className="btn" onClick={() => navigate('#/stats')}>
            Stats
          </button>
          <button type="button" className="btn" onClick={() => navigate('#/settings')}>
            Settings
          </button>
          <button type="button" className="btn" onClick={() => navigate('#/about')}>
            About
          </button>
        </nav>
      </div>
    </main>
  );
}
