// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { StoreApi } from 'zustand'
import { createInitialState, DEFAULT_CONFIG, isMonster, isPotion } from '../../engine'
import type { GameConfig, GameState } from '../../engine'
import { loadRun, loadSettings, loadStats, saveRun } from '../persistence'
import {
  createGameStore,
  selectCanEnterNextRoom,
  selectCanUndo,
  selectDamagePreview,
  selectRunAwayDisabledReason,
} from './gameStore'
import type { GameStore } from './gameStore'

function mustRun(store: StoreApi<GameStore>): GameState {
  const run = store.getState().state
  if (run === null) throw new Error('expected an active run')
  return run
}

function mustSavedRun() {
  const saved = loadRun()
  if (saved === null) throw new Error('expected a saved run shard')
  return saved
}

/** A controllable engine state on top of the real init (44-card dungeon). */
function craftedState(overrides: Partial<GameState>): GameState {
  return { ...createInitialState('craftseed', DEFAULT_CONFIG, 1_000), ...overrides }
}

/** Attach a room-start snapshot the way DealRoom does (snapshot's own is null). */
function withSnapshot(state: GameState): GameState {
  const snapshot: GameState = { ...state, roomSnapshot: null }
  return { ...state, roomSnapshot: snapshot }
}

/** Commit the first room card through the matching engine action. */
function commitFirstCard(store: StoreApi<GameStore>): void {
  const cardId = mustRun(store).room[0]
  if (cardId === undefined) throw new Error('room is empty')
  if (isMonster(cardId)) {
    store.getState().dispatch({ type: 'FightMonster', cardId, barehanded: true })
  } else if (isPotion(cardId)) {
    store.getState().dispatch({ type: 'DrinkPotion', cardId })
  } else {
    store.getState().dispatch({ type: 'EquipWeapon', cardId })
  }
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
})

describe('selection slice', () => {
  it('lives in the store, never in engine state (spec Q45b)', () => {
    const store = createGameStore()
    store.getState().startNewRun('SEED01')
    const run = mustRun(store)

    store.getState().selectCard(run.room[0] ?? null)
    expect(store.getState().selectedCardId).toBe(run.room[0])
    expect(Object.keys(run)).not.toContain('selectedCardId')
    expect(Object.keys(run.roomSnapshot ?? {})).not.toContain('selectedCardId')
  })

  it('a committed dispatch clears the selection', () => {
    const store = createGameStore()
    store.setState({
      state: withSnapshot(craftedState({ room: ['2C', '3D', '4H', '5S'] })),
    })
    store.getState().selectCard('2C')

    const result = store
      .getState()
      .dispatch({ type: 'FightMonster', cardId: '2C', barehanded: true })
    expect(result?.type).toBe('MonsterDefeated')
    expect(mustRun(store).room).toEqual(['3D', '4H', '5S'])
    expect(mustRun(store).hp).toBe(18)
    expect(store.getState().selectedCardId).toBeNull()
  })

  it('an invalid dispatch keeps the selection', () => {
    const store = createGameStore()
    store.setState({
      state: withSnapshot(craftedState({ room: ['2C', '3D', '4H', '5S'] })),
    })
    store.getState().selectCard('3D')
    const result = store.getState().dispatch({ type: 'FightMonster', cardId: '3D' })
    expect(result?.type).toBe('InvalidAction')
    expect(store.getState().selectedCardId).toBe('3D')
  })
})

