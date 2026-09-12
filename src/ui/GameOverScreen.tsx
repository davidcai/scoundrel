import { useState } from 'react';
import { finalScore, type GameState } from '../engine';
import { runUrl } from '../store/share';
import { randomSeed } from '../engine';
import { useGameStore } from '../store/gameStore';
import { loadSettings } from '../store/settings';
import { navigate } from './router';

/** Win/Lose scorecard with run highlights and a copyable replay link. */
export function GameOverScreen({ game }: { game: GameState }) {
  const won = game.phase === 'won';
  const score = finalScore(game);
  const startRun = useGameStore((s) => s.startRun);
  const finishRun = useGameStore((s) => s.finishRun);
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}${window.location.pathname}${runUrl(game.seed, game.config)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context): fall back.
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
    }
  };

  const playAgain = () => {
    const seed = randomSeed();
    startRun(seed, loadSettings().config);
    navigate('#/play');
  };

  return (
    <div className="gameover-overlay" role="dialog" aria-label={won ? 'Victory' : 'Defeat'}>
      <div className="gameover-card" data-outcome={won ? 'won' : 'lost'}>
        <h2 className="gameover-title">{won ? 'Victory' : 'Defeat'}</h2>
        <p className="gameover-subtitle">
          {won
            ? 'You clear every room of the dungeon.'
            : 'You fall in the dark. The dungeon claims another scoundrel.'}
        </p>

        <dl className="scorecard">
          <div>
            <dt>Score</dt>
            <dd className="score-big" data-testid="final-score">
              {score}
            </dd>
          </div>
          <div>
            <dt>Final health</dt>
            <dd>{won ? game.hp : Math.max(0, game.hp)}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd className="mono">{game.seed}</dd>
          </div>
          <div>
            <dt>Toggles</dt>
            <dd>{configSummary(game.config)}</dd>
          </div>
          <div>
            <dt>Monsters killed</dt>
            <dd>{game.runHighlights.monstersKilled}</dd>
          </div>
          <div>
            <dt>Potions wasted</dt>
            <dd>{game.runHighlights.potionsWasted}</dd>
          </div>
          <div>
            <dt>Rooms explored</dt>
            <dd>{game.runHighlights.roomsExplored}</dd>
          </div>
        </dl>

        <div className="gameover-actions">
          <button type="button" className="btn primary" onClick={copyLink}>
            {copied ? 'Replay link copied!' : 'Copy replay link'}
          </button>
          <button type="button" className="btn" onClick={playAgain}>
            Play again
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              finishRun();
              navigate('#/');
            }}
          >
            Return to title
          </button>
        </div>
      </div>
    </div>
  );
}

function configSummary(config: GameState['config']): string {
  const parts: string[] = [];
  parts.push(config.runAwayMode === 'once' ? 'run away: once' : 'run away: unlimited');
  parts.push(config.potionsPerRoom === 'one' ? 'potions: 1/room' : 'potions: unlimited');
  parts.push(config.weaponDegradation ? 'degradation: on' : 'degradation: off');
  return parts.join(' · ');
}
