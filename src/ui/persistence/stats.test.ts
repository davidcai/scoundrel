// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine/types'
import { DEFAULT_RUNS_CAP, defaultStats, makeRunRecord, updateStats } from './stats'
import type { RunRecord } from './types'

let dateCounter = 1700000000000

function record(outcome: 'won' | 'lost', score: number): RunRecord {
  dateCounter += 1000
  return makeRunRecord({
    seed: 'abc123',
    config: DEFAULT_CONFIG,
    outcome,
    score,
    roomsCleared: 11,
    date: dateCounter,
  })
}

function chain(...records: RunRecord[]) {
  return records.reduce(updateStats, defaultStats())
}

afterEach(() => {
  vi.useRealTimers()
})

describe('defaultStats', () => {
  it('is zeroed with an empty run history', () => {
    expect(defaultStats()).toEqual({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      bestScore: 0,
      currentStreak: 0,
      bestStreak: 0,
      runs: [],
    })
  })

  it('returns a fresh mutable copy each call', () => {
    const a = defaultStats()
    a.runs.push(record('won', 5))
    expect(defaultStats().runs).toHaveLength(0)
  })
})

describe('makeRunRecord', () => {
  it('builds a record from explicit fields', () => {
    const r = makeRunRecord({
      seed: 'xyz789',
      config: { runAwayMode: 'unlimited', potionsPerRoom: 1, weaponDegradation: true },
      outcome: 'lost',
      score: -6,
      roomsCleared: 3,
      date: 42,
    })
    expect(r).toEqual({
      seed: 'xyz789',
      config: { runAwayMode: 'unlimited', potionsPerRoom: 1, weaponDegradation: true },
      outcome: 'lost',
      score: -6,
      roomsCleared: 3,
      date: 42,
    })
  })

  it('defaults date to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-11-14T22:13:20Z'))
    const r = makeRunRecord({
      seed: 's',
      config: DEFAULT_CONFIG,
      outcome: 'won',
      score: 20,
      roomsCleared: 12,
    })
    expect(r.date).toBe(new Date('2025-11-14T22:13:20Z').getTime())
  })
})

describe('updateStats aggregation math (Q47)', () => {
  it('counts a win: wins/gamesPlayed up, streak starts, run prepended', () => {
    const stats = updateStats(defaultStats(), record('won', 15))
    expect(stats).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      bestScore: 15,
      currentStreak: 1,
      bestStreak: 1,
    })
    expect(stats.runs).toHaveLength(1)
    expect(stats.runs[0]?.outcome).toBe('won')
  })

  it('counts a loss: losses up, streak stays at zero', () => {
    const stats = updateStats(defaultStats(), record('lost', -8))
    expect(stats).toMatchObject({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      currentStreak: 0,
      bestStreak: 0,
    })
  })

  it('honors a negative first-run score as bestScore (a losing debut is not hidden)', () => {
    const stats = updateStats(defaultStats(), record('lost', -8))
    expect(stats.bestScore).toBe(-8)
  })

  it('bestScore tracks the max across runs, never decreasing', () => {
    const stats = chain(record('won', 10), record('lost', -30), record('won', 7))
    expect(stats).toMatchObject({ gamesPlayed: 3, wins: 2, losses: 1, bestScore: 10 })
  })

  it('a loss resets currentStreak but bestStreak remembers the peak; a later streak can overtake it', () => {
    // W W L → streak broken at 2.
    let stats = chain(record('won', 5), record('won', 5), record('lost', 0))
    expect(stats).toMatchObject({ currentStreak: 0, bestStreak: 2 })

    // W W W → current overtakes the old best.
    stats = chain(
      record('won', 5),
      record('won', 5),
      record('lost', 0),
      record('won', 5),
      record('won', 5),
      record('won', 5),
    )
    expect(stats).toMatchObject({ currentStreak: 3, bestStreak: 3 })
  })

  it('keeps runs newest-first', () => {
    const first = record('won', 1)
    const second = record('lost', 2)
    const third = record('won', 3)
    const stats = chain(first, second, third)
    expect(stats.runs).toEqual([third, second, first])
  })

  it('caps the run history at DEFAULT_RUNS_CAP (50) while aggregates keep counting', () => {
    expect(DEFAULT_RUNS_CAP).toBe(50)
    const records = Array.from({ length: DEFAULT_RUNS_CAP + 5 }, (_, i) =>
      record(i % 2 === 0 ? 'won' : 'lost', i),
    )
    const stats = records.reduce(updateStats, defaultStats())
    expect(stats.gamesPlayed).toBe(DEFAULT_RUNS_CAP + 5)
    expect(stats.wins + stats.losses).toBe(DEFAULT_RUNS_CAP + 5)
    expect(stats.runs).toHaveLength(DEFAULT_RUNS_CAP)
    // Newest record survives; oldest cap-many were evicted.
    expect(stats.runs[0]).toEqual(records[DEFAULT_RUNS_CAP + 4])
    expect(stats.runs[DEFAULT_RUNS_CAP - 1]).toEqual(records[5])
  })

  it('is pure: the input stats object is never mutated', () => {
    const before = defaultStats()
    const snapshot = structuredClone(before)
    updateStats(before, record('won', 9))
    expect(before).toEqual(snapshot)
  })

  it('is a plain fold — idempotency is the caller’s job via RunData.statsWritten (Q42)', () => {
    const once = updateStats(defaultStats(), record('won', 9))
    const recordData = makeRunRecord({
      seed: 'dup',
      config: DEFAULT_CONFIG,
      outcome: 'won',
      score: 9,
      roomsCleared: 11,
      date: 1,
    })
    const a = updateStats(defaultStats(), recordData)
    const b = updateStats(a, recordData)
    expect(b.gamesPlayed).toBe(2)
    expect(once.gamesPlayed).toBe(1)
  })
})
