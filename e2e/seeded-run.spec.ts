/**
 * Seeded determinism seam (US4/US8, spec Q16a): the title → Enter Seed flow
 * boots a reproducible dungeon, and driven outcomes are engine-exact.
 */
import { expect, test } from '@playwright/test'
import { cardLabel, resolveCard, startSeededRun } from './helpers.js'

const roomCards = (page: Parameters<typeof startSeededRun>[0]) =>
  page.getByRole('group', { name: 'Room cards' }).getByRole('button')

test('title → Enter Seed deals the deterministic w10 room', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Scoundrel' })).toBeVisible()

  await page.getByRole('button', { name: 'Enter Seed' }).click()
  await page.getByLabel('Dungeon seed').fill('w10')
  await page.getByRole('button', { name: 'Descend' }).click()

  // Seed 'w10' deals exactly 8C 7S 2S 3D (pinned via src/engine).
  await expect(roomCards(page)).toHaveCount(4)
  for (const cardId of ['8C', '7S', '2S', '3D']) {
    await expect(page.getByRole('button', { name: cardLabel(cardId), exact: true })).toBeVisible()
  }
  await expect(page.getByText('Seed w10')).toBeVisible()
})

test('full room cycle: fight preview, HP drop, potion heal, weapon equip, carry badge', async ({
  page,
}) => {
  // Seed '0' deals [2D, 9H, 6C, 3D] — one of each mechanic.
  await startSeededRun(page, '0')

  // Select the monster: damage preview is visible before committing (US15/US16).
  await page.getByRole('button', { name: cardLabel('6C'), exact: true }).click()
  const strip = page.getByRole('region', { name: 'Card actions' })
  await expect(strip).toContainText('6 of Clubs, monster, value 6. Barehanded costs 6.')
  await page.getByRole('button', { name: 'Barehanded — 6 dmg' }).click()
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('14 / 20')

  // Drink the potion: heals back to the 20 HP cap (US25).
  await page.getByRole('button', { name: cardLabel('9H'), exact: true }).click()
  await expect(strip).toContainText('Heals 6.')
  await page.getByRole('button', { name: 'Drink — heal 6' }).click()
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')

  // Equip the weapon: renders in the weapon zone (US21).
  await resolveCard(page, '2D', 'Equip Weapon')
  await expect(page.getByRole('img', { name: cardLabel('2D'), exact: true })).toBeVisible()

  // Three cards resolved → the 4th (3D) carries over with a badge (US10/US11).
  await page.getByRole('button', { name: 'Enter Next Room' }).click()
  await expect(page.getByText('Carried')).toBeVisible()
  await expect(page.getByRole('button', { name: cardLabel('3D'), exact: true })).toBeVisible()
})

test('weapon degradation gate: worn weapon blocks stronger monster with tooltip', async ({
  page,
}) => {
  await startSeededRun(page, 'w10')

  await resolveCard(page, '3D', 'Equip Weapon')
  await resolveCard(page, '2S', 'Fight w/ Weapon — 0 dmg')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')

  // 7S (value 7) ≥ last kill 2S (value 2): weapon fight is gated (US22).
  await page.getByRole('button', { name: cardLabel('7S'), exact: true }).click()
  await expect(page.getByRole('region', { name: 'Card actions' })).toContainText(
    'Your weapon is too worn for it',
  )
  const gated = page.getByRole('button', { name: 'Fight w/ Weapon', exact: true })
  await expect(gated).toHaveAttribute('aria-disabled', 'true')
  await gated.hover()
  await expect(page.getByRole('tooltip')).toHaveText(
    'Too worn — only monsters weaker than its last kill.',
  )

  // The kill landed in the kill stack; barehanded is always legal (US17).
  await expect(page.getByRole('img', { name: cardLabel('2S'), exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Barehanded — 7 dmg' }).click()
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('13 / 20')
})
