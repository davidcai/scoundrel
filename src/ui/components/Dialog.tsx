import { useEffect, useRef, type ReactNode } from 'react';
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
  children: ReactNode;
}

/**
 * Minimal accessible modal: labelled panel, focus trap, Escape to close, and
 * focus restored to the trigger. Used for help/about and for the compact
 * selected-card sheet.
 */
export function Dialog({ open, titleId, className, onClose, closeLabel, children }: DialogProps) {
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
      triggerRef.current?.focus();
    };
  }, [open]);

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
