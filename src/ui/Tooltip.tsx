import type { ReactNode } from 'react';

/**
 * CSS-only tooltip: visible on hover and keyboard focus (:focus-within), and
 * exposed to screen readers via aria-describedby. Shared by damage previews,
 * card-type hints, and control-button explanations.
 */
let tooltipSeq = 0;

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = `tooltip-${++tooltipSeq}`;
  return (
    <span className="tooltip-wrap">
      <span aria-describedby={id}>{children}</span>
      <span id={id} role="tooltip" className="tooltip">
        {text}
      </span>
    </span>
  );
}
