/**
 * App shell store (docs/spec.md "UI interaction model", "Routing & flow").
 *
 * Zustand store with five slices:
 *  a) engine truth — `state` is the reducer's GameState; `dispatch` wraps the
 *     pure reducer and handles persistence + announcements as side effects;
 *  b) selection — `selectedCardId`, the transient card highlight. Deliberately
 *     NOT part of GameState (spec Q45b): undo/snapshots never touch it, and
 *     committed actions + undo clear it;
 *  c) settings — the GameConfig for NEW runs, loaded/saved via the
 *     `scoundrel:settings` shard. An active run keeps its own config snapshot;
 *  d) route — the current hash route, synced by startRouter();
 *  e) hasSavedRun — derived from `scoundrel:run` shard presence (drives the
 *     title screen's Continue button).
 *
 * Persistence policy: every committed action except the StartNewRun
 * placeholder saves the full run shard (US43); terminal results additionally
 * write the outcome inline into the shard and fold the run into the stats
 * shard exactly once, guarded by `statsWritten` (US42/Q37b).
 */

import { create } from 'zustand'
import type { StateCreator, StoreApi } from 'zustand'
import { createStore } from 'zustand/vanilla'
import {
  cardValue,
  createInitialState,
  DEFAULT_CONFIG,
  isMonster,
  isPotion,
  isWeapon,
  randomSeed,
  reducer,
} from '../../engine'
import type { CardId, GameAction, GameConfig, GameResult, GameState } from '../../engine'
import { resultToAnnouncement } from '../announcer/resultToAnnouncement'
import {
  clearSavedRun,
  loadRun,
  loadSettings,
  loadStats,
  makeRunRecord,
  saveRun,
  saveSettings,
  saveStats,
  updateStats,
} from '../persistence'
import type { RunData } from '../persistence'
import { navigate, normalizeSeed, parseHashRoute } from '../router/router'
import type { Route } from '../router/router'

/** Live-region message; `seq` lets identical sentences re-announce. */
export interface Announcement {
  seq: number
  text: string
}

/** Terminal outcome, mirroring RunData.outcome. */
export interface RunOutcome {
  type: 'won' | 'lost'
  score: number
}

/** Data-only slice of the store (everything but the actions). */
export interface GameStoreData {
  /** Engine truth — null before a run starts. Selection is never in here. */
  state: GameState | null
  outcome: RunOutcome | null
  /** Mirrors the shard's idempotent-stats flag (write exactly once per run). */
  statsWritten: boolean
  lastResult: GameResult | null
  announcement: Announcement | null
  /** Transient card highlight; cleared by committed actions and undo. */
  selectedCardId: CardId | null
  /** House-rule toggles for NEW runs; the active run keeps its own config. */
  settings: GameConfig
  route: Route
  hasSavedRun: boolean
}

export interface GameStore extends GameStoreData {
  /**
   * Wrap the pure reducer: applies the action, announces the result, clears
   * the selection on committed actions (incl. undo), persists the run shard,
   * and handles the terminal outcome + one-time stats write. Returns the
   * result so callers can inspect committed/blocked/invalid. No-op (null)
   * when no run is active.
   */
  dispatch: (action: GameAction) => GameResult | null
  selectCard: (cardId: CardId | null) => void
  /** Persist house-rule toggles immediately (scoundrel:settings). NEW runs only. */
  setSettings: (config: GameConfig) => void
  announce: (text: string) => void
  /** US3: fresh seeded run; StartNewRun + DealRoom, persist, navigate #/play. */
  startNewRun: (seed?: string, config?: GameConfig) => void
  /** US2/US44: hydrate the saved run (or its terminal screen); false when none. */
  continueRun: () => boolean
  /**
   * US62: '#/play?seed=X[&config=Y]' boot. Resumes a saved run when its
   * seed+config match (never clobbering a different in-progress run); starts
   * the URL's run otherwise. An absent config falls back to current settings.
   */
  startRunFromUrl: (rawSeed: string, urlConfig?: GameConfig) => void
  /** Terminal runs clear the saved shard (US41); mid-run exits keep it. */
  exitToTitle: () => void
  /** Re-derive hasSavedRun from shard presence. */
  refreshSavedRunFlag: () => void
  /** Parse location.hash, boot a seeded URL when present, sync the route slice. */
  syncRouteFromLocation: () => void
  /** Boot once, then keep the route slice synced on hashchange. Returns unsubscribe. */
  startRouter: () => () => void
}

