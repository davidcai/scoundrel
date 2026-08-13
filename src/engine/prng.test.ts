import { describe, expect, it } from 'vitest'

import { mulberry32, randomSeed, seedToUint32, uint32ToSeed } from './prng'

describe('mulberry32', () => {
  it('produces a deterministic sequence for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('diverges for distinct seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).not.toEqual(seqB)
  })

  it('coerces seeds to uint32 (negative and fractional input)', () => {
    const a = mulberry32(-1)
    const b = mulberry32(4294967295)
    expect(a()).toBe(b())
    const c = mulberry32(42.9)
    const d = mulberry32(42)
    expect(c()).toBe(d())
  })
})

describe('seedToUint32', () => {
  it('parses base36 strings exactly', () => {
    expect(seedToUint32('000000')).toBe(0)
    expect(seedToUint32('zzzzzz')).toBe(36 ** 6 - 1)
    expect(seedToUint32('abc123')).toBe(parseInt('abc123', 36))
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(seedToUint32('ABC123')).toBe(seedToUint32('abc123'))
    expect(seedToUint32('  abc123  ')).toBe(seedToUint32('abc123'))
  })

  it('is deterministic for arbitrary (non-base36) strings', () => {
    expect(seedToUint32('hello world!')).toBe(seedToUint32('hello world!'))
    expect(seedToUint32('🚀🚀')).toBe(seedToUint32('🚀🚀'))
    expect(seedToUint32('hello world!')).not.toBe(seedToUint32('hello world?'))
  })
})

describe('uint32ToSeed / seedToUint32 round-trip', () => {
  it('round-trips uint32 values', () => {
    const values = [0, 1, 35, 36, 36 ** 6 - 1, 123456789, 2 ** 31, 2 ** 32 - 1]
    for (const value of values) {
      expect(seedToUint32(uint32ToSeed(value))).toBe(value >>> 0)
    }
  })

  it('pads to 6 characters', () => {
    expect(uint32ToSeed(0)).toBe('000000')
    expect(uint32ToSeed(35)).toBe('00000z')
    expect(uint32ToSeed(36 ** 6 - 1)).toBe('zzzzzz')
  })
})

describe('randomSeed', () => {
  it('returns 6-char base36 strings', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomSeed()).toMatch(/^[0-9a-z]{6}$/)
    }
  })

  it('stays within the uint32 range', () => {
    for (let i = 0; i < 100; i++) {
      const value = seedToUint32(randomSeed())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(2 ** 32)
    }
  })
})