describe('undo', () => {
  it('restores HP, room, and kill stack via the engine snapshot', () => {
    const store = createGameStore()
    store.setState({
      state: withSnapshot(
        craftedState({
          hp: 15,
          weapon: '5D',
          killStack: ['QC'],
          room: ['3C', '4S'],
          resolvedCount: 0,
          roomSnapshot: null,
        }),
      ),
    })
    // Fight 3C with the 5-weapon: legal (3 < last kill Q=12 → not degraded),
    // damage max(0, 3 − 5) = 0, monster joins the kill stack.
    const fought = store.getState().dispatch({ type: 'FightMonster', cardId: '3C' })
    expect(fought?.type).toBe('MonsterDefeated')
    expect(mustRun(store).killStack).toEqual(['QC', '3C'])
    expect(mustRun(store).room).toEqual(['4S'])
    expect(mustRun(store).resolvedCount).toBe(1)

    store.getState().selectCard('4S')
    const undone = store.getState().dispatch({ type: 'UndoToRoomStart' })
    expect(undone?.type).toBe('UndoDone')

    const run = mustRun(store)
    expect(run.hp).toBe(15)
    expect(run.room).toEqual(['3C', '4S'])
    expect(run.killStack).toEqual(['QC'])
    expect(run.resolvedCount).toBe(0)
    // Undo clears the transient selection but keeps the snapshot (retry-safe).
    expect(store.getState().selectedCardId).toBeNull()
    expect(selectCanUndo(run)).toBe(true)
  })
})

describe('run lifecycle', () => {
  it('New Run persists immediately (StartNewRun + DealRoom + shard write)', () => {
    const store = createGameStore()
    store.getState().startNewRun('PERSIST')

    const saved = mustSavedRun()
    expect(saved.seed).toBe('persist')
    expect(saved.state.room).toHaveLength(4)
    expect(saved.state.phase).toBe('playing')
    expect(saved.outcome).toBeNull()
    expect(saved.statsWritten).toBe(false)
    expect(saved.config).toEqual(DEFAULT_CONFIG)
    expect(store.getState().hasSavedRun).toBe(true)
    expect(window.location.hash).toBe('#/play')
  })

  it('Continue works only when a shard exists', () => {
    const store = createGameStore()
    expect(store.getState().hasSavedRun).toBe(false)
    expect(store.getState().continueRun()).toBe(false)
    expect(store.getState().state).toBeNull()
    expect(window.location.hash).toBe('#/')

    store.getState().startNewRun('WCBBB1')
    const fresh = createGameStore()
    expect(fresh.getState().hasSavedRun).toBe(true)
    expect(fresh.getState().continueRun()).toBe(true)
    expect(mustRun(fresh).seed).toBe('wcbbb1')
  })

  it('run shard round-trips save → reload mid-run (US43)', () => {
    const a = createGameStore()
    a.getState().startNewRun('RELOAD1')
    commitFirstCard(a)
    a.getState().selectCard(mustRun(a).room[0] ?? null)
    const before = JSON.stringify(mustRun(a))

    const b = createGameStore()
    expect(b.getState().continueRun()).toBe(true)
    // Snapshot included: the mid-room undo seam survives the reload.
    expect(JSON.stringify(mustRun(b))).toBe(before)
    expect(b.getState().outcome).toBeNull()
    // Selection is ephemeral and does not survive a reload.
    expect(b.getState().selectedCardId).toBeNull()
  })

  it('seeded URL yields identical first rooms across two store instances (US62)', () => {
    const a = createGameStore()
    a.getState().startRunFromUrl('AAAAAA')
    const roomA = mustRun(a).room
    const dungeonA = mustRun(a).dungeon

    localStorage.clear()
    const b = createGameStore()
    b.getState().startRunFromUrl('AAAAAA')
    expect(mustRun(b).room).toEqual(roomA)
    expect(mustRun(b).dungeon).toEqual(dungeonA)
    expect(mustRun(b).seed).toBe('aaaaaa')
  })

  it('a matching saved run is resumed instead of clobbered by the URL', () => {
    const a = createGameStore()
    a.getState().startNewRun('RESUME1')
    commitFirstCard(a)
    const progressed = JSON.stringify(mustRun(a))

    const b = createGameStore()
    b.getState().startRunFromUrl('resume1')
    expect(JSON.stringify(mustRun(b))).toBe(progressed)
  })

  it('a URL describing the live run does not redeal it', () => {
    const store = createGameStore()
    store.getState().startNewRun('KEEPME1')
    const live = mustRun(store)
    store.getState().startRunFromUrl('keepme1')
    expect(mustRun(store)).toBe(live)
  })
})