function currentHash(): string {
  return typeof window === 'undefined' ? '#/' : window.location.hash
}

/** A fresh data snapshot (e.g. test resets); actions are added by the store. */
export function freshStoreData(): GameStoreData {
  return {
    state: null,
    outcome: null,
    statsWritten: false,
    lastResult: null,
    announcement: null,
    selectedCardId: null,
    settings: loadSettings(),
    route: parseHashRoute(currentHash()),
    hasSavedRun: loadRun() !== null,
  }
}

// ---------------------------------------------------------------------------
// Selectors (pure; safe to use outside React and in tests)

/**
 * Mirror of the engine's roomResolveTarget (not exported): a room is complete
 * after 3 resolutions, or must be fully resolved once the dungeon is empty
 * (final partial room). Keep in lockstep with src/engine/reducer.ts.
 */
function resolveTargetOf(state: GameState): number {
  return state.dungeon.length === 0 ? state.room.length + state.resolvedCount : 3
}

/** Undo is available only within the current room (spec US34). */
export function selectCanUndo(state: GameState | null): boolean {
  return state !== null && state.phase === 'playing' && state.roomSnapshot !== null
}

/** Enter Next Room is enabled only when the current room is complete (US12). */
export function selectCanEnterNextRoom(state: GameState | null): boolean {
  return (
    state !== null &&
    state.phase === 'playing' &&
    state.room.length > 0 &&
    state.resolvedCount >= resolveTargetOf(state)
  )
}

export type RunAwayGate = 'not-playing' | 'no-room' | 'room-in-progress' | 'twice-in-row' | 'no-cards'

/**
 * Greyed-out reason for the Run Away button (US31), mirroring the engine's
 * gates in order: not playing → no room → room already faced (rules.md L21
 * allows fleeing only an unfaced room) → twice-in-row (mode 'once') →
 * dungeon.length < 4 so a fresh room can't be dealt.
 */
export function selectRunAwayDisabledReason(state: GameState | null): RunAwayGate | null {
  if (state?.phase !== 'playing') return 'not-playing'
  if (state.room.length === 0) return 'no-room'
  if (state.resolvedCount > 0) return 'room-in-progress'
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) return 'twice-in-row'
  if (state.dungeon.length < 4) return 'no-cards'
  return null
}

/** Damage/cost preview for a card (US15), computed from engine truth + config. */
export type DamagePreview =
  | {
      kind: 'monster'
      /** Damage fighting with the equipped weapon; null when none or degradation blocks it. */
      weaponDamage: number | null
      /** Damage fighting barehanded (always legal). */
      barehandedDamage: number
      /** weaponDegradation blocks weapon use against this monster. */
      weaponBlocked: boolean
    }
  | { kind: 'potion'; healed: number; wasted: boolean }
  | { kind: 'weapon'; discardedWeaponId: CardId | null; discardedKillCount: number }
  | { kind: 'unknown' }

