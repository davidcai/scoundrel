/**
 * Spec Seam 3: localStorage persistence across real page reloads.
 * Covers mid-run restore, resume-via-Continue, terminal-screen reload
 * survival, and the exactly-once stats guarantee (Q43).
 */
import { expect, test } from '@playwright/test'
import { hpDigits, playScript, roomCardIds } from './support/driver'
import { WIN_ACTIONS, WIN_FINAL_SCORE, WIN_SEED } from './support/scripts'

test.describe.configure({ timeout: 120_000 })

/** First 8 win-script actions: two and a bit rooms of real state to restore. */
const MID_RUN_PREFIX = WIN_ACTIONS.slice(0, 9)

interface StatsShard {
  version: number
  data: { gamesPlayed: number; wins: number; losses: number }
}

async function readStats(page: import('@playwright/test').Page): Promise<StatsShard['data']> {
  const raw = await page.evaluate(() => window.localStorage.getItem('scoundrel:stats'))
  expect(raw, 'stats shard exists').not.toBeNull()
  return (JSON.parse(raw ?? '{}') as StatsShard).data
}

// Guards US 44/Q44: a full-page reload of the seeded play URL must resume the
// persisted run (PlayScreen prefers loadSavedRun() over restarting) rather
// than silently restarting the same seed.
test(
  'mid-run reload on the seeded URL restores the exact run state',
  async ({ page }) => {
    await playScript(page, WIN_SEED, MID_RUN_PREFIX)
    const hp = await hpDigits(page).innerText()
    const rooms = await roomCardIds(page)
    const weapon = page.locator(
      'section[aria-label="Weapon and defeated monsters"] [data-card-id]',
    )
    const weaponId = await weapon.first().getAttribute('data-card-id')

    await page.reload()

    // Exact restore: same HP, same room slots, same weapon, no restart.
    await expect(hpDigits(page)).toHaveText(hp)
    expect(await roomCardIds(page)).toEqual(rooms)
    await expect(weapon.first()).toHaveAttribute('data-card-id', weaponId)
  },
)

test('mid-run reload then title → Continue restores the exact run state', async ({ page }) => {
  await playScript(page, WIN_SEED, MID_RUN_PREFIX)
  const hp = await hpDigits(page).innerText()
  const rooms = await roomCardIds(page)
  const deckLabel = await page
    .locator('[aria-label$="cards left in the dungeon"]')
    .getAttribute('aria-label')

  // Real browser restart at the root route: title must offer Continue (Q45).
  await page.goto('/#/')
  await page.reload()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL(/#\/play$/)
  await expect(hpDigits(page)).toHaveText(hp)
  expect(await roomCardIds(page)).toEqual(rooms)
  await expect(page.locator(`[aria-label="${deckLabel}"]`)).toBeVisible()
})

// Guards US 42/Q42: reloading ON the win/lose screen (a seeded URL)
// rehydrates the persisted terminal outcome — the scorecard survives reload.
test(
  'reloading the win screen keeps the scorecard (Q42)',
  async ({ page }) => {
    await playScript(page, WIN_SEED, WIN_ACTIONS)
    await expect(page.locator('[aria-label="Final score 2"]')).toHaveText(
      String(WIN_FINAL_SCORE),
    )
    expect((await readStats(page)).gamesPlayed).toBe(1)

    await page.reload()

    // Terminal outcome persists inline in the run shard → survives reload.
    await expect(page.getByRole('heading', { name: 'You survived the dungeon' })).toBeVisible()
    await expect(page.locator('[aria-label="Final score 2"]')).toHaveText(
      String(WIN_FINAL_SCORE),
    )
  },
)

test('a completed run is recorded in stats exactly once, across reloads (Q43)', async ({
  page,
}) => {
  await playScript(page, WIN_SEED, WIN_ACTIONS)
  expect((await readStats(page)).gamesPlayed).toBe(1)

  // Whatever the reload behavior, the idempotent stats write must hold.
  await page.reload()
  expect((await readStats(page)).gamesPlayed).toBe(1)
  await page.reload()
  const stats = await readStats(page)
  expect(stats).toMatchObject({ gamesPlayed: 1, wins: 1, losses: 0 })
})
