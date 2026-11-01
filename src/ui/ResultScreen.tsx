import { useState } from 'react';
import type { FinishedRun } from '../store/session';
import type { Translate } from '../i18n/translate';
import { encodeReplay } from '../engine';
export function ResultScreen({
  game,
  t,
  onReplay,
  onTitle,
}: {
  game: FinishedRun;
  t: Translate;
  onReplay: () => void;
  onTitle: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<'copied' | 'copyFailed' | null>(null);
  const replay = new URL(encodeReplay(game.seed, game.config), window.location.href).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(replay);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('copyFailed');
    }
  }
  return (
    <section className="result-screen">
      <p className="kicker">{t('gameName')}</p>
      <h1>{t(game.status === 'won' ? 'won' : 'lost')}</h1>
      <div className="result-score">
        <span>{t('score')}</span>
        <strong>{game.score}</strong>
      </div>
      <dl className="result-details">
        <div>
          <dt>{t('health')}</dt>
          <dd>{game.board.health} / 20</dd>
        </div>
        <div>
          <dt>{t('seed')}</dt>
          <dd>{game.seed}</dd>
        </div>
        {(['roomsExplored', 'roomsCleared', 'monstersDefeated', 'potionsWasted'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{game.board.highlights[key]}</dd>
            </div>
          ),
        )}
      </dl>
      <h2>{t('runRules')}</h2>
      <dl className="result-details">
        {(['allowConsecutiveEscapes', 'unlimitedPotions', 'weaponDegradation'] as const).map(
          (key) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{t(game.config[key] ? 'on' : 'off')}</dd>
            </div>
          ),
        )}
      </dl>
      <div className="result-actions">
        <button className="primary" onClick={onReplay}>
          {t('replayRun')}
        </button>
        <button onClick={copy}>{t('copyReplay')}</button>
        <button onClick={onTitle}>{t('backTitle')}</button>
      </div>
      <label htmlFor="replay-link">{t('replayLink')}</label>
      <input id="replay-link" value={replay} readOnly onFocus={(event) => event.target.select()} />
      <p role="status">{copyStatus && t(copyStatus)}</p>
    </section>
  );
}
