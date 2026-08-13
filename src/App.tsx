import { useEffect, useState } from 'react'
import type { ReactNode, SyntheticEvent } from 'react'
import { LiveAnnouncer } from './ui/announcer/LiveAnnouncer'
import { Panel, PixelButton } from './ui/components'
import { loadStats } from './ui/persistence'
import type { RunRecord } from './ui/persistence'
import { buildReplayUrl, navigate, normalizeSeed } from './ui/router/router'
import { AboutScreen } from './ui/screens/AboutScreen'
import { PlayScreen } from './ui/screens/PlayScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen'
import { StatsScreen } from './ui/screens/StatsScreen'
import { TitleScreen } from './ui/screens/TitleScreen'
import {
  selectCanEnterNextRoom,
  selectCanUndo,
  selectDamagePreview,
  selectRunAwayDisabledReason,
  useGameStore,
} from './ui/store/gameStore'
import type { GameAction } from './engine/types'
import type { CardId } from './engine/types'

/**
 * App shell: hash-router switch wiring the store to the four screens, plus
 * the always-mounted screen-reader live region. Screens are presentational —
 * every selector result and callback is computed here and passed in as props.
 */
export default function App() {
  const route = useGameStore((store) => store.route)
  const startRouter = useGameStore((store) => store.startRouter)
  const [seedDialogOpen, setSeedDialogOpen] = useState(false)

  // Boot from the initial hash (incl. '#/play?seed=…&config=…' replay URLs),
  // then keep the route slice synced.
  useEffect(() => startRouter(), [startRouter])

  let screen: ReactNode
  switch (route.name) {
    case 'play':
      screen = <PlayRoute />
      break
    case 'stats':
      screen = <StatsRoute />
      break
    case 'settings':
      screen = <SettingsRoute />
      break
    case 'about':
      screen = (
        <AboutScreen
          onBack={() => {
            navigate('/')
          }}
        />
      )
      break
    case 'title':
      screen = (
        <TitleRoute
          onEnterSeed={() => {
            setSeedDialogOpen(true)
          }}
        />
      )
      break
  }

  return (
    <>
      {screen}
      {seedDialogOpen && (
        <EnterSeedDialog
          onClose={() => {
            setSeedDialogOpen(false)
          }}
        />
      )}
      <LiveAnnouncer />
    </>
  )
}

function TitleRoute({ onEnterSeed }: { onEnterSeed: () => void }) {
  const hasSavedRun = useGameStore((store) => store.hasSavedRun)
  const startNewRun = useGameStore((store) => store.startNewRun)
  const continueRun = useGameStore((store) => store.continueRun)
  return (
    <TitleScreen
      hasSave={hasSavedRun}
      onNewRun={() => {
        startNewRun()
      }}
      onContinue={() => {
        continueRun()
      }}
      onEnterSeed={onEnterSeed}
      onStats={() => {
        navigate('/stats')
      }}
      onSettings={() => {
        navigate('/settings')
      }}
      onAbout={() => {
        navigate('/about')
      }}
    />
  )
}

function PlayRoute() {
  const state = useGameStore((store) => store.state)
  const outcome = useGameStore((store) => store.outcome)
  const lastResult = useGameStore((store) => store.lastResult)
  const announcement = useGameStore((store) => store.announcement)
  const selectedCardId = useGameStore((store) => store.selectedCardId)
  const hasSavedRun = useGameStore((store) => store.hasSavedRun)
  const dispatchAction = useGameStore((store) => store.dispatch)
  const selectCard = useGameStore((store) => store.selectCard)
  const continueRun = useGameStore((store) => store.continueRun)
  const startNewRun = useGameStore((store) => store.startNewRun)
  const exitToTitle = useGameStore((store) => store.exitToTitle)

  // US11: the carried card keeps its badge for the room it arrived in. After
  // a reload lastResult is null, so the badge simply doesn't render then.
  const carriedFrom: CardId | null =
    lastResult?.type === 'RoomDealt' ? (lastResult.carriedFrom ?? null) : null

  return (
    <PlayScreen
      state={state}
      hasSavedRun={hasSavedRun}
      selectedCardId={selectedCardId}
      carriedFrom={carriedFrom}
      lastEvent={announcement?.text ?? null}
      outcome={outcome}
      replayUrl={
        outcome !== null && state !== null ? buildReplayUrl(state.seed, state.config) : null
      }
      canUndo={selectCanUndo(state)}
      canEnterNextRoom={selectCanEnterNextRoom(state)}
      runAwayReason={selectRunAwayDisabledReason(state)}
      previewFor={(cardId) => selectDamagePreview(state, cardId)}
      onSelectCard={selectCard}
      onDispatch={(action: GameAction) => {
        dispatchAction(action)
      }}
      onContinue={() => {
        continueRun()
      }}
      onExitToTitle={exitToTitle}
      onPlayAgain={() => {
        startNewRun()
      }}
    />
  )
}

function StatsRoute() {
  const startRunFromUrl = useGameStore((store) => store.startRunFromUrl)
  const stats = loadStats()
  return (
    <StatsScreen
      stats={stats}
      onReplay={(record: RunRecord) => {
        startRunFromUrl(record.seed, record.config)
        navigate(buildReplayUrl(record.seed, record.config).slice(1))
      }}
      onBack={() => {
        navigate('/')
      }}
    />
  )
}

function SettingsRoute() {
  const settings = useGameStore((store) => store.settings)
  const setSettings = useGameStore((store) => store.setSettings)
  return (
    <SettingsScreen
      settings={settings}
      onChange={setSettings}
      onBack={() => {
        navigate('/')
      }}
    />
  )
}

/** US4: paste a friend's base36 seed to reproduce their exact dungeon. */
function EnterSeedDialog({ onClose }: { onClose: () => void }) {
  const startNewRun = useGameStore((store) => store.startNewRun)
  const [seed, setSeed] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeSeed(seed)
    if (normalized === null) {
      setError('Seeds use 1–16 base36 characters (0–9, a–z).')
      return
    }
    onClose()
    startNewRun(normalized)
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Enter seed">
        <Panel title="Enter Seed" shadowed>
          <form className="dialog-form" onSubmit={onSubmit}>
            <label className="dialog-label" htmlFor="seed-input">
              Dungeon seed
            </label>
            <input
              id="seed-input"
              className="pixel-input"
              name="seed"
              value={seed}
              onChange={(event) => {
                setSeed(event.target.value)
                setError(null)
              }}
              placeholder="e.g. a1b2c3"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {error !== null && (
              <p className="dialog-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <PixelButton variant="ghost" onClick={onClose}>
                Cancel
              </PixelButton>
              <PixelButton variant="ember" type="submit">
                Descend
              </PixelButton>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  )
}
