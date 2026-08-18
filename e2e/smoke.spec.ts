import { expect, test } from '@playwright/test'
import { liveRegion } from './support/driver'

test.describe('app boot & title flow', () => {
  test('title screen renders with the full menu', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Scoundrel/)
    await expect(page.getByRole('heading', { name: 'Scoundrel' })).toBeVisible()
    for (const name of ['New Run', 'Enter Seed', 'Stats', 'Settings', 'About']) {
      await expect(page.getByRole('button', { name })).toBeVisible()
    }
    // No save → no Continue affordance.
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)
  })

  test('Title → New Run deals a real room of 4 cards', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New Run' }).click()

    // Shareable seeded URL with the canonical config encoding.
    await expect(page).toHaveURL(/#\/play\?seed=[a-z0-9]+&config=o1d/)
    const cards = page.locator('#room-row button[data-card-id]')
    await expect(cards).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      const label = await cards.nth(i).getAttribute('aria-label')
      expect(label).toMatch(/^.+ of (Clubs|Spades|Diamonds|Hearts), (monster|weapon|potion), value \d+$/)
    }
    await expect(page.locator('.hud-hp-digits')).toHaveText('20 / 20')
    await expect(page.locator('[aria-label="40 cards left in the dungeon"]')).toBeVisible()
    await expect(liveRegion(page)).toHaveText('A room of 4 cards is dealt.')
  })
})
