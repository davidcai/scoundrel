import { useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import type { CardId, GameAction, GameState } from '../../engine/types'
import { Card, Panel, PixelButton, SuitGlyph, Tooltip } from '../components'
import { describeCard, parseCard } from '../components'
import { WinLoseScreen } from './WinLoseScreen'

/** Terminal outcome — structurally identical to the store's RunOutcome. */
export interface OutcomeView {
  type: 'won' | 'lost'
  score: number
}

/** Mirror of the store's RunAwayGate (screens stay store-free). */
export type RunAwayReason =
  'not-playing' | 'no-room' | 'room-in-progress' | 'twice-in-row' | 'no-cards'

const RUN_AWAY_REASON_TEXT: Record<RunAwayReason, string> = {
  'not-playing': 'No run in progress.',
  'no-room': 'No room dealt yet.',
  'room-in-progress': 'You can only flee an unfaced room.',
  'twice-in-row': "You can't run two rooms in a row.",
  'no-cards': 'Not enough cards left to deal a new room.',
}

/** Mirror of the store's DamagePreview (US15 click-to-select preview). */
export type CardPreview =
  | {
      kind: 'monster'
      weaponDamage: number | null
      barehandedDamage: number
      weaponBlocked: boolean
    }
  | { kind: 'potion'; healed: number; wasted: boolean }
  | { kind: 'weapon'; discardedWeaponId: CardId | null; discardedKillCount: number }
  | { kind: 'unknown' }

export interface PlayScreenProps {
  state: GameState | null
  hasSavedRun: boolean
  selectedCardId: CardId | null
  /** Card that carried in with this room (badge); null right after a reload. */
  carriedFrom: CardId | null
  /** Latest result sentence (the same text the announcer speaks). */
  lastEvent: string | null
  outcome: OutcomeView | null
  /** Shareable '#…' replay URL; non-null once the run is terminal. */
  replayUrl: string | null
  canUndo: boolean
  canEnterNextRoom: boolean
  runAwayReason: RunAwayReason | null
  previewFor: (cardId: CardId) => CardPreview
  onSelectCard: (cardId: CardId | null) => void
  onDispatch: (action: GameAction) => void
  onContinue: () => void
  onExitToTitle: () => void
  onPlayAgain: () => void
}

export function PlayScreen(props: PlayScreenProps) {
  const { state, outcome } = props

  // Terminal: the scorecard takes over (US37/US38).
  if (state !== null && outcome !== null && props.replayUrl !== null) {
    return (
      <WinLoseScreen
        state={state}
        outcome={outcome}
        replayUrl={props.replayUrl}
        onPlayAgain={props.onPlayAgain}
        onExitToTitle={props.onExitToTitle}
      />
    )
  }

  // '#/play' with nothing dealt (no seed, no save).
  if (state === null) {
    return (
      <NoRunPanel
        hasSavedRun={props.hasSavedRun}
        onContinue={props.onContinue}
        onExitToTitle={props.onExitToTitle}
      />
    )
  }

  return <ActiveRun {...props} state={state} />
}

function NoRunPanel({
  hasSavedRun,
  onContinue,
  onExitToTitle,
}: {
  hasSavedRun: boolean
  onContinue: () => void
  onExitToTitle: () => void
}) {
  return (
    <main className="screen" aria-labelledby="play-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={onExitToTitle}>
          ← Title
        </PixelButton>
        <h1 id="play-heading">Dungeon</h1>
      </header>
      <Panel shadowed className="no-run-panel">
        <p>The dungeon has not been dealt yet.</p>
        {hasSavedRun && (
          <PixelButton variant="ember" onClick={onContinue}>
            Continue saved run
          </PixelButton>
        )}
      </Panel>
    </main>
  )
}

function ActiveRun({
  state,
  selectedCardId,
  carriedFrom,
  lastEvent,
  canUndo,
  canEnterNextRoom,
  runAwayReason,
  previewFor,
  onSelectCard,
  onDispatch,
  onExitToTitle,
}: PlayScreenProps & { state: GameState }) {
  // Escape anywhere clears the current selection.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onSelectCard(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onSelectCard])

  return (
    <main className="screen play-screen" aria-labelledby="play-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={onExitToTitle}>
          ← Title
        </PixelButton>
        <h1 id="play-heading">Dungeon</h1>
        <span className="seed-chip" title="Run seed">
          Seed {state.seed}
        </span>
      </header>

      <Hud state={state} lastEvent={lastEvent} />

      <Panel title="Room" shadowed className="room-panel">
        <Room
          state={state}
          selectedCardId={selectedCardId}
          carriedFrom={carriedFrom}
          onSelectCard={onSelectCard}
        />
        <ConfirmStrip
          state={state}
          selectedCardId={selectedCardId}
          previewFor={previewFor}
          onDispatch={onDispatch}
        />
      </Panel>

      <WeaponZone state={state} />

      <div className="actions-row">
        <PixelButton
          variant="ghost"
          disabled={!canUndo}
          onClick={() => {
            onDispatch({ type: 'UndoToRoomStart' })
          }}
        >
          Undo to Room Start
        </PixelButton>

        <Tooltip
          content={
            runAwayReason !== null ? RUN_AWAY_REASON_TEXT[runAwayReason] : 'Flee to a fresh room'
          }
        >
          {(tooltipProps) => (
            <PixelButton
              {...tooltipProps}
              variant="steel"
              aria-disabled={runAwayReason !== null}
              onClick={() => {
                if (runAwayReason === null) onDispatch({ type: 'RunAway' })
              }}
            >
              Run Away
            </PixelButton>
          )}
        </Tooltip>

        <PixelButton
          variant={canEnterNextRoom ? 'ember' : 'steel'}
          disabled={!canEnterNextRoom}
          onClick={() => {
            onDispatch({ type: 'EnterNextRoom' })
          }}
        >
          Enter Next Room
        </PixelButton>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------
 * HUD — HP hearts, deck count, run-away indicator, run highlights.
 * ---------------------------------------------------------------------- */

function Hud({ state, lastEvent }: { state: GameState; lastEvent: string | null }) {
  return (
    <Panel className="hud-panel" ariaLabel="Run status">
      <div className="hud-strip">
        <div className="hud-block">
          <span className="hud-label">HP</span>
          <span className="hp-row">
            <HitPoints hp={state.hp} maxHp={state.maxHp} />
            <span className="hud-value">
              {state.hp} / {state.maxHp}
            </span>
          </span>
        </div>

        <div className="hud-block">
          <span className="hud-label">Dungeon</span>
          <span className="deck-count">
            <span className="deck-mini" aria-hidden="true" />
            {state.dungeon.length} left
          </span>
        </div>

        <div className="hud-block">
          <span className="hud-label">Escape</span>
          <span className="hud-value">{state.ranAwayLastRoom ? 'Fled last room' : 'Ready'}</span>
        </div>

        <div className="hud-block hud-highlights">
          <span className="hud-label">Ledger</span>
          <span className="hud-value">
            {state.runHighlights.monstersKilled} slain · {state.runHighlights.potionsWasted} poured
            out · {state.runHighlights.roomsExplored} rooms
          </span>
        </div>
      </div>
      {lastEvent !== null && <p className="hud-event">{lastEvent}</p>}
    </Panel>
  )
}

/** One heart = 2 HP; a wounded half beats at half opacity. */
function HitPoints({ hp, maxHp }: { hp: number; maxHp: number }) {
  const count = Math.ceil(maxHp / 2)
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const fill = hp - i * 2
        const klass =
          fill >= 2
            ? 'hp-heart'
            : fill === 1
              ? 'hp-heart hp-heart--half'
              : 'hp-heart hp-heart--empty'
        return <SuitGlyph key={i} suit="H" className={klass} />
      })}
    </>
  )
}

