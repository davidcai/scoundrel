import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

const EDGE = 8;
const GAP = 14;

/**
 * Cursor-anchored tooltip for canvas sprite hover. Reuses `Tooltip`'s existing
 * positioning/flip logic — measure on show, nudge horizontally (`--tooltip-shift`)
 * to stay inside the viewport, flip below the anchor when there is no room
 * above — but anchors to a cursor point (position: fixed) instead of a DOM
 * trigger, since sprites have no DOM hover target. (`Tooltip.tsx`'s own
 * `:focus-within` doc comment is stale; its JS state-based positioning is what
 * is mirrored here, not its hover/focus wiring.)
 */
export function CursorTooltip({ x, y, text }: { x: number; y: number; text: string }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(0);
  const [shift, setShift] = useState(0);
  const [below, setBelow] = useState(false);

  const update = useCallback(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const rect = tip.getBoundingClientRect();
    // Undo the shift already applied so the measurement always reflects the
    // natural, cursor-centered position — keeps re-measures idempotent.
    const naturalLeft = rect.left - shiftRef.current;
    const naturalRight = rect.right - shiftRef.current;
    let dx = 0;
    if (naturalLeft < EDGE) dx = EDGE - naturalLeft;
    else if (naturalRight > window.innerWidth - EDGE) dx = window.innerWidth - EDGE - naturalRight;
    shiftRef.current = dx;
    setShift(dx);
    setBelow(y - GAP - rect.height < EDGE);
  }, [y]);

  // Measure on mount and whenever the cursor/text moves so the popup never
  // flashes at a stale position.
  useEffect(() => {
    update();
  }, [update, x, text]);

  return (
    <div
      ref={tipRef}
      role="tooltip"
      className={`tooltip cursor-tooltip${below ? ' tooltip-below' : ''}`}
      style={
        {
          left: x,
          top: below ? y + GAP : y - GAP,
          bottom: 'auto',
          '--tooltip-shift': `${shift}px`,
        } as CSSProperties
      }
    >
      {text}
    </div>
  );
}