describe('terminal handling', () => {
  const craftDoom = (store: StoreApi<GameStore>): void => {
    store.setState({
      state: withSnapshot(
        craftedState({ seed: 'doomed1', hp: 1, room: ['KS'], dungeon: [], resolvedCount: 0 }),
      ),
    })
  }

  it('writes the outcome inline and folds stats exactly once across reloads (US42)', () => {
    const a = createGameStore()
    a.getState().startNewRun('DOOMED1')
    craftDoom(a)

    const result = a.getState().dispatch({ type: 'FightMonster', cardId: 'KS', barehanded: true })
    expect(result?.type).toBe('GameLost')
    expect(a.getState().outcome).toEqual({ type: 'lost', score: 0 })

    const saved = mustSavedRun()
    expect(saved.outcome).toEqual({ type: 'lost', score: 0 })
    expect(saved.statsWritten).toBe(true)
    expect(loadStats().gamesPlayed).toBe(1)
    expect(loadStats().runs).toHaveLength(1)

    // Simulates completing the same run twice via rehydrate: +0, not +1.
    const b = createGameStore()
    expect(b.getState().continueRun()).toBe(true)
    expect(b.getState().outcome).toEqual({ type: 'lost', score: 0 })
    expect(loadStats().gamesPlayed).toBe(1)
    expect(loadStats().runs).toHaveLength(1)

    const c = createGameStore()
    expect(c.getState().continueRun()).toBe(true)
    expect(loadStats().gamesPlayed).toBe(1)
  })

  it('a shard interrupted before statsWritten folds stats exactly once', () => {
    const a = createGameStore()
    a.getState().startNewRun('HALFDONE')
    const run = mustRun(a)
    saveRun({
      state: { ...run, phase: 'lost' },
      seed: run.seed,
      config: run.config,
      startedAt: run.startedAt,
      outcome: { type: 'lost', score: -5 },
      statsWritten: false,
    })

    const b = createGameStore()
    expect(b.getState().continueRun()).toBe(true)
    expect(loadStats().gamesPlayed).toBe(1)
    expect(mustSavedRun().statsWritten).toBe(true)

    const c = createGameStore()
    expect(c.getState().continueRun()).toBe(true)
    expect(loadStats().gamesPlayed).toBe(1)
  })

  it('returning to title clears a finished run but keeps lifetime stats', () => {
    const a = createGameStore()
    a.getState().startNewRun('DOOMED1')
    craftDoom(a)
    a.getState().dispatch({ type: 'FightMonster', cardId: 'KS', barehanded: true })

    a.getState().exitToTitle()
    expect(loadRun()).toBeNull()
    expect(loadStats().gamesPlayed).toBe(1)
    expect(a.getState().state).toBeNull()
    expect(a.getState().outcome).toBeNull()
    expect(a.getState().hasSavedRun).toBe(false)
    expect(window.location.hash).toBe('#/')
  })

  it('mid-run exit to title keeps the shard for Continue', () => {
    const a = createGameStore()
    a.getState().startNewRun('STAYME1')
    a.getState().exitToTitle()
    expect(loadRun()).not.toBeNull()

    const b = createGameStore()
    expect(b.getState().continueRun()).toBe(true)
    expect(mustRun(b).seed).toBe('stayme1')
  })
})

describe('settings slice', () => {
  it('saves immediately, and never mutates the config of an active run', () => {
    const store = createGameStore()
    store.getState().startNewRun('CFG111')
    const runConfigBefore = mustRun(store).config

    const toggled: GameConfig = {
      runAwayMode: 'unlimited',
      potionsPerRoom: 'unlimited',
      weaponDegradation: false,
    }
    store.getState().setSettings(toggled)
    expect(loadSettings()).toEqual(toggled)
    expect(mustRun(store).config).toEqual(runConfigBefore)

    store.getState().startNewRun('CFG222')
    expect(mustRun(store).config).toEqual(toggled)
  })
})

