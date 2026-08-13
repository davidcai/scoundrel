// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  applyMigrations,
  CURRENT_VERSION,
  migrate,
  type MigrationChain,
  type MigrationChains,
} from './migrate'
import { STORAGE_KEYS } from './types'

describe('migrate', () => {
  it('passes a current-version wrapper through untouched', () => {
    const wrapper = { version: CURRENT_VERSION, data: { hello: 'world' } }
    expect(migrate(STORAGE_KEYS.stats, wrapper)).toEqual(wrapper)
  })

  it('returns newer-than-current wrappers untouched so callers fall back (never a downgrade)', () => {
    const wrapper = { version: CURRENT_VERSION + 5, data: { from: 'the-future' } }
    expect(migrate(STORAGE_KEYS.settings, wrapper)).toEqual(wrapper)
  })

  it('never throws on junk version values — corrupt data just fails to reach CURRENT_VERSION', () => {
    for (const version of [Number.NaN, -3, 0.5, Number.POSITIVE_INFINITY]) {
      expect(migrate(STORAGE_KEYS.run, { version, data: 1 })).toEqual({ version, data: 1 })
    }
  })

  it('applies a registered chain step for an older wrapper (mechanism test: chains start empty at v1)', () => {
    // Simulate a hypothetical future v0 → v1 upgrade via an injected chain.
    const chains: MigrationChains = {
      [STORAGE_KEYS.stats]: {
        0: (data) => {
          const old = data as { played: number }
          return { gamesPlayed: old.played }
        },
      },
    }
    const result = migrate(STORAGE_KEYS.stats, { version: 0, data: { played: 7 } }, chains)
    expect(result).toEqual({ version: 1, data: { gamesPlayed: 7 } })
  })

  it('halts at the last available step when the chain is incomplete', () => {
    const chains: MigrationChains = {
      [STORAGE_KEYS.run]: { 0: (data) => data },
    }
    const result = migrate(STORAGE_KEYS.run, { version: 0, data: 'x' }, chains)
    // Upgraded to v1 but cannot go further; caller compares against CURRENT_VERSION.
    expect(result.version).toBe(1)
  })
})

describe('applyMigrations', () => {
  it('composes multi-step upgrades in order (v0 → v1 → v2)', () => {
    const result = applyMigrations(
      {
        0: (data) => [...(data as string[]), 'step-1'],
        1: (data) => [...(data as string[]), 'step-2'],
      },
      { version: 0, data: ['start'] },
      2,
    )
    expect(result).toEqual({ version: 2, data: ['start', 'step-1', 'step-2'] })
  })

  it('stops at the target version without overshooting', () => {
    const chain = {
      0: (data: unknown) => [...(data as string[]), 'a'],
      1: (data: unknown) => [...(data as string[]), 'b'],
      2: (data: unknown) => [...(data as string[]), 'c'],
    }
    expect(applyMigrations(chain, { version: 0, data: [] }, 2)).toEqual({
      version: 2,
      data: ['a', 'b'],
    })
  })

  it('stops when a step is missing rather than guessing', () => {
    const result = applyMigrations({ 1: (data) => data }, { version: 0, data: 'unchanged' }, 3)
    expect(result).toEqual({ version: 0, data: 'unchanged' })
  })

  it('is bounded against runaway version loops', () => {
    // Every version claims to have a step; the cap must still halt the loop.
    const infiniteChain = new Proxy({}, { get: () => (data: unknown) => data }) as MigrationChain
    const result = applyMigrations(
      infiniteChain,
      { version: 0, data: 'x' },
      Number.MAX_SAFE_INTEGER,
    )
    expect(result.version).toBeGreaterThan(0)
    expect(result.version).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})
