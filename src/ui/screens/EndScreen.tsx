/**
 * Win/lose scorecard (Q38c): outcome, final HP, score, seed, toggles, run
 * highlights, and a copyable replay link. Rendered inside #/play whenever the
 * run is terminal — the persisted outcome makes it survive reload (Q42).
 */
import { useEffect, useRef, useState } from 'react';
import { useGame, useGameStoreApi } from '../../store/gameStore';
import { encodeConfig, replayUrl } from '../router/configCodec';
import { navigate } from '../router/useHashRoute';
import './EndScreen.css';

function configSummary(config: {
  runAwayMode: string;
  potionsPerRoom: number;
  weaponDegradation: boolean;
}): string {
  const run = config.runAwayMode === 'once' ? 'run-away once' : 'run-away unlimited';
  const potions = config.potionsPerRoom === 1 ? 'one potion per room' : 'unlimited potions';
  const degradation = config.weaponDegradation ? 'weapon degradation on' : 'weapon degradation off';
  return `${run} · ${potions} · ${degradation}`;
}

export function EndScreen() {
  const store = useGameStoreApi();
  const game = useGame((s) => s.game);
  const outcome = useGame((s) => s.outcome);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const won = outcome?.phase === 'won' || game?.phase === 'won';

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (game === null) return null;
  const score = outcome?.score ?? (won ? game.hp : 0);
  const highlights = game.runHighlights;
  const url = replayUrl(game.seed, game.config);

  const copyLink = () => {
    try {
      void navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the link text stays visible */
    }
  };

  return (
    <main className={won ? 'end-screen end-screen--won' : 'end-screen end-screen--lost'}>
      <div className="scorecard">
        <h1 className="scorecard-outcome" tabIndex={-1} ref={headingRef}>
          {won ? 'You survived the dungeon' : 'You died in the dungeon'}
        </h1>
        <p className="scorecard-score tabular" aria-label={`Final score ${score}`}>
          {score}
        </p>
        <p className="scorecard-sub">final score</p>
        <dl className="scorecard-grid">
          <div>
            <dt>Final HP</dt>
            <dd className="tabular">{game.hp}</dd>
          </div>
          <div>
            <dt>Monsters slain</dt>
            <dd className="tabular">{highlights.monstersKilled}</dd>
          </div>
          <div>
            <dt>Potions wasted</dt>
            <dd className="tabular">{highlights.potionsWasted}</dd>
          </div>
          <div>
            <dt>Rooms explored</dt>
            <dd className="tabular">{highlights.roomsExplored}</dd>
          </div>
        </dl>
        <p className="scorecard-config">
          Seed <span className="scorecard-seed">{game.seed}</span> · {configSummary(game.config)}
        </p>
        <div className="scorecard-replay">
          <button type="button" className="btn btn--ember" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy replay link'}
          </button>
          <code className="scorecard-url">
            #/play?seed={game.seed}&config={encodeConfig(game.config)}
          </code>
        </div>
        <div className="scorecard-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              store.getState().backToTitle();
              navigate('#/');
            }}
          >
            Back to title
          </button>
        </div>
      </div>
    </main>
  );
}
