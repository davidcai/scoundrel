// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine/types'
import type { CardId, GameAction, GameState } from '../../engine/types'
import type { StatsData } from '../persistence'
import { PlayScreen } from './PlayScreen'
import type { CardPreview, PlayScreenProps, RunAwayReason } from './PlayScreen'
import { SettingsScreen } from './SettingsScreen'
import { StatsScreen } from './StatsScreen'
import { WinLoseScreen } from './WinLoseScreen'

afterEach(() => {
  cleanup()
})

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'abc123',
    config: { ...DEFAULT_CONFIG },
    phase: 'playing',
    hp: 14,
    maxHp: 20,
    dungeon: ['2C', '3C', '4C', '5C', '6C', '7C'],
    room: ['8C', '5D', '3H', 'KS'],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 1,
    runHighlights: { monstersKilled: 2, potionsWasted: 1, roomsExplored: 3 },
    startedAt: 0,
    roomSnapshot: null,
    ...overrides,
  }
}

function makePreview(cardId: CardId, state: GameState): CardPreview {
  const suit = cardId.slice(-1)
  if (suit === 'C' || suit === 'S') {
    return { kind: 'monster', weaponDamage: null, barehandedDamage: 8, weaponBlocked: false }
  }
  if (suit === 'H') return { kind: 'potion', healed: 3, wasted: false }
  if (suit === 'D')
    return { kind: 'weapon', discardedWeaponId: state.weapon, discardedKillCount: 0 }
  return { kind: 'unknown' }
}

function playProps(overrides: Partial<PlayScreenProps> = {}): PlayScreenProps {
  const state = overrides.state ?? makeState()
  return {
    state,
    hasSavedRun: false,
    selectedCardId: null,
    carriedFrom: null,
    lastEvent: null,
    outcome: null,
    replayUrl: null,
    canUndo: false,
    canEnterNextRoom: false,
    runAwayReason: null,
    previewFor: (cardId) => makePreview(cardId, state),
    onSelectCard: vi.fn(),
    onDispatch: vi.fn(),
    onContinue: vi.fn(),
    onExitToTitle: vi.fn(),
    onPlayAgain: vi.fn(),
    ...overrides,
  }
}

describe('PlayScreen', () => {
  it('renders the HUD and the dealt room (US8, US61, US65)', () => {
    render(<PlayScreen {...playProps()} />)
    expect(screen.getByRole('heading', { name: 'Dungeon' })).toBeInTheDocument()
    expect(screen.getByText('14 / 20')).toBeInTheDocument()
    expect(screen.getByText(/Seed abc123/)).toBeInTheDocument()
    expect(screen.getByText(/2 slain · 1 poured out · 3 rooms/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '8 of Clubs, monster, value 8' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '5 of Diamonds, weapon, value 5' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 of Hearts, potion, value 3' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'K of Spades, monster, value 13' }),
    ).toBeInTheDocument()
  })

  it('marks the carried card (US11)', () => {
    render(<PlayScreen {...playProps({ carriedFrom: 'KS' })} />)
    expect(screen.getByText('Carried')).toBeInTheDocument()
  })

  it('selecting a card, then confirming, dispatches the action (US15/16)', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    const onDispatch = vi.fn<(action: GameAction) => void>()
    const props = playProps({ onSelectCard })
    const { rerender } = render(<PlayScreen {...props} />)

    await user.click(screen.getByRole('button', { name: '8 of Clubs, monster, value 8' }))
    expect(onSelectCard).toHaveBeenCalledWith('8C')

    rerender(<PlayScreen {...{ ...props, selectedCardId: '8C', onDispatch }} />)
    expect(screen.getByText(/Barehanded costs 8/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Barehanded — 8 dmg/ }))
    expect(onDispatch).toHaveBeenCalledWith({
      type: 'FightMonster',
      cardId: '8C',
      barehanded: true,
    })
  })

  it('shows the weapon fight path when a weapon can soak damage', async () => {
    const user = userEvent.setup()
    const onDispatch = vi.fn<(action: GameAction) => void>()
    const state = makeState({ weapon: '5D', killStack: ['4C'] })
    render(
      <PlayScreen
        {...playProps({
          state,
          selectedCardId: '8C',
          onDispatch,
          previewFor: () => ({
            kind: 'monster',
            weaponDamage: 3,
            barehandedDamage: 8,
            weaponBlocked: false,
          }),
        })}
      />,
    )
    expect(screen.getByText(/Weapon takes it for 3 — barehanded costs 8/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Fight w\/ Weapon — 3 dmg/ }))
    expect(onDispatch).toHaveBeenCalledWith({ type: 'FightMonster', cardId: '8C' })
  })

  it('Explains the run-away gate via tooltip (US29-US31)', () => {
    const reasons: [RunAwayReason, string][] = [
      ['twice-in-row', "You can't run two rooms in a row."],
      ['room-in-progress', 'You can only flee an unfaced room.'],
      ['no-cards', 'Not enough cards left to deal a new room.'],
    ]
    for (const [reason, text] of reasons) {
      const { unmount } = render(<PlayScreen {...playProps({ runAwayReason: reason })} />)
      const button = screen.getByRole('button', { name: 'Run Away' })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      fireEvent.focusIn(button)
      expect(screen.getByRole('tooltip')).toHaveTextContent(text)
      unmount()
    }
  })

  it('does not dispatch Run Away while gated', async () => {
    const user = userEvent.setup()
    const onDispatch = vi.fn<(action: GameAction) => void>()
    render(<PlayScreen {...playProps({ runAwayReason: 'twice-in-row', onDispatch })} />)
    await user.click(screen.getByRole('button', { name: 'Run Away' }))
    expect(onDispatch).not.toHaveBeenCalled()
  })

  it('renders the weapon left, kill stack right with last kill on top (US20/21)', () => {
    const state = makeState({ weapon: '7D', killStack: ['4C', '6S'] })
    const { container } = render(<PlayScreen {...playProps({ state })} />)
    const stack = container.querySelector('.kill-stack')
    expect(stack).not.toBeNull()
    const cards = stack?.querySelectorAll('.card') ?? []
    expect(cards).toHaveLength(2)
    expect(cards[1]?.getAttribute('aria-label')).toBe('6 of Spades, monster, value 6')
    expect(screen.getByText(/Beats anything under 6/)).toBeInTheDocument()
  })

  it('shows bare-hands copy when no weapon is equipped', () => {
    render(<PlayScreen {...playProps()} />)
    expect(screen.getByText(/Bare hands — every monster hits for full value/)).toBeInTheDocument()
  })
})

