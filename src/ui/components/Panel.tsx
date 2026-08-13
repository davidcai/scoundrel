import type { ReactNode } from 'react'

interface PanelProps {
  /** Optional header strip rendered in display font. */
  title?: string
  /** Extra hard drop-shadow for floating dialogs/scorecards. */
  shadowed?: boolean
  className?: string
  children: ReactNode
}

export function Panel({ title, shadowed = false, className, children }: PanelProps) {
  return (
    <section
      className={['panel', 'bevel-raised', shadowed && 'panel--shadowed', className]
        .filter(Boolean)
        .join(' ')}
    >
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  )
}
