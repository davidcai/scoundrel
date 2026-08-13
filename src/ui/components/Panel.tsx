import type { ReactNode } from 'react'

interface PanelProps {
  /** Optional header strip rendered in display font. */
  title?: string
  /** Extra hard drop-shadow for floating dialogs/scorecards. */
  shadowed?: boolean
  /** Accessible name for the section region (use when `title` is absent). */
  ariaLabel?: string
  className?: string
  children: ReactNode
}

export function Panel({ title, shadowed = false, ariaLabel, className, children }: PanelProps) {
  return (
    <section
      className={['panel', 'bevel-raised', shadowed && 'panel--shadowed', className]
        .filter(Boolean)
        .join(' ')}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    >
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  )
}
