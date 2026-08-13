// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../../engine/types'
import { DEFAULT_CONFIG } from '../../engine/types'
import {
  clearSavedRun,
  loadRun,
  loadSettings,
  loadStats,
  saveRun,
  saveSettings,
  saveStats,
} from './storage'
import { defaultStats, makeRunRecord, updateStats } from './stats'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  type RunData,
  type SettingsData,
  type StatsData,
} from './types'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'abc123',
    config: { ...DEFAULT_CONFIG },
    phase: 'playing',
    hp: 14,
    maxHp: 20,
    dungeon: ['8C', '10D', '5S'],
    room: ['QH', 'AS'],
    resolvedCount: 1,
    weapon: '10D',
    killStack: ['8C'],
    potionsUsedThisRoom: 1,
    ranAwayLastRoom: false,
    turnCount: 3,
    runHighlights: { monstersKilled: 1, potionsWasted: 0, roomsExplored: 2 },
    startedAt: 1700000000000,
    roomSnapshot: null,
    ...overrides,
  }
}

function makeRunData(overrides: Partial<RunData> = {}): RunData {
  return {
    state: makeState(),
    seed: 'abc123',
    config: { ...DEFAULT_CONFIG },
    startedAt: 1700000000000,
    outcome: null,
    statsWritten: false,
    ...overrides,
  }
}

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return { ...defaultStats(), ...overrides }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('round-trips', () => {
  it('returns default settings when nothing is stored, then round-trips saved settings', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)

    const settings: SettingsData = {
      runAwayMode: 'unlimited',
      potionsPerRoom: 'unlimited',
      weaponDegradation: false,
    }
    expect(saveSettings(settings)).toBe(true)
    expect(loadSettings()).toEqual(settings)
  })

  it('returns default stats when nothing is stored, then round-trips saved stats', () => {
    expect(loadStats()).toEqual(defaultStats())

    const record = makeRunRecord({
      seed: 'abc123',
      config: DEFAULT_CONFIG,
      outcome: 'won',
      score: 12,
      roomsCleared: 11,
      date: 1700000001000,
    })
    const stats = updateStats(defaultStats(), record)
    expect(saveStats(stats)).toBe(true)
    expect(loadStats()).toEqual(stats)
  })

  it('returns null when no run is stored, then round-trips an in-progress run', () => {
    expect(loadRun()).toBeNull()

    const run = makeRunData()
    expect(saveRun(run)).toBe(true)
    expect(loadRun()).toEqual(run)
  })

  it('round-trips a finished run with its inline terminal outcome and statsWritten flag (Q37b/Q42)', () => {
    const run = makeRunData({
      state: makeState({ phase: 'won' }),
      outcome: { type: 'won', score: 7 },
      statsWritten: true,
    })
    expect(saveRun(run)).toBe(true)
    expect(loadRun()).toEqual(run)
  })

  it('keeps the three shards independent (Q45)', () => {
    saveSettings({ ...DEFAULT_CONFIG, weaponDegradation: false })
    saveStats(makeStats({ gamesPlayed: 3 }))
    saveRun(makeRunData())

    expect(clearSavedRun()).toBe(true)
    expect(loadRun()).toBeNull()
    expect(loadSettings()).toEqual({ ...DEFAULT_CONFIG, weaponDegradation: false })
    expect(loadStats().gamesPlayed).toBe(3)
  })

  it('survives a nested room snapshot (per-room undo seam) through JSON', () => {
    const snapshot = makeState({ turnCount: 2, roomSnapshot: null })
    const run = makeRunData({ state: makeState({ roomSnapshot: snapshot }) })
    expect(saveRun(run)).toBe(true)
    expect(loadRun()).toEqual(run)
  })
})

describe('corrupt or foreign data falls back to defaults without throwing', () => {
  it('corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{oops')
    window.localStorage.setItem(STORAGE_KEYS.stats, 'not json at all')
    window.localStorage.setItem(STORAGE_KEYS.run, '[1,2,')

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadStats()).toEqual(defaultStats())
    expect(loadRun()).toBeNull()
  })

  it('valid JSON that is not a versioned wrapper', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{"runAwayMode":"once"}')
    window.localStorage.setItem(STORAGE_KEYS.stats, '42')
    window.localStorage.setItem(STORAGE_KEYS.run, 'null')

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadStats()).toEqual(defaultStats())
    expect(loadRun()).toBeNull()
  })

  it('wrapper whose data fails shape validation', () => {
    const wrap = (data: unknown) => JSON.stringify({ version: 1, data })
    window.localStorage.setItem(STORAGE_KEYS.settings, wrap({ runAwayMode: 'sometimes' }))
    window.localStorage.setItem(STORAGE_KEYS.stats, wrap({ gamesPlayed: 'three' }))
    window.localStorage.setItem(STORAGE_KEYS.run, wrap({ seed: 7, statsWritten: 'yes' }))

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadStats()).toEqual(defaultStats())
    expect(loadRun()).toBeNull()
  })

  it('wrapper from a newer schema version than this build understands', () => {
    const validStats = makeStats({ gamesPlayed: 9 })
    window.localStorage.setItem(
      STORAGE_KEYS.stats,
      JSON.stringify({ version: 99, data: validStats }),
    )
    expect(loadStats()).toEqual(defaultStats())
    // Not clobbered on disk — a newer build can still read it back.
    expect(window.localStorage.getItem(STORAGE_KEYS.stats)).toContain('"version":99')
  })

  it('salvages valid run-history entries while dropping malformed ones', () => {
    const good = makeRunRecord({
      seed: 'ok',
      config: DEFAULT_CONFIG,
      outcome: 'lost',
      score: -4,
      roomsCleared: 2,
      date: 1700000002000,
    })
    const stats = makeStats({ gamesPlayed: 2, losses: 2, runs: [good] })
    const tampered = { ...stats, runs: [good, { seed: 123 }] }
    window.localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify({ version: 1, data: tampered }))
    expect(loadStats().runs).toEqual([good])
  })
})

describe('unavailable storage (SSR / private mode / quota)', () => {
  it('reads fall back to defaults when the localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadStats()).toEqual(defaultStats())
    expect(loadRun()).toBeNull()
  })

  it('writes/clears report failure when storage methods throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    expect(saveSettings(DEFAULT_SETTINGS)).toBe(false)
    expect(saveStats(defaultStats())).toBe(false)
    expect(saveRun(makeRunData())).toBe(false)
    expect(clearSavedRun()).toBe(false)
  })

  it('reads fall back to defaults when storage methods throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(loadStats()).toEqual(defaultStats())
    expect(loadRun()).toBeNull()
  })
})
