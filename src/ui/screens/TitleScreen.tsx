/**
 * Title screen (#/) per style guide §6.1: deck-art composite fan backdrop,
 * SCOUNDREL wordmark with ember glow, a single text-row menu column
 * (Continue when a save exists, New Run, Enter Seed, Stats, Settings, About),
 * and a quiet footer.
 */
import { useState } from 'react';
import type { CardId } from '../../engine';
import { loadRun } from '../../persistence/run';
import { loadSettings } from '../../persistence/settings';
import { randomSeed } from '../../store/gameStore';
import { cardArtUrl } from '../cards/cardArt';
import { navigate } from '../router/useHashRoute';
import { replayHash } from '../router/configCodec';
import './TitleScreen.css';

/** Backdrop fan: a dragon's hoard of the deck's most readable art. */
const BACKDROP_CARDS: readonly { id: CardId; rotate: number; offset: number }[] = [
  { id: 'spade-a', rotate: -14, offset: -3 },
  { id: 'club-k', rotate: -8, offset: -2 },
  { id: 'spade-q', rotate: -4, offset: -1 },
  { id: 'heart-8', rotate: 0, offset: 0 },
  { id: 'diamond-9', rotate: 4, offset: 1 },
  { id: 'club-j', rotate: 8, offset: 2 },
  { id: 'spade-10', rotate: 14, offset: 3 },
];

const SEED_PATTERN = /^[a-z0-9]+$/i;

export function TitleScreen() {
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const hasSave = loadRun() !== null;

  const startSeededRun = (seed: string) => {
    navigate(replayHash(seed, loadSettings()));
  };

  const submitSeed = () => {
    const seed = seedInput.trim();
    if (!SEED_PATTERN.test(seed)) return;
    startSeededRun(seed);
  };

  return (
    <main className="title-screen">
      <div className="title-backdrop" aria-hidden="true">
        {BACKDROP_CARDS.map(({ id, rotate, offset }) => {
          const url = cardArtUrl(id);
          if (url === undefined) return null;
          return (
            <span
              key={id}
              className="title-backdrop-card"
              style={
                {
                  '--fan-rot': `${rotate}deg`,
                  '--fan-x': offset,
                } as React.CSSProperties
              }
            >
              <img src={url} alt="" draggable={false} />
            </span>
          );
        })}
        <span className="title-backdrop-fade" />
        <span className="title-backdrop-torch" />
      </div>

      <h1 className="title-wordmark">Scoundrel</h1>
      <p className="title-subtitle">a dungeon solitaire</p>

      <nav className="title-menu" aria-label="Main menu">
        {hasSave && (
          <button
            type="button"
            className="title-menu-item title-menu-item--continue"
            onClick={() => navigate('#/play')}
          >
            Continue
          </button>
        )}
        <button
          type="button"
          className="title-menu-item"
          onClick={() => startSeededRun(randomSeed())}
        >
          New Run
        </button>
        <button
          type="button"
          className="title-menu-item"
          aria-expanded={seedOpen}
          onClick={() => setSeedOpen((open) => !open)}
        >
          Enter Seed
        </button>
        {seedOpen && (
          <form
            className="title-seed-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitSeed();
            }}
          >
            <label className="micro-label" htmlFor="seed-input">
              Seed
            </label>
            <input
              id="seed-input"
              className="title-seed-input"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="a3f9k2"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="btn btn--ember"
              disabled={!SEED_PATTERN.test(seedInput.trim())}
            >
              Start
            </button>
          </form>
        )}
        <button type="button" className="title-menu-item" onClick={() => navigate('#/stats')}>
          Stats
        </button>
        <button type="button" className="title-menu-item" onClick={() => navigate('#/settings')}>
          Settings
        </button>
        <button type="button" className="title-menu-item" onClick={() => navigate('#/about')}>
          About
        </button>
      </nav>

      <footer className="title-footer">
        <span>v0.1</span>
        <span aria-hidden="true">·</span>
        <a href="http://stfj.net/art/2011/Scoundrel.pdf" target="_blank" rel="noreferrer">
          Original Scoundrel rules (PDF)
        </a>
      </footer>
    </main>
  );
}
