import type { RefObject } from 'react';
import { usePreferences } from '../../store/preferences';
import type { ActionAvailability } from '../../store/selectors';
import { Button } from './Button';

export interface ActionBarProps {
  availability: ActionAvailability;
  onEnterNextRoom: () => void;
  onRunAway: () => void;
  onUndo: () => void;
  /** Exposed so the play screen can move focus here after a room clears. */
  enterButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Room actions. Each action is rendered only while available; when none are
 * available the panel is omitted entirely. The run seed lives separately in
 * the page corner.
 */
export function ActionBar({
  availability,
  onEnterNextRoom,
  onRunAway,
  onUndo,
  enterButtonRef,
}: ActionBarProps) {
  const { t } = usePreferences();
  const hasActions =
    availability.enterNextRoom.enabled ||
    availability.runAway.enabled ||
    availability.undoRoom.enabled;

  if (!hasActions) return null;

  return (
    <div className="action-bar" role="group" aria-label={t('play.actionBar')}>
      <div className="action-bar__actions">
        {availability.enterNextRoom.enabled ? (
          <Button ref={enterButtonRef} variant="primary" onClick={onEnterNextRoom}>
            {t('play.enterNextRoom')}
          </Button>
        ) : null}
        {availability.runAway.enabled ? (
          <Button variant="secondary" onClick={onRunAway}>
            {t('play.runAway')}
          </Button>
        ) : null}
        {availability.undoRoom.enabled ? (
          <Button variant="ghost" onClick={onUndo}>
            {t('play.undo')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