/* -------------------------------------------------------------------------
 * Room — the ≤4 face-up cards, carried card badged, arrow-key nav (US54).
 * ---------------------------------------------------------------------- */

function Room({
  state,
  selectedCardId,
  carriedFrom,
  onSelectCard,
}: {
  state: GameState
  selectedCardId: CardId | null
  carriedFrom: CardId | null
  onSelectCard: (cardId: CardId | null) => void
}) {
  /** Left/Right/Home/End rove focus across the room's card buttons. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cards = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button.card'))
    const current = cards.findIndex((el) => el === document.activeElement)
    if (current === -1) return

    let next: number | null = null
    if (event.key === 'ArrowRight') next = (current + 1) % cards.length
    if (event.key === 'ArrowLeft') next = (current - 1 + cards.length) % cards.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = cards.length - 1
    if (next === null) return
    event.preventDefault()
    cards[next]?.focus()
  }

  return (
    <div className="room-row" role="group" aria-label="Room cards" onKeyDown={onKeyDown}>
      {state.room.map((cardId) => (
        <span key={cardId} className="room-card-wrap">
          <Card
            cardId={cardId}
            selected={cardId === selectedCardId}
            className={cardId === carriedFrom ? 'card--carried' : undefined}
            onClick={(id) => {
              onSelectCard(id === selectedCardId ? null : id)
            }}
          />
          {cardId === carriedFrom && <span className="carry-badge">Carried</span>}
        </span>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Confirm strip — selected card's preview + context actions (US15/US16).
 * ---------------------------------------------------------------------- */

function previewSummary(cardId: CardId, preview: CardPreview): string {
  const parsed = parseCard(cardId)
  const name = parsed !== null ? describeCard(parsed) : cardId
  switch (preview.kind) {
    case 'monster':
      if (preview.weaponDamage !== null) {
        return `${name}. Weapon takes it for ${String(preview.weaponDamage)} — barehanded costs ${String(preview.barehandedDamage)}.`
      }
      if (preview.weaponBlocked) {
        return `${name}. Your weapon is too worn for it — barehanded costs ${String(preview.barehandedDamage)}.`
      }
      return `${name}. Barehanded costs ${String(preview.barehandedDamage)}.`
    case 'potion':
      return preview.wasted
        ? `${name}. One potion per room — this one pours out.`
        : `${name}. Heals ${String(preview.healed)}.`
    case 'weapon':
      return preview.discardedWeaponId !== null
        ? `${name}. Equipping discards your current weapon and its ${String(preview.discardedKillCount)} kills.`
        : `${name}. Equip it.`
    case 'unknown':
      return name
  }
}

function ConfirmStrip({
  state,
  selectedCardId,
  previewFor,
  onDispatch,
}: {
  state: GameState
  selectedCardId: CardId | null
  previewFor: (cardId: CardId) => CardPreview
  onDispatch: (action: GameAction) => void
}) {
  if (selectedCardId === null || !state.room.includes(selectedCardId)) {
    return (
      <div className="confirm-strip confirm-strip--empty">
        Choose a card — you resolve three, then descend.
      </div>
    )
  }

  const preview = previewFor(selectedCardId)

  return (
    <div className="confirm-strip" role="region" aria-label="Card actions">
      <p className="confirm-summary">{previewSummary(selectedCardId, preview)}</p>
      <div className="confirm-actions">
        {preview.kind === 'monster' && (
          <>
            {preview.weaponBlocked ? (
              <Tooltip content="Too worn — only monsters weaker than its last kill.">
                {(tooltipProps) => (
                  <PixelButton
                    {...tooltipProps}
                    variant="ember"
                    aria-disabled="true"
                    onClick={() => {
                      /* gated — weapon degraded */
                    }}
                  >
                    Fight w/ Weapon
                  </PixelButton>
                )}
              </Tooltip>
            ) : preview.weaponDamage !== null ? (
              <PixelButton
                variant="ember"
                onClick={() => {
                  onDispatch({ type: 'FightMonster', cardId: selectedCardId })
                }}
              >
                Fight w/ Weapon — {preview.weaponDamage} dmg
              </PixelButton>
            ) : null}
            <PixelButton
              variant="steel"
              onClick={() => {
                onDispatch({ type: 'FightMonster', cardId: selectedCardId, barehanded: true })
              }}
            >
              Barehanded — {preview.barehandedDamage} dmg
            </PixelButton>
          </>
        )}
        {preview.kind === 'potion' && (
          <PixelButton
            variant="ember"
            onClick={() => {
              onDispatch({ type: 'DrinkPotion', cardId: selectedCardId })
            }}
          >
            {preview.wasted ? 'Drink — pours out' : `Drink — heal ${String(preview.healed)}`}
          </PixelButton>
        )}
        {preview.kind === 'weapon' && (
          <PixelButton
            variant="ember"
            onClick={() => {
              onDispatch({ type: 'EquipWeapon', cardId: selectedCardId })
            }}
          >
            Equip Weapon
          </PixelButton>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Weapon zone — weapon card left, kill stack right, last-kill on top (Q40).
 * ---------------------------------------------------------------------- */

function WeaponZone({ state }: { state: GameState }) {
  const lastKill = state.killStack.at(-1)
  const lastKillValue = lastKill !== undefined ? (parseCard(lastKill)?.value ?? null) : null

  return (
    <Panel className="weapon-panel">
      <div className="weapon-header">
        <Tooltip content="A worn weapon can only fight monsters weaker than its last kill.">
          {(tooltipProps) => (
            <h2 {...tooltipProps} className="section-label" tabIndex={0}>
              Weapon
            </h2>
          )}
        </Tooltip>
        {state.weapon !== null && lastKillValue !== null && (
          <span className="weapon-threshold">Beats anything under {lastKillValue}</span>
        )}
      </div>
      {state.weapon === null ? (
        <p className="weapon-empty">Bare hands — every monster hits for full value.</p>
      ) : (
        <div className="weapon-zone">
          <Card cardId={state.weapon} className="weapon-card" />
          <div className="kill-stack" aria-label="Kill stack, last kill on top">
            {state.killStack.map((cardId) => (
              <Card key={cardId} cardId={cardId} className="kill-stack-card" />
            ))}
          </div>
          {state.killStack.length === 0 && (
            <p className="weapon-note">No kills yet — deadly against anything.</p>
          )}
        </div>
      )}
    </Panel>
  )
}
