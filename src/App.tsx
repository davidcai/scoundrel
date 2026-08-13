import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { LiveAnnouncer } from './ui/announcer/LiveAnnouncer'
import { Panel, PixelButton } from './ui/components'
import { normalizeSeed, navigate } from './ui/router/router'
import { AboutScreen } from './ui/screens/AboutScreen'
import { TitleScreen } from './ui/screens/TitleScreen'
import { useGameStore } from './ui/store/gameStore'

/**
 * App shell: hash-router switch wiring the store to screens, plus the always-
 * mounted screen-reader live region.
 *
 * Title and About are the designed screens (design lane). Play/Stats/Settings
 * render as placeholders until the screens lane lands — same shell around
 * them, so only the panel contents change.
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
      screen = <PlayPlaceholder />
      break
    case 'stats':
      screen = <PlaceholderScreen title="Stats" />
      break
    case 'settings':
      screen = <PlaceholderScreen title="Settings" />
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

/**
 * Play placeholder (screens lane replaces contents). Carries just enough for
 * cross-stack flows already: it shows the active run's seed (US61) and lets a
 * saved run resume if a '#/play' reload landed here without booting a run.
 */
function PlayPlaceholder() {
  const state = useGameStore((store) => store.state)
  const hasSavedRun = useGameStore((store) => store.hasSavedRun)
  const continueRun = useGameStore((store) => store.continueRun)
  const exitToTitle = useGameStore((store) => store.exitToTitle)
  return (
    <main className="screen" aria-labelledby="play-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={exitToTitle}>
          ← Back
        </PixelButton>
        <h1 id="play-heading">Play</h1>
      </header>
      <Panel shadowed>
        <p>Coming in the next build.</p>
        {state !== null ? (
          <p>
            Run seeded <b>{state.seed}</b> is in progress.
          </p>
        ) : hasSavedRun ? (
          <p>
            <PixelButton
              variant="ember"
              onClick={() => {
                continueRun()
              }}
            >
              Continue saved run
            </PixelButton>
          </p>
        ) : null}
      </Panel>
    </main>
  )
}

/** Stats/Settings placeholder (screens lane replaces contents). */
function PlaceholderScreen({ title }: { title: string }) {
  const headingId = `${title.toLowerCase()}-heading`
  return (
    <main className="screen" aria-labelledby={headingId}>
      <header className="screen-header">
        <PixelButton
          variant="ghost"
          onClick={() => {
            navigate('/')
          }}
        >
          ← Back
        </PixelButton>
        <h1 id={headingId}>{title}</h1>
      </header>
      <Panel shadowed>
        <p>Coming in the next build.</p>
      </Panel>
    </main>
  )
}

// Minimal dialog styling lives inline in the shell until the design lane
// gives dialogs a proper treatment in the shared styles.
const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.65)',
  zIndex: 10,
}

const formStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  minWidth: '16rem',
}

const inputStyle: CSSProperties = {
  font: 'inherit',
  padding: '0.5rem',
  background: 'rgba(0, 0, 0, 0.35)',
  color: 'inherit',
  border: '2px solid currentColor',
}

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
}

/** US4: paste a friend's 6-char base36 seed to reproduce their exact dungeon. */
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
    <div style={backdropStyle} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Enter seed">
        <Panel title="Enter Seed" shadowed>
          <form style={formStyle} onSubmit={onSubmit}>
            <label htmlFor="seed-input">Dungeon seed</label>
            <input
              id="seed-input"
              name="seed"
              value={seed}
              onChange={(event) => {
                setSeed(event.target.value)
                setError(null)
              }}
              placeholder="e.g. A1B2C3"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              style={inputStyle}
            />
            {error !== null && <p role="alert">{error}</p>}
            <div style={buttonRowStyle}>
              <PixelButton variant="ember" type="submit">
                Descend
              </PixelButton>
              <PixelButton variant="ghost" onClick={onClose}>
                Cancel
              </PixelButton>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  )
}
