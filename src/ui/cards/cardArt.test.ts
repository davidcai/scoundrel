/**
 * Asset-inventory assertion (Q56): the engine's 44-card table and the bundled
 * artwork manifest contain exactly the same set — any naming drift between
 * engine ids and src/assets/cards/*.jpg fails here.
 */
import { describe, expect, it } from 'vitest'
import { CARD_IDS } from '../../engine'
import { CARD_ART, cardArtUrl } from './cardArt'

describe('card artwork manifest', () => {
  it('every CardId resolves to a bundled asset URL', () => {
    for (const id of CARD_IDS) {
      expect(cardArtUrl(id), `missing art for ${id}`).toBeDefined()
    }
  })

  it('manifest and engine table contain exactly the same set', () => {
    expect(Object.keys(CARD_ART).sort()).toEqual([...CARD_IDS].sort())
  })

  it('manifest has exactly 44 entries', () => {
    expect(Object.keys(CARD_ART)).toHaveLength(44)
  })
})
