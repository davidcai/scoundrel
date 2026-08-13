import { useCallback, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import backdropUrl from '../../assets/title-backdrop.svg'
import { Panel, PixelButton, Tooltip } from '../components'
import type { PixelButtonVariant } from '../components'

interface TitleScreenProps {
  /** Whether a saved run exists in localStorage. Drives Continue. */
  hasSave: boolean
  onNewRun: () => void
  onContinue: () => void
  onEnterSeed: () => void
  onStats: () => void
  onSettings: () => void
  onAbout: () => void
}

interface MenuItem {
  key: string
  label: string
  hint: string
  onSelect: () => void
  disabled?: boolean
  variant?: PixelButtonVariant
  /** Tooltip shown instead of the hint-area when the entry is disabled. */
  disabledReason?: string
}

export function TitleScreen({
  hasSave,
  onNewRun,
  onContinue,
  onEnterSeed,
  onStats,
  onSettings,
  onAbout,
}: TitleScreenProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const menuItems: MenuItem[] = [
    {
      key: 'continue',
      label: 'Continue',
      hint: hasSave ? 'Pick up your saved run' : 'No saved run here',
      onSelect: onContinue,
      disabled: !hasSave,
      variant: hasSave ? 'ember' : 'steel',
      disabledReason: 'Start a New Run first — your progress saves as you play.',
    },
    {
      key: 'new',
      label: 'New Run',
      hint: 'Unseen rooms below',
      onSelect: onNewRun,
      variant: hasSave ? 'steel' : 'ember',
    },
    { key: 'seed', label: 'Enter Seed', hint: 'Shared dungeon seed', onSelect: onEnterSeed },
    { key: 'stats', label: 'Stats', hint: 'Your record of delves', onSelect: onStats },
    { key: 'settings', label: 'Settings', hint: 'House rule toggles', onSelect: onSettings },
    { key: 'about', label: 'About', hint: 'Rules and credits', onSelect: onAbout },
  ]

  const focusItem = useCallback((index: number) => {
    buttonRefs.current[index]?.focus()
  }, [])

  /** Arrow/Home/End navigation across the menu, skipping disabled entries. */
  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const currentIndex = buttonRefs.current.findIndex((el) => el === document.activeElement)
    if (currentIndex === -1) return

    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0

    if (event.key === 'Home') {
      event.preventDefault()
      const first = menuItems.findIndex((item) => !item.disabled)
      if (first !== -1) focusItem(first)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      for (let i = menuItems.length - 1; i >= 0; i -= 1) {
        const lastItem = menuItems[i]
        if (lastItem && !lastItem.disabled) {
          focusItem(i)
          return
        }
      }
      return
    }

    if (step === 0) return
    event.preventDefault()

    for (let offset = 1; offset <= menuItems.length; offset += 1) {
      const nextIndex = (currentIndex + offset * step + menuItems.length) % menuItems.length
      const nextItem = menuItems[nextIndex]
      if (nextItem && !nextItem.disabled) {
        focusItem(nextIndex)
        return
      }
    }
  }

  return (
    <main className="screen title-screen" aria-labelledby="title-heading">
      <div className="title-art" aria-hidden="true">
        <img className="pixelated" src={backdropUrl} alt="" />
      </div>

      <div className="title-hero">
        <h1 className="title-logo" id="title-heading">
          Scoundrel
        </h1>
        <p className="title-tagline">One deck. Twenty hit points. One way down.</p>
      </div>

      <Panel shadowed className="title-menu-panel">
        <nav aria-label="Main menu">
          <ul className="title-menu" role="list" onKeyDown={onMenuKeyDown}>
            {menuItems.map((item, index) => {
              const button = (
                <PixelButton
                  ref={(el) => {
                    buttonRefs.current[index] = el
                  }}
                  variant={item.disabled ? 'steel' : (item.variant ?? 'steel')}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                >
                  <span className="title-menu-label">{item.label}</span>
                  <span className="title-menu-hint">{item.hint}</span>
                </PixelButton>
              )
              return (
                <li key={item.key}>
                  {item.disabled && item.disabledReason ? (
                    <Tooltip content={item.disabledReason} placement="bottom">
                      {(tooltipProps) => <span {...tooltipProps}>{button}</span>}
                    </Tooltip>
                  ) : (
                    button
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </Panel>

      <footer className="title-footer">
        <kbd>↑</kbd>
        <kbd>↓</kbd> choose · <kbd>ENTER</kbd> descend
      </footer>
    </main>
  )
}