export function selectDamagePreview(state: GameState | null, cardId: CardId): DamagePreview {
  if (state === null) return { kind: 'unknown' }
  if (isMonster(cardId)) {
    const monster = cardValue(cardId)
    const weapon = state.weapon
    if (weapon === null) {
      return {
        kind: 'monster',
        weaponDamage: null,
        barehandedDamage: monster,
        weaponBlocked: false,
      }
    }
    const lastKill = state.killStack.at(-1)
    const weaponBlocked =
      state.config.weaponDegradation && lastKill !== undefined && monster >= cardValue(lastKill)
    return {
      kind: 'monster',
      weaponDamage: weaponBlocked ? null : Math.max(0, monster - cardValue(weapon)),
      barehandedDamage: monster,
      weaponBlocked,
    }
  }
  if (isPotion(cardId)) {
    const cap = state.config.potionsPerRoom === 'unlimited' ? Number.POSITIVE_INFINITY : 1
    const wasted = state.potionsUsedThisRoom >= cap
    const healed = wasted ? 0 : Math.min(state.maxHp, state.hp + cardValue(cardId)) - state.hp
    return { kind: 'potion', healed, wasted }
  }
  if (isWeapon(cardId)) {
    return {
      kind: 'weapon',
      discardedWeaponId: state.weapon,
      discardedKillCount: state.killStack.length,
    }
  }
  return { kind: 'unknown' }
}

// ---------------------------------------------------------------------------
// Internals

function configsEqual(a: GameConfig, b: GameConfig): boolean {
  return (
    a.runAwayMode === b.runAwayMode &&
    a.potionsPerRoom === b.potionsPerRoom &&
    a.weaponDegradation === b.weaponDegradation
  )
}

/** Fold one terminal run into the stats shard (idempotency is the caller's job). */
function foldRunIntoStats(runState: GameState, outcome: RunOutcome): void {
  const record = makeRunRecord({
    seed: runState.seed,
    config: runState.config,
    outcome: outcome.type,
    score: outcome.score,
    roomsCleared: runState.runHighlights.roomsExplored,
  })
  saveStats(updateStats(loadStats(), record))
}

/** Write the run shard in the pinned RunData shape. */
function persistRun(runState: GameState, outcome: RunOutcome | null, statsWritten: boolean): void {
  saveRun({
    state: runState,
    seed: runState.seed,
    config: runState.config,
    startedAt: runState.startedAt,
    outcome,
    statsWritten,
  })
}

function terminalResumeText(outcome: RunOutcome): string {
  return outcome.type === 'won'
    ? `Victory screen restored — final score ${String(outcome.score)}.`
    : `Defeat screen restored — final score ${String(outcome.score)}.`
}