describe('WinLoseScreen (via PlayScreen terminal state, US37/US38)', () => {
  it('renders the victory scorecard from outcome', () => {
    render(
      <WinLoseScreen
        state={makeState()}
        outcome={{ type: 'won', score: 14 }}
        replayUrl="#/play?seed=abc123&config=once%2C1%2Con"
        onPlayAgain={vi.fn()}
        onExitToTitle={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Dungeon Cleared' })).toBeInTheDocument()
    expect(screen.getByLabelText('Final score 14')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByText('Run-away: once')).toBeInTheDocument()
  })

  it('renders the defeat scorecard with a negative score', () => {
    render(
      <WinLoseScreen
        state={makeState()}
        outcome={{ type: 'lost', score: -21 }}
        replayUrl="#/play?seed=abc123&config=once%2C1%2Con"
        onPlayAgain={vi.fn()}
        onExitToTitle={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'You Fell' })).toBeInTheDocument()
    expect(screen.getByLabelText('Final score -21')).toBeInTheDocument()
  })

  it('Play again starts over and Return to title exits', async () => {
    const user = userEvent.setup()
    const onPlayAgain = vi.fn()
    const onExitToTitle = vi.fn()
    render(
      <WinLoseScreen
        state={makeState()}
        outcome={{ type: 'won', score: 14 }}
        replayUrl="#/play?seed=abc123"
        onPlayAgain={onPlayAgain}
        onExitToTitle={onExitToTitle}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Return to title' }))
    expect(onExitToTitle).toHaveBeenCalled()
  })
})

describe('SettingsScreen (US51-53)', () => {
  it('flipping weapon degradation calls onChange with the new config', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SettingsScreen settings={{ ...DEFAULT_CONFIG }} onChange={onChange} onBack={vi.fn()} />)
    await user.click(screen.getByRole('switch', { name: 'Weapon degradation' }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_CONFIG, weaponDegradation: false })
  })

  it('reflects canonical defaults and notes next-run scope', () => {
    render(<SettingsScreen settings={{ ...DEFAULT_CONFIG }} onChange={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Run-away restriction' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByText(/Applies to your next run/)).toBeInTheDocument()
  })
})

describe('StatsScreen (US47-50)', () => {
  const stats: StatsData = {
    gamesPlayed: 4,
    wins: 3,
    losses: 1,
    bestScore: 17,
    currentStreak: 2,
    bestStreak: 3,
    runs: [
      {
        seed: 'abc123',
        config: { ...DEFAULT_CONFIG },
        outcome: 'won',
        score: 17,
        date: 1_700_000_000_000,
        roomsCleared: 11,
      },
      {
        seed: 'zz9900',
        config: { runAwayMode: 'unlimited', potionsPerRoom: 'unlimited', weaponDegradation: false },
        outcome: 'lost',
        score: -9,
        date: 1_699_000_000_000,
        roomsCleared: 6,
      },
    ],
  }

  it('renders aggregates and history rows', () => {
    render(<StatsScreen stats={stats} onReplay={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getAllByText('17').length).toBeGreaterThan(0) // best score + history score
    expect(screen.getAllByText('Won').length).toBeGreaterThan(0) // tile label + outcome badge
    expect(screen.getByText(/Seed zz9900/)).toBeInTheDocument()
    // Toggle chips only for non-canonical runs.
    expect(screen.getByText('Potions: ∞')).toBeInTheDocument()
    expect(screen.queryAllByText('No weapon wear')).toHaveLength(1)
  })

  it('Replay dispatches the record (US50)', async () => {
    const user = userEvent.setup()
    const onReplay = vi.fn()
    render(<StatsScreen stats={stats} onReplay={onReplay} onBack={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Replay run abc123' }))
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ seed: 'abc123' }))
  })

  it('shows the empty ledger before any run', () => {
    render(
      <StatsScreen
        stats={{
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          bestScore: 0,
          currentStreak: 0,
          bestStreak: 0,
          runs: [],
        }}
        onReplay={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByText(/No runs on the ledger yet/)).toBeInTheDocument()
  })
})
