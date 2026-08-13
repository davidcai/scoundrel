// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../engine'
import type { GameConfig } from '../../engine'
import { isGameConfig } from '../persistence'
import {
  buildReplayUrl,
  decodeConfig,
  encodeConfig,
  navigate,
  normalizeSeed,
  parseHashRoute,
} from './router'

beforeEach(() => {
  window.location.hash = '#/'
})

describe('parseHashRoute', () => {
  it('maps the five app routes', () => {
    expect(parseHashRoute('')).toEqual({ name: 'title' })
    expect(parseHashRoute('#')).toEqual({ name: 'title' })
    expect(parseHashRoute('#/')).toEqual({ name: 'title' })
    expect(parseHashRoute('#/play')).toEqual({ name: 'play' })
    expect(parseHashRoute('#/stats')).toEqual({ name: 'stats' })
    expect(parseHashRoute('#/settings')).toEqual({ name: 'settings' })
    expect(parseHashRoute('#/about')).toEqual({ name: 'about' })
  })

  it('falls back to title for unknown routes', () => {
    expect(parseHashRoute('#/bogus')).toEqual({ name: 'title' })
    expect(parseHashRoute('#/play/extra')).toEqual({ name: 'title' })
  })

  it('validates and lowercases the seed param', () => {
    expect(parseHashRoute('#/play?seed=AAAAAA')).toEqual({ name: 'play', seed: 'aaaaaa' })
  })

  it('drops invalid seeds instead of booting them', () => {
    expect(parseHashRoute('#/play?seed=not!a!seed')).toEqual({ name: 'play' })
    expect(parseHashRoute('#/play?seed=')).toEqual({ name: 'play' })
  })

  it('drops invalid configs instead of booting them', () => {
    expect(parseHashRoute('#/play?seed=AAAAAA&config=garbage')).toEqual({
      name: 'play',
      seed: 'aaaaaa',
    })
  })
})

describe('config codec', () => {
  it('round-trips every toggle combination through isGameConfig', () => {
    const runAwayModes = ['once', 'unlimited'] as const
    const potionsPerRoomOptions = [1, 'unlimited'] as const
    const degradationOptions = [true, false]
    for (const runAwayMode of runAwayModes) {
      for (const potionsPerRoom of potionsPerRoomOptions) {
        for (const weaponDegradation of degradationOptions) {
          const config: GameConfig = { runAwayMode, potionsPerRoom, weaponDegradation }
          const decoded: unknown = decodeConfig(encodeConfig(config))
          expect(isGameConfig(decoded)).toBe(true)
          expect(decoded).toEqual(config)
        }
      }
    }
  })

  it('encodes the canonical config as the documented triple', () => {
    expect(encodeConfig(DEFAULT_CONFIG)).toBe('once,1,on')
  })

  it('rejects malformed triples', () => {
    expect(decodeConfig(null)).toBeNull()
    expect(decodeConfig('')).toBeNull()
    expect(decodeConfig('once,1')).toBeNull()
    expect(decodeConfig('once,1,on,extra')).toBeNull()
    expect(decodeConfig('sometimes,2,maybe')).toBeNull()
  })
})

describe('buildReplayUrl', () => {
  it('builds a shareable URL that parses back to seed + config', () => {
    const config: GameConfig = {
      runAwayMode: 'unlimited',
      potionsPerRoom: 1,
      weaponDegradation: false,
    }
    const url = buildReplayUrl('abc123', config)
    expect(url.startsWith('#/play?')).toBe(true)
    expect(parseHashRoute(url)).toEqual({ name: 'play', seed: 'abc123', config })
  })
})

describe('normalizeSeed', () => {
  it('accepts 1–16 base36 chars, case-insensitive, trimmed', () => {
    expect(normalizeSeed('  ZZ99 ')).toBe('zz99')
    expect(normalizeSeed('0')).toBe('0')
    expect(normalizeSeed('a'.repeat(16))).toBe('a'.repeat(16))
  })

  it('rejects anything else', () => {
    expect(normalizeSeed('')).toBeNull()
    expect(normalizeSeed('   ')).toBeNull()
    expect(normalizeSeed('a'.repeat(17))).toBeNull()
    expect(normalizeSeed('nn-nn')).toBeNull()
    expect(normalizeSeed('☃')).toBeNull()
  })
})

describe('navigate', () => {
  it('sets the location hash', () => {
    navigate('/stats')
    expect(window.location.hash).toBe('#/stats')
    navigate('/')
    expect(window.location.hash).toBe('#/')
  })
})
