import { forwardRef, useId, type RefObject } from 'react';
import { rejectionText } from '../../i18n/messages';
import { usePreferences } from '../../store/preferences';
import type { ActionAvailability } from '../../store/selectors';
import { Button } from './Button';

export interface ActionBarProps {
  availability: ActionAvailability;
  onEnterNextRoom: () => void;
  onRunAway: () => void;
  onUndo: () => void;
  onHelp: () => void;
  /** Exposed so the play screen can move focus here after a room clears. */
  enterButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Sticky room actions. Unavailable actions stay focusable (`aria-disabled`) and
 * their rule is shown in a visible helper line that each disabled button
 * references with `aria-describedby` (REQ-004, design plan §5/§7). The helper is
 * visible at every breakpoint, including compact.
 */
export const ActionBar = forwardRef<HTMLDivElement, ActionBarProps>(function ActionBar(
  { availability, onEnterNextRoom, onRunAway, onUndo, onHelp, enterButtonRef },
  containerRef,
) {
  const { t } = usePreferences();
  const helperId = useId();

  const unavailable = [
    { label: t('play.enterNextRoom'), availability: availability.enterNextRoom },
    { label: t('play.runAway'), availability: availability.runAway },
    { label: t('play.undo'), availability: availability.undoRoom },
  ].flatMap(({ label, availability: state }) =>
    state.enabled || state.reason === null ? [] : [{ label, text: rejectionText(t, state.reason) }],
  );
  const hasReasons = unavailable.length > 0;
  // Only a button that is actually unavailable describes itself with the helper.
  const describedBy = (enabled: boolean): string | undefined =>
    hasReasons && !enabled ? helperId : undefined;

  return (
    <div ref={containerRef} className="action-bar" role="group" aria-label={t('play.actionBar')}>
      <div className="action-bar__actions">
        <Button
          ref={enterButtonRef}
          variant="primary"
          aria-disabled={availability.enterNextRoom.enabled ? undefined : true}
          aria-describedby={describedBy(availability.enterNextRoom.enabled)}
          onClick={availability.enterNextRoom.enabled ? onEnterNextRoom : undefined}
        >
          {t('play.enterNextRoom')}
        </Button>
        <Button
          variant="secondary"
          aria-disabled={availability.runAway.enabled ? undefined : true}
          aria-describedby={describedBy(availability.runAway.enabled)}
          onClick={availability.runAway.enabled ? onRunAway : undefined}
        >
          {t('play.runAway')}
        </Button>
        <Button
          variant="ghost"
          aria-disabled={availability.undoRoom.enabled ? undefined : true}
          aria-describedby={describedBy(availability.undoRoom.enabled)}
          onClick={availability.undoRoom.enabled ? onUndo : undefined}
        >
          {t('play.undo')}
        </Button>
        <Button variant="ghost" onClick={onHelp}>
          {t('play.help')}
        </Button>
      </div>
      {hasReasons ? (
        <p className="action-bar__helper" id={helperId} data-testid="action-reasons">
          {unavailable.map((entry) => (
            <span key={entry.label} className="action-bar__reason">
              {t('play.disabledAction', { action: entry.label, reason: entry.text })}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
});
