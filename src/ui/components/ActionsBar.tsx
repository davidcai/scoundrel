/**
 * Actions bar (style guide §6.2): run-state context text left; Confirm /
 * Cancel (only while a selection is armed), Undo Room, Enter Next Room, and
 * Run Away (greyed with reason tooltip when blocked — never hidden) right.
 */
import { useGame, useGameStoreApi, type Selection } from '../../store/gameStore';
import { runAwayBlockText } from '../announce';
import { buildPreview, type Preview } from '../preview';
import { Tooltip } from './Tooltip';
import { useMemo } from 'react';
import './controls.css';

function contextText(
  selected: Selection | null,
  preview: Preview | null,
  canEnter: boolean,
): string {
  if (selected !== null && preview !== null) return `Confirm — ${preview.headline}?`;
  if (canEnter) return 'Room resolved — enter the next room when ready.';
  return 'Resolve 3 of the 4 room cards.';
}

export function ActionsBar() {
  const store = useGameStoreApi();
  const game = useGame((s) => s.game);
  const engine = useGame((s) => s.engine);
  const selected = useGame((s) => s.selected);

  const preview = useMemo(
    () =>
      game === null || selected === null
        ? null
        : buildPreview(engine, game, selected.cardId, selected.barehanded),
    [engine, game, selected],
  );

  if (game === null) return null;

  const runCheck = engine.canRunAway(game);
  const canUndo = game.phase === 'playing' && game.roomSnapshot !== null;
  const canEnterNextRoom =
    game.phase === 'playing' &&
    game.resolvedCount >= 3 &&
    game.room.length >= 1 &&
    game.dungeon.length > 0;

  return (
    <footer className="actions-bar">
      <span className="actions-context">{contextText(selected, preview, canEnterNextRoom)}</span>
      <div className="actions-buttons">
        {selected !== null && (
          <>
            <button
              type="button"
              className="btn btn--ember"
              onClick={() => store.getState().confirm()}
            >
              Confirm
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => store.getState().cancelSelection()}
            >
              Cancel
            </button>
            {preview?.kind === 'monster' && preview.hasWeapon && (
              <label className="actions-barehanded">
                <input
                  type="checkbox"
                  checked={selected.barehanded}
                  onChange={(e) => store.getState().setBarehanded(e.target.checked)}
                />
                Fight barehanded
              </label>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canUndo}
          onClick={() => store.getState().undo()}
        >
          ↺ Undo Room
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!canEnterNextRoom}
          onClick={() => store.getState().enterNextRoom()}
        >
          Enter Next Room
        </button>
        {runCheck.allowed ? (
          <button
            type="button"
            className="btn btn--danger-ghost"
            onClick={() => store.getState().runAway()}
          >
            Run Away
          </button>
        ) : (
          <Tooltip content={runAwayBlockText(runCheck.reason)}>
            {(described) => (
              <button
                type="button"
                className="btn btn--danger-ghost"
                aria-disabled="true"
                aria-describedby={described['aria-describedby']}
                onClick={(e) => e.preventDefault()}
              >
                Run Away
              </button>
            )}
          </Tooltip>
        )}
      </div>
    </footer>
  );
}
