import { describe, expect, it } from 'vitest'
import { CARD_IDS } from '../engine/cards'

describe('scaffold smoke test', () => {
  it('ships exactly 44 unique card ids', () => {
    expect(CARD_IDS).toHaveLength(44)
    expect(new Set(CARD_IDS).size).toBe(44)
  })
})
