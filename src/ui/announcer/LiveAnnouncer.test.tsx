// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, DEFAULT_CONFIG } from '../../engine'
import type { GameState } from '../../engine'
import { freshStoreData, useGameStore } from '../store/gameStore'
import { LiveAnnouncer } from './LiveAnnouncer'

function statusText(): string {
  const text = screen.getByRole('status').textContent
  return typeof text === 'string' ? text : ''
}

/** Crafted engine state with a room-start snapshot attached (like DealRoom). */
function craftedState(overrides: Partial<GameState>): GameState {
  const base: GameState = {
    ...createInitialState('annseed1', DEFAULT_CONFIG, 1_000),
    ...overrides,
  }
  const snapshot: GameState = { ...base, roomSnapshot: null }
  return { ...base, roomSnapshot: snapshot }
}

/** Set the singleton store's engine state inside an act() boundary. */
function setEngineState(state: GameState): void {
  act(() => {
    useGameStore.setState({ state })
  })
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
  act(() => {
    useGameStore.setState(freshStoreData())
  })
})

afterEach(() => {
  cleanup()
})

describe('LiveAnnouncer', () => {
  it('is a polite, atomic, visually-hidden live region', () => {
    const { container } = render(<LiveAnnouncer />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
    expect(container.firstChild).toHaveClass('visually-hidden')
    expect(statusText()).toBe('')
  })

  it('announces a dealt room after New Run (RoomDealt)', () => {
    render(<LiveAnnouncer />)
    act(() => {
      useGameStore.getState().startNewRun('ANN001')
    })
    expect(statusText()).toBe('New room dealt, 4 cards.')
  })

  it('announces combat with damage (MonsterDefeated)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['8C', '3D'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'FightMonster', cardId: '8C', barehanded: true })
    })
    expect(statusText()).toBe('8 of Clubs defeated, took 8 damage.')
  })

  it('announces weapon equips, including the swap discard', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['9D', '3C'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'EquipWeapon', cardId: '9D' })
    })
    expect(statusText()).toBe('9 of Diamonds equipped.')

    act(() => {
      useGameStore.setState({
        state: craftedState({ weapon: '9D', killStack: ['3C'], room: ['5D', '4C'] }),
      })
    })
    act(() => {
      useGameStore.getState().dispatch({ type: 'EquipWeapon', cardId: '5D' })
    })
    expect(statusText()).toBe('5 of Diamonds equipped. 9 of Diamonds and its kills were discarded.')
  })

  it('announces potions healed and poured out (PotionQuaffed)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ hp: 15, room: ['5H', '3C'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'DrinkPotion', cardId: '5H' })
    })
    expect(statusText()).toBe('5 of Hearts quaffed, healed 5.')

    act(() => {
      useGameStore.setState({
        state: craftedState({ hp: 15, room: ['5H', '3C'], potionsUsedThisRoom: 1 }),
      })
    })
    act(() => {
      useGameStore.getState().dispatch({ type: 'DrinkPotion', cardId: '5H' })
    })
    expect(statusText()).toBe('5 of Hearts poured out — only one potion heals per room.')
  })

  it('announces running away (RanAway)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['2C', '3C', '4C', '5C'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'RunAway' })
    })
    expect(statusText()).toBe('Ran away — cannot run next room.')
  })

  it('announces both run-away blocks (RunAwayBlocked)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['2C', '3C', '4C', '5C'], ranAwayLastRoom: true }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'RunAway' })
    })
    expect(statusText()).toBe('Cannot run away two rooms in a row.')

    act(() => {
      useGameStore.setState({
        state: craftedState({ room: ['2C', '3C', '4C'], dungeon: ['5C'] }),
      })
    })
    act(() => {
      useGameStore.getState().dispatch({ type: 'RunAway' })
    })
    expect(statusText()).toBe('Too few cards remain in the dungeon to run away.')
  })

  it('announces undo (UndoDone)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['2C', '3D'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'UndoToRoomStart' })
    })
    expect(statusText()).toBe('Rewound to the start of the room.')
  })

  it('announces invalid actions in human words (InvalidAction)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['3D', '2C'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'FightMonster', cardId: '3D' })
    })
    expect(statusText()).toBe('That card is not a monster.')
  })

  it('announces victory via the terminal payload (GameWon)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ hp: 20, room: ['2H'], dungeon: [] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'DrinkPotion', cardId: '2H' })
    })
    expect(statusText()).toContain('You cleared the dungeon — victory with a score of 20.')
    expect(statusText()).toContain('2 of Hearts quaffed, healed 0.')
  })

  it('announces defeat via the terminal payload (GameLost)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ hp: 1, room: ['KS'], dungeon: ['2C', 'AS'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'FightMonster', cardId: 'KS', barehanded: true })
    })
    expect(statusText()).toContain('K of Spades defeated, took 13 damage.')
    expect(statusText()).toContain('You fell in the dungeon — final score -16.')
  })

  it('re-announces identical sentences (keyed by announcement sequence)', () => {
    render(<LiveAnnouncer />)
    setEngineState(craftedState({ room: ['3D', '2C'] }))
    act(() => {
      useGameStore.getState().dispatch({ type: 'FightMonster', cardId: '3D' })
    })
    const first = screen.getByRole('status').querySelector('span')
    act(() => {
      useGameStore.setState({ state: craftedState({ room: ['3D', '2C'] }) })
    })
    act(() => {
      useGameStore.getState().dispatch({ type: 'FightMonster', cardId: '3D' })
    })
    const second = screen.getByRole('status').querySelector('span')
    expect(second?.textContent).toBe('That card is not a monster.')
    expect(second).not.toBe(first)
  })
})
