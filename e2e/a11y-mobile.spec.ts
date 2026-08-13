/**
 * Accessibility + responsive seams (spec US54–US57, US64): keyboard play,
 * live-region announcements in the a11y tree, and a phone-sized viewport.
 */
import { expect, test } from '@playwright/test'
import { cardLabel, startSeededRun } from './helpers.js'

test('keyboard: tab/arrows rove the room, Enter selects, Esc clears; SR announces the fight', async ({
  page,
}) => {
  // Seed '0' room = [2D, 9H, 6C, 3D].
  await startSeededRun(page, '0')

  const card = (cardId: string) =>
    page.getByRole('button', { name: cardLabel(cardId), exact: true })

  // Tab reaches the header nav first, then roves the room's cards.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '← Title' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(card('2D')).toBeFocused()

  await page.keyboard.press('ArrowRight')
  await expect(card('9H')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(card('6C')).toBeFocused()
  await page.keyboard.press('End')
  await expect(card('3D')).toBeFocused()
  await page.keyboard.press('ArrowRight') // wraps to the first card
  await expect(card('2D')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(card('2D')).toBeFocused()

  // Enter selects: the confirm strip describes the pending action (US15).
  await card('3D').focus()
  await page.keyboard.press('Enter')
  await expect(card('3D')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'Card actions' })).toContainText('Equip it.')

  // Esc clears only the selection; game truth is untouched.
  await page.keyboard.press('Escape')
  await expect(card('3D')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Choose a card — you resolve three, then descend.')).toBeVisible()

  // SR live region: the fight result sentence is in the accessibility tree (US56).
  await card('6C').click()
  await page.getByRole('button', { name: 'Barehanded — 6 dmg' }).click()
  await expect(page.getByRole('status')).toContainText('took 6 damage')
})

test.describe('mobile viewport 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('title menu is usable and the room stays readable', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Scoundrel' })).toBeVisible()
    await page.getByRole('button', { name: 'New Run' }).click()

    await expect(page.getByRole('heading', { name: 'Dungeon' })).toBeVisible()
    const room = page.getByRole('group', { name: 'Room cards' })
    await expect(room).toBeVisible()
    await expect(room.getByRole('button')).toHaveCount(4)
    await expect(page.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')
    await expect(page.getByRole('button', { name: 'Run Away' })).toBeEnabled()

    // Tap-to-select brings up tap-friendly actions on the phone layout (US64).
    await room.getByRole('button').first().click()
    await expect(page.getByRole('region', { name: 'Card actions' })).toBeVisible()
  })
})
