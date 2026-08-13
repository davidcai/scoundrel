/**
 * Room-level mechanics (spec US28–US36): per-room undo, explicit room-entry
 * seam, and the run-away gates (twice-in-a-row + unfaced-room only).
 */
import { expect, test } from '@playwright/test'
import { cardLabel, resolveCard, startSeededRun } from './helpers.js'

test('Undo to Room Start rewinds HP and restores the room', async ({ page }) => {
  await startSeededRun(page, 'w10')

  await resolveCard(page, '8C', 'Barehanded — 8 dmg')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('12 / 20')
  await expect(page.getByRole('button', { name: cardLabel('8C'), exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo to Room Start' }).click()
  await expect(page.getByRole('status')).toContainText('Rewound to the start of the room.')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')
  await expect(page.getByRole('button', { name: cardLabel('8C'), exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Room cards' }).getByRole('button')).toHaveCount(4)
})

test('Enter Next Room is gated until 3 resolutions, then deals the carried card', async ({
  page,
}) => {
  await startSeededRun(page, 'w10')

  const enterNext = page.getByRole('button', { name: 'Enter Next Room' })
  await expect(enterNext).toBeDisabled()

  await resolveCard(page, '8C', 'Barehanded — 8 dmg')
  await expect(enterNext).toBeDisabled()
  await resolveCard(page, '7S', 'Barehanded — 7 dmg')
  await expect(enterNext).toBeDisabled()
  await resolveCard(page, '3D', 'Equip Weapon')

  const hud = page.getByRole('region', { name: 'Run status' })
  await expect(hud).toContainText('5 / 20')
  await expect(enterNext).toBeEnabled()
  await enterNext.click()

  // 2S was the un-resolved 4th card: it carries into the new room, badged.
  await expect(page.getByText('Carried')).toBeVisible()
  await expect(page.getByRole('button', { name: cardLabel('2S'), exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Room cards' }).getByRole('button')).toHaveCount(4)
})

test('Run Away: enabled on a fresh room, blocked mid-room and twice in a row', async ({ page }) => {
  await startSeededRun(page, 'w10')

  const runAway = page.getByRole('button', { name: 'Run Away' })

  // Fresh room, dungeon ≥ 4: offered (US28).
  await expect(runAway).toBeEnabled()

  // Mid-room: resolved a card → not offered, with the rule as tooltip (US31).
  await resolveCard(page, '8C', 'Barehanded — 8 dmg')
  await expect(runAway).toHaveAttribute('aria-disabled', 'true')
  await runAway.hover()
  await expect(page.getByRole('tooltip')).toHaveText('You can only flee an unfaced room.')

  // Rewind → fresh room again → flee.
  await page.getByRole('button', { name: 'Undo to Room Start' }).click()
  await expect(runAway).toBeEnabled()
  await runAway.click()
  await expect(page.getByRole('status')).toContainText('Ran away — cannot run next room.')

  // The old room went to the bottom of the dungeon; a fresh 4 rooms up.
  await expect(page.getByRole('button', { name: cardLabel('8C'), exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Room cards' }).getByRole('button')).toHaveCount(4)

  // Just ran: second consecutive run is blocked (twice-in-row, US29). Move the
  // mouse off first — the click left it hovering the button, and the tooltip
  // only re-arms on a fresh mouseenter.
  await expect(runAway).toHaveAttribute('aria-disabled', 'true')
  await page.mouse.move(0, 0)
  await runAway.hover()
  await expect(page.getByRole('tooltip')).toHaveText("You can't run two rooms in a row.")
})
