import { useState } from 'react';
import { finalScore, randomSeed, type GameState } from '../engine';
import { useT, type TFunc } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { loadSettings } from '../store/settings';
import { runUrl } from '../store/share';
import { navigate } from './router';

/** Win/Lose scorecard with run highlights and a copyable replay link. */
export function GameOverScreen({ game }: { game: GameState }) {
  const won = game.phase === 'won';
  const score = finalScore(game);
  const startRun = useGameStore((s) => s.startRun);
  const finishRun = useGameStore((s) => s.finishRun);
  const t = useT();
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
    <div className="gameover-overlay" role="dialog" aria-label={won ? t('victory') : t('defeat')}>
      <div className="gameover-card" data-outcome={won ? 'won' : 'lost'}>
        <h2 className="gameover-title">{won ? t('victory') : t('defeat')}</h2>
        <p className="gameover-subtitle">{won ? t('victorySub') : t('defeatSub')}</p>

        <dl className="scorecard">
          <div>
            <dt>{t('score')}</dt>
            <dd className="score-big" data-testid="final-score">
              {score}
            </dd>
          </div>
          <div>
            <dt>{t('finalHealth')}</dt>
            <dd>{won ? game.hp : Math.max(0, game.hp)}</dd>
          </div>
          <div>
            <dt>{t('seed')}</dt>
            <dd className="mono">{game.seed}</dd>
          </div>
          <div>
            <dt>{t('toggles')}</dt>
            <dd>{configSummary(game.config, t)}</dd>
          </div>
          <div>
            <dt>{t('monstersKilled')}</dt>
            <dd>{game.runHighlights.monstersKilled}</dd>
          </div>
          <div>
            <dt>{t('potionsWasted')}</dt>
            <dd>{game.runHighlights.potionsWasted}</dd>
          </div>
          <div>
            <dt>{t('roomsExplored')}</dt>
            <dd>{game.runHighlights.roomsExplored}</dd>
          </div>
        </dl>

        <div className="gameover-actions">
          <button type="button" className="btn primary" onClick={copyLink}>
            {copied ? t('linkCopied') : t('copyLink')}
          </button>
          <button type="button" className="btn" onClick={playAgain}>
            {t('playAgain')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              finishRun();
              navigate('#/');
            }}
          >
            {t('returnTitle')}
          </button>
        </div>
      </div>
    </div>
  );
}

function configSummary(config: GameState['config'], t: TFunc): string {
  const parts: string[] = [];
  parts.push(config.runAwayMode === 'once' ? t('configRunOnce') : t('configRunUnlimited'));
  parts.push(config.potionsPerRoom === 'one' ? t('configPotionOne') : t('configPotionUnlimited'));
  parts.push(config.weaponDegradation ? t('configDegOn') : t('configDegOff'));
  return parts.join(' · ');
}