describe('selectors', () => {
  it('damage preview reads weapon, kill stack, and degradation per config', () => {
    const barehandedOnly = craftedState({ room: ['8C'] })
    expect(selectDamagePreview(barehandedOnly, '8C')).toEqual({
      kind: 'monster',
      weaponDamage: null,
      barehandedDamage: 8,
      weaponBlocked: false,
    })

    const armed = craftedState({ weapon: '5D', killStack: ['QC'], room: ['3C'] })
    expect(selectDamagePreview(armed, '3C')).toEqual({
      kind: 'monster',
      weaponDamage: 0,
      barehandedDamage: 3,
      weaponBlocked: false,
    })

    const degraded = craftedState({ weapon: '5D', killStack: ['5C'], room: ['8C'] })
    expect(selectDamagePreview(degraded, '8C')).toEqual({
      kind: 'monster',
      weaponDamage: null,
      barehandedDamage: 8,
      weaponBlocked: true,
    })

    const noDegradation = craftedState({
      weapon: '5D',
      killStack: ['5C'],
      room: ['8C'],
      config: { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: false },
    })
    expect(selectDamagePreview(noDegradation, '8C')).toEqual({
      kind: 'monster',
      weaponDamage: 3,
      barehandedDamage: 8,
      weaponBlocked: false,
    })

    const thirsty = craftedState({ hp: 18, room: ['3H'] })
    expect(selectDamagePreview(thirsty, '3H')).toEqual({ kind: 'potion', healed: 2, wasted: false })
    const slaked = craftedState({ room: ['3H'], potionsUsedThisRoom: 1 })
    expect(selectDamagePreview(slaked, '3H')).toEqual({ kind: 'potion', healed: 0, wasted: true })

    const swap = craftedState({ weapon: '5D', killStack: ['QC', '3C'], room: ['9D'] })
    expect(selectDamagePreview(swap, '9D')).toEqual({
      kind: 'weapon',
      discardedWeaponId: '5D',
      discardedKillCount: 2,
    })
    expect(selectDamagePreview(null, '9D')).toEqual({ kind: 'unknown' })
  })

  it('run-away gate reasons mirror config + ranAwayLastRoom + deck size', () => {
    const open = craftedState({ room: ['2C', '3C', '4C', '5C'] })
    expect(selectRunAwayDisabledReason(open)).toBeNull()

    // An already-faced room can never be fled (rules.md L21).
    expect(selectRunAwayDisabledReason({ ...open, room: ['3C', '4C', '5C'], resolvedCount: 1 })).toBe(
      'room-in-progress',
    )
    expect(selectRunAwayDisabledReason({ ...open, ranAwayLastRoom: true })).toBe('twice-in-row')
    expect(
      selectRunAwayDisabledReason({
        ...open,
        ranAwayLastRoom: true,
        config: { ...open.config, runAwayMode: 'unlimited' },
      }),
    ).toBeNull()
    expect(selectRunAwayDisabledReason({ ...open, dungeon: ['2C'] })).toBe('no-cards')
    expect(selectRunAwayDisabledReason({ ...open, room: [] })).toBe('no-room')
    expect(selectRunAwayDisabledReason({ ...open, phase: 'won' })).toBe('not-playing')
    expect(selectRunAwayDisabledReason(null)).toBe('not-playing')
  })

  it('canUndo and canEnterNextRoom track the current-room seam', () => {
    expect(selectCanUndo(null)).toBe(false)
    const dealt = withSnapshot(craftedState({ room: ['2C', '3D', '4H', '5S'] }))
    expect(selectCanUndo(dealt)).toBe(true)
    expect(selectCanUndo({ ...dealt, roomSnapshot: null })).toBe(false)
    expect(selectCanUndo({ ...dealt, phase: 'won' })).toBe(false)

    expect(selectCanEnterNextRoom(dealt)).toBe(false)
    expect(selectCanEnterNextRoom({ ...dealt, resolvedCount: 3 })).toBe(true)
    // Final partial room resolves in full (target = room + resolved): one of a
    // 2-card final room done means one still left → still not enterable.
    const finalRoom = craftedState({ dungeon: [], room: ['2C'], resolvedCount: 1 })
    expect(selectCanEnterNextRoom(finalRoom)).toBe(false)
    expect(selectCanEnterNextRoom({ ...finalRoom, room: [], resolvedCount: 2 })).toBe(false)
  })
})
