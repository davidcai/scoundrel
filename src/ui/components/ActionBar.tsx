import { useId, type RefObject } from 'react';
import { rejectionText } from '../../i18n/messages';
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
 * Room actions. Enter next room and Undo are rendered only while available;
 * Run away stays visible and, when the rules forbid it, references the visible
 * restriction line (REQ-004, design plan §5/§7). The run seed fills the
 * bottom-right corner of the same panel.
 */
export function ActionBar({
  availability,
  onEnterNextRoom,
  onRunAway,
  onUndo,
  enterButtonRef,
}: ActionBarProps) {
  const { t } = usePreferences();
  const helperId = useId();

  const runAwayReason =
    !availability.runAway.enabled && availability.runAway.reason !== null
      ? rejectionText(t, availability.runAway.reason)
      : null;

  return (
    <div className="action-bar" role="group" aria-label={t('play.actionBar')}>
      <div className="action-bar__actions">
        {availability.enterNextRoom.enabled ? (
          <Button ref={enterButtonRef} variant="primary" onClick={onEnterNextRoom}>
            {t('play.enterNextRoom')}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          aria-disabled={availability.runAway.enabled ? undefined : true}
          aria-describedby={runAwayReason === null ? undefined : helperId}
          onClick={availability.runAway.enabled ? onRunAway : undefined}
        >
          {t('play.runAway')}
        </Button>
        {availability.undoRoom.enabled ? (
          <Button variant="ghost" onClick={onUndo}>
            {t('play.undo')}
          </Button>
        ) : null}
      </div>
      {runAwayReason !== null ? (
        <p className="action-bar__helper" id={helperId} data-testid="action-reasons">
          <span className="action-bar__reason">
            {t('play.disabledAction', { action: t('play.runAway'), reason: runAwayReason })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
