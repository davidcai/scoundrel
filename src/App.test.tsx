// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { freshStoreData, useGameStore } from './ui/store/gameStore'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
  useGameStore.setState(freshStoreData())
})

afterEach(() => {
  cleanup()
})

describe('App router switch', () => {
  it("renders the title screen on '#/' with Continue disabled and no saved run", () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Scoundrel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Continue/ })).toBeDisabled()
    // Live region is always mounted.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('falls back to the title screen for unknown routes', () => {
    window.location.hash = '#/nonsense'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Scoundrel' })).toBeInTheDocument()
  })

  it("renders the designed About screen on '#/about'", () => {
    window.location.hash = '#/about'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it('renders the Stats and Settings screens', () => {
    window.location.hash = '#/stats'
    const { unmount } = render(<App />)
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument()
    expect(screen.getByText(/No runs on the ledger yet/)).toBeInTheDocument()
    unmount()

    window.location.hash = '#/settings'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Weapon degradation' })).toBeInTheDocument()
  })

  it('boots a seeded replay URL into an active run', () => {
    window.location.hash = '#/play?seed=AAAAAA'
    render(<App />)
    const run = useGameStore.getState().state
    if (run === null) throw new Error('expected a booted run')
    expect(run.seed).toBe('aaaaaa')
    expect(run.room).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Dungeon' })).toBeInTheDocument()
  })

  it('starts a run through the Enter Seed dialog (US4)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Enter Seed/ }))
    await user.type(screen.getByLabelText('Dungeon seed'), 'zz9900')
    await user.click(screen.getByRole('button', { name: 'Descend' }))
    const run = useGameStore.getState().state
    if (run === null) throw new Error('expected a booted run')
    expect(run.seed).toBe('zz9900')
    expect(window.location.hash).toBe('#/play')
  })

  it('rejects a non-base36 seed without booting a run', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Enter Seed/ }))
    await user.type(screen.getByLabelText('Dungeon seed'), 'bad seed!')
    await user.click(screen.getByRole('button', { name: 'Descend' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(useGameStore.getState().state).toBeNull()
  })

  it('enables Continue and resumes the saved run (US2/US43)', async () => {
    useGameStore.getState().startNewRun('HAVEONE')
    window.location.hash = '#/'
    useGameStore.setState(freshStoreData())

    const user = userEvent.setup()
    render(<App />)
    const continueButton = screen.getByRole('button', { name: /^Continue/ })
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)
    expect(useGameStore.getState().state?.seed).toBe('haveone')
  })
})
