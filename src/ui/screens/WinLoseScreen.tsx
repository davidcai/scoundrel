import { useState } from 'react'
import type { GameState } from '../../engine/types'
import { Panel, PixelButton } from '../components'

export interface WinLoseScreenProps {
  state: GameState
  outcome: { type: 'won' | 'lost'; score: number }
  /** Shareable '#…' replay URL (built by the shell via buildReplayUrl). */
  replayUrl: string
  onPlayAgain: () => void
  onExitToTitle: () => void
}

/** navigator.clipboard with an execCommand fallback (older/embedded webviews). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const scratch = document.createElement('textarea')
      scratch.value = text
      scratch.style.position = 'fixed'
      scratch.style.opacity = '0'
      document.body.appendChild(scratch)
      scratch.select()
      // Legacy fallback for webviews without the async clipboard API.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const ok = document.execCommand('copy')
      scratch.remove()
      return ok
    } catch {
      return false
    }
  }
}

function configChips(state: GameState): string[] {
  const { runAwayMode, potionsPerRoom, weaponDegradation } = state.config
  return [
    runAwayMode === 'once' ? 'Run-away: once' : 'Run-away: unlimited',
    potionsPerRoom === 1 ? 'Potions: 1 / room' : 'Potions: unlimited',
    weaponDegradation ? 'Weapons wear' : 'Weapons never wear',
  ]
}

export function WinLoseScreen({
  state,
  outcome,
  replayUrl,
  onPlayAgain,
  onExitToTitle,
}: WinLoseScreenProps) {
  const [copied, setCopied] = useState(false)
  const won = outcome.type === 'won'

  const onCopy = () => {
    void copyText(replayUrl).then((ok) => {
      setCopied(ok)
    })
  }

  return (
    <main
      className={['screen', 'end-screen', won ? 'end-screen--won' : 'end-screen--lost'].join(' ')}
    >
      <Panel shadowed className="scorecard-panel">
        <header className="scorecard-banner">
          <h1 className="scorecard-title">{won ? 'Dungeon Cleared' : 'You Fell'}</h1>
          <p className="scorecard-flavor">
            {won
              ? 'Every room behind you. The stairs run out of dark.'
              : 'The dungeon keeps what is owed.'}
          </p>
        </header>

        <div className="scorecard-score" aria-label={`Final score ${String(outcome.score)}`}>
          {outcome.score}
        </div>

        <div className="scorecard-grid">
          <div className="scorecard-stat">
            <span className="scorecard-stat-label">Seed</span>
            <span className="scorecard-stat-value seed-chip">{state.seed}</span>
          </div>
          <div className="scorecard-stat">
            <span className="scorecard-stat-label">Monsters slain</span>
            <span className="scorecard-stat-value">{state.runHighlights.monstersKilled}</span>
          </div>
          <div className="scorecard-stat">
            <span className="scorecard-stat-label">Potions poured out</span>
            <span className="scorecard-stat-value">{state.runHighlights.potionsWasted}</span>
          </div>
          <div className="scorecard-stat">
            <span className="scorecard-stat-label">Rooms explored</span>
            <span className="scorecard-stat-value">{state.runHighlights.roomsExplored}</span>
          </div>
        </div>

        <div className="config-chips" aria-label="House rules used">
          {configChips(state).map((chip) => (
            <span key={chip} className="config-chip">
              {chip}
            </span>
          ))}
        </div>

        <div className="scorecard-actions">
          <PixelButton variant="steel" onClick={onCopy}>
            {copied ? 'Copied!' : 'Copy replay link'}
          </PixelButton>
          <PixelButton variant="ember" onClick={onPlayAgain}>
            Play again
          </PixelButton>
          <PixelButton variant="ghost" onClick={onExitToTitle}>
            Return to title
          </PixelButton>
        </div>
      </Panel>
    </main>
  )
}
