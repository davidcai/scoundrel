import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine';
import { useT } from '../i18n';
import { Tooltip } from './Tooltip';

/** Always-legible critical info: HP and deck count, plus the exit control. */
export function Hud({ game, onAbandon }: { game: GameState; onAbandon: () => void }) {
  const t = useT();
  const hpPct = Math.max(0, Math.min(100, (game.hp / game.maxHp) * 100));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen]);

  return (
    <header className="hud" aria-label={t('gameStatus')}>
      <div className="hud-group hp">
        <span className="hud-label">{t('health')}</span>
        <div
          className="hp-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={game.maxHp}
          aria-valuenow={game.hp}
          aria-label={t('currentHealth')}
        >
          <div className="hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="hud-value">
          {game.hp}/{game.maxHp}
        </span>
      </div>

      <div className="hud-cluster">
        <div className="hud-group">
          <span className="hud-label">{t('dungeon')}</span>
          <span className="hud-value">{t('cardsLeft', { count: game.dungeon.length })}</span>
        </div>

        <Tooltip text={t('tooltipAbandon')}>
          <button
            type="button"
            className="btn danger hud-exit"
            aria-label={t('abandonRun')}
            aria-haspopup="dialog"
            onClick={() => setConfirmOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {confirmOpen && (
        <div className="confirm-overlay" role="presentation" onClick={() => setConfirmOpen(false)}>
          <div
            className="confirm-card"
            role="dialog"
            aria-modal="true"
            aria-label={t('reallyAbandon')}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="confirm-title">{t('reallyAbandon')}</h2>
            <p className="confirm-body">{t('abandonConfirmBody')}</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn"
                ref={cancelRef}
                onClick={() => setConfirmOpen(false)}
              >
                {t('cancel')}
              </button>
              <button type="button" className="btn danger" onClick={onAbandon}>
                {t('abandonRun')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
