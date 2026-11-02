import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '../cn';
import { Button } from './Button';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  titleId: string;
  className?: string;
  onClose: () => void;
  /** When provided, renders the 44px close control in the panel corner. */
  closeLabel?: string;
  /**
   * Content that stays visually behind the modal but must not receive pointer
   * or assistive input while it is open (the compact preview sheet sits above a
   * fixed action bar). The element is marked `inert` for the dialog's lifetime.
   */
  backgroundRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Minimal accessible modal: labelled panel, focus trap, Escape to close, and
 * focus restored to the trigger. Used for help/about, run confirmation, and
 * the compact selected-card sheet.
 */
export function Dialog({
  open,
  titleId,
  className,
  onClose,
  closeLabel,
  backgroundRef,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel === null) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Keep the visible background out of the pointer and accessibility trees.
    const background = backgroundRef?.current ?? null;
    const backgroundWasInert = background?.hasAttribute('inert') ?? false;
    if (background !== null && !backgroundWasInert) background.setAttribute('inert', '');

    const focusable = (): HTMLElement[] =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true',
      );

    const first = focusable()[0] ?? panel;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (background !== null && !backgroundWasInert) background.removeAttribute('inert');
      triggerRef.current?.focus();
    };
  }, [open, backgroundRef]);

  if (!open) return null;

  return (
    <div className="dialog">
      <div className="dialog__scrim" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        className={cn('dialog__panel', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {closeLabel === undefined ? null : (
          <Button
            variant="ghost"
            className="dialog__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
