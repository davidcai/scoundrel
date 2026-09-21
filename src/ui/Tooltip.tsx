import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const EDGE = 8;

/**
 * CSS-only tooltip: visible on hover and keyboard focus (:focus-within), and
 * exposed to screen readers via aria-describedby. Shared by damage previews,
 * card-type hints, and control-button explanations.
 *
 * Because the popup is centered on its trigger, it can overflow the viewport
 * near the edges. When shown, the popup is measured and nudged horizontally
 * (`--tooltip-shift`) to stay inside; if there is no room above (viewport top),
 * it flips below the trigger instead.
 */
let tooltipSeq = 0;

export function Tooltip({
  text,
  style,
  children,
}: {
  text: string;
  /** Extra inline style for the wrapper span (e.g. canvas-live hit-layer positioning). */
  style?: CSSProperties;
  children: ReactNode;
}) {
  const id = `tooltip-${++tooltipSeq}`;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const shiftRef = useRef(0);
  const [shift, setShift] = useState(0);
  const [below, setBelow] = useState(false);
  const [open, setOpen] = useState(false);

  const update = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    const w = wrap.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    // Undo the shift already applied so the measurement always reflects the
    // natural, centered position — makes re-measures (scroll/resize) idempotent.
    const naturalLeft = t.left - shiftRef.current;
    const naturalRight = t.right - shiftRef.current;
    let dx = 0;
    if (naturalLeft < EDGE) dx = EDGE - naturalLeft;
    else if (naturalRight > window.innerWidth - EDGE) dx = window.innerWidth - EDGE - naturalRight;
    shiftRef.current = dx;
    setShift(dx);
    setBelow(w.top - t.height < EDGE);
  }, []);

  // Measure during the show event itself so the popup never flashes at its
  // unshifted position; the effect keeps it correct across scroll/resize.
  const show = useCallback(() => {
    setOpen(true);
    update();
  }, [update]);

  useEffect(() => {
    if (!open) return;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrap"
      style={style}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={id}>{children}</span>
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={`tooltip${below ? ' tooltip-below' : ''}`}
        style={{ '--tooltip-shift': `${shift}px` } as CSSProperties}
      >
        {text}
      </span>
    </span>
  );
}