const gameStoreInitializer: StateCreator<GameStore> = (set, get) => {
  const announce = (text: string): void => {
    const seq = (get().announcement?.seq ?? 0) + 1
    set({ announcement: { seq, text } })
  }

  /**
   * Hydrate a saved run shard into the store. Reload-safety (US41/US42): an
   * inline terminal outcome restores the win/lose screen, and the stats fold
   * runs only when the shard hasn't already recorded it — reloads re-hydrate
   * the outcome but never double-count the run.
   */
  const hydrateSavedRun = (saved: RunData): void => {
    let statsWritten = saved.statsWritten
    if (saved.outcome !== null && !statsWritten) {
      foldRunIntoStats(saved.state, saved.outcome)
      statsWritten = true
      persistRun(saved.state, saved.outcome, true)
    }
    set({
      state: saved.state,
      outcome: saved.outcome,
      statsWritten,
      lastResult: null,
      selectedCardId: null,
      hasSavedRun: true,
    })
    announce(saved.outcome !== null ? terminalResumeText(saved.outcome) : 'Saved run restored.')
  }

  return {
    ...freshStoreData(),

    dispatch: (action) => {
      const current = get().state
      // StartNewRun boots from nothing — the reducer reads only seed/config
      // and ignores its input state, so a placeholder state is fine.
      if (current === null && action.type !== 'StartNewRun') return null
      const { state: next, result } = reducer(
        current ?? createInitialState('', DEFAULT_CONFIG),
        action,
      )
      // Blocked/invalid results leave state untouched — not "committed".
      const committed = result.type !== 'InvalidAction' && result.type !== 'RunAwayBlocked'
      const terminal = result.type === 'GameWon' || result.type === 'GameLost'

      let outcome = get().outcome
      if (result.type === 'GameWon') outcome = { type: 'won', score: result.score }
      if (result.type === 'GameLost') outcome = { type: 'lost', score: result.score }

      let statsWritten = get().statsWritten
      if (terminal && outcome !== null && !statsWritten) {
        foldRunIntoStats(next, outcome)
        statsWritten = true
      }

      set({
        state: next,
        lastResult: result,
        outcome,
        statsWritten,
        ...(committed ? { selectedCardId: null } : {}),
      })
      announce(resultToAnnouncement(result, next.config))

      if (committed && action.type !== 'StartNewRun') {
        persistRun(next, outcome, statsWritten)
        if (!get().hasSavedRun) set({ hasSavedRun: true })
      }
      return result
    },

    selectCard: (cardId) => {
      set({ selectedCardId: cardId })
    },

    setSettings: (config) => {
      const next = { ...config }
      saveSettings(next)
      set({ settings: next })
    },

    announce,

    startNewRun: (seed, config) => {
      // Seeds are stored in canonical lowercase base36 form so replay URLs,
      // stats records, and saved-run matching all compare equal (the PRNG
      // folds case anyway, but the stored string is user-visible).
      const runSeed = seed === undefined ? randomSeed() : normalizeSeed(seed)
      if (runSeed === null) {
        throw new Error('startNewRun: seed must be 1-16 base36 characters')
      }
      const runConfig: GameConfig = { ...(config ?? get().settings) }
      set({ outcome: null, statsWritten: false, lastResult: null, selectedCardId: null })
      get().dispatch({ type: 'StartNewRun', seed: runSeed, config: runConfig })
      get().dispatch({ type: 'DealRoom' })
      navigate('/play')
    },

    continueRun: () => {
      const saved = loadRun()
      if (saved === null) {
        get().refreshSavedRunFlag()
        return false
      }
      hydrateSavedRun(saved)
      navigate('/play')
      return true
    },

    startRunFromUrl: (rawSeed, urlConfig) => {
      const seed = normalizeSeed(rawSeed)
      if (seed === null) {
        navigate('/')
        return
      }
      const config = urlConfig ?? get().settings
      // Never clobber the in-progress run this URL already describes.
      const current = get().state
      if (current !== null && current.seed === seed && configsEqual(current.config, config)) {
        return
      }
      const saved = loadRun()
      if (saved !== null && saved.seed === seed && configsEqual(saved.config, config)) {
        hydrateSavedRun(saved)
        return
      }
      get().startNewRun(seed, config)
    },

    exitToTitle: () => {
      if (get().outcome !== null) clearSavedRun()
      set({
        state: null,
        outcome: null,
        statsWritten: false,
        lastResult: null,
        selectedCardId: null,
      })
      get().refreshSavedRunFlag()
      navigate('/')
    },

    refreshSavedRunFlag: () => {
      set({ hasSavedRun: loadRun() !== null })
    },

    syncRouteFromLocation: () => {
      const route = parseHashRoute(currentHash())
      if (route.name === 'play' && route.seed !== undefined) {
        get().startRunFromUrl(route.seed, route.config)
      }
      // Re-parse: startRunFromUrl may have navigated (stripping URL params).
      set({ route: parseHashRoute(currentHash()) })
    },

    startRouter: () => {
      get().syncRouteFromLocation()
      const onHashChange = (): void => {
        get().syncRouteFromLocation()
      }
      window.addEventListener('hashchange', onHashChange)
      return () => {
        window.removeEventListener('hashchange', onHashChange)
      }
    },
  }
}

/** App-wide singleton store (imported by components). */
export const useGameStore = create<GameStore>()(gameStoreInitializer)

/** Fresh independent store (tests: determinism/reload across "two instances"). */
export function createGameStore(): StoreApi<GameStore> {
  return createStore<GameStore>()(gameStoreInitializer)
}
