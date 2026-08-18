/**
 * Shared tooltip infrastructure (Q34b): hover, keyboard-focus, and
 * tap-and-hold (touch) all open the same bubble. The trigger is a render prop
 * receiving `aria-describedby` so any element (card, button) can attach the
 * description without wrapper-div layout side effects.
 *
 * The same bubble chrome backs the run-away reason, card-type hints, and the
 * weapon-degradation explanation; the damage-preview line shares the aria
 * wiring via its own polite live region. Escape closes an open tooltip.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import './tooltip.css';

interface DescribedByProps {
  'aria-describedby'?: string | undefined;
}

interface TooltipProps {
  content: ReactNode;
  children: (props: DescribedByProps) => ReactElement;
}

const HOLD_MS = 420;

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const holdTimer = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearHold();
    setOpen(false);
  }, [clearHold]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => clearHold, [clearHold]);

  return (
    <span
      className="tooltip-host"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocus={() => setOpen(true)}
      onBlur={close}
      onTouchStart={() => {
        clearHold();
        holdTimer.current = window.setTimeout(() => setOpen(true), HOLD_MS);
      }}
      onTouchEnd={() => {
        clearHold();
        window.setTimeout(() => setOpen(false), 1200);
      }}
    >
      {children({ 'aria-describedby': open ? id : undefined })}
      {open && (
        <span className="tooltip-bubble" role="tooltip" id={id}>
          {content}
        </span>
      )}
    </span>
  );
}
