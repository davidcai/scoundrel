import type { GameConfig } from '../../engine/types'
import { Panel, PixelButton, Tooltip } from '../components'

export interface SettingsScreenProps {
  settings: GameConfig
  onChange: (next: GameConfig) => void
  onBack: () => void
}

interface ToggleSpec {
  key: keyof GameConfig
  label: string
  offText: string
  onText: string
  offNote: string
  onNote: string
  tooltip: string
}

const TOGGLES: ToggleSpec[] = [
  {
    key: 'runAwayMode',
    label: 'Run-away restriction',
    offText: 'once',
    onText: 'unlimited',
    offNote: 'Canonical — never twice in a row.',
    onNote: 'House rule — flee any unfaced room.',
    tooltip: 'Canonical: you may run from a room, but never two rooms in a row.',
  },
  {
    key: 'potionsPerRoom',
    label: 'Potions per room',
    offText: 'one',
    onText: 'unlimited',
    offNote: 'Canonical — extras pour out.',
    onNote: 'House rule — every potion heals.',
    tooltip: 'Canonical: only the first potion in a room heals; extras are discarded.',
  },
  {
    key: 'weaponDegradation',
    label: 'Weapon degradation',
    offText: 'on',
    onText: 'off',
    offNote: 'Canonical — weapons dull.',
    onNote: 'House rule — weapons never dull.',
    tooltip: 'Canonical: a weapon only fights monsters weaker than its last kill.',
  },
]

function isOn(config: GameConfig, key: keyof GameConfig): boolean {
  if (key === 'runAwayMode') return config.runAwayMode === 'unlimited'
  if (key === 'potionsPerRoom') return config.potionsPerRoom === 'unlimited'
  return !config.weaponDegradation
}

function toggleValue(config: GameConfig, key: keyof GameConfig, on: boolean): GameConfig {
  if (key === 'runAwayMode') return { ...config, runAwayMode: on ? 'unlimited' : 'once' }
  if (key === 'potionsPerRoom') return { ...config, potionsPerRoom: on ? 'unlimited' : 1 }
  return { ...config, weaponDegradation: !on }
}

export function SettingsScreen({ settings, onChange, onBack }: SettingsScreenProps) {
  return (
    <main className="screen settings-screen" aria-labelledby="settings-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={onBack}>
          ← Title
        </PixelButton>
        <h1 id="settings-heading">Settings</h1>
      </header>

      <Panel title="House Rules" shadowed className="settings-panel">
        <ul className="settings-list" role="list">
          {TOGGLES.map((toggle) => {
            const on = isOn(settings, toggle.key)
            return (
              <li key={toggle.key} className="settings-row">
                <span className="settings-info">
                  <span className="settings-label">{toggle.label}</span>
                  <span className="settings-note">{on ? toggle.onNote : toggle.offNote}</span>
                </span>
                <Tooltip content={toggle.tooltip}>
                  {(tooltipProps) => (
                    <button
                      {...tooltipProps}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={toggle.label}
                      className={['pixel-toggle', on && 'pixel-toggle--on']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        onChange(toggleValue(settings, toggle.key, !on))
                      }}
                    >
                      <span className="pixel-toggle-thumb" aria-hidden="true" />
                      <span className="pixel-toggle-text" aria-hidden="true">
                        {on ? toggle.onText : toggle.offText}
                      </span>
                    </button>
                  )}
                </Tooltip>
              </li>
            )
          })}
        </ul>
        <p className="settings-footnote">
          Applies to your next run — the active run keeps its own rules.
        </p>
      </Panel>
    </main>
  )
}
