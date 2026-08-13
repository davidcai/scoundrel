/**
 * Persistence & terminal coverage (spec US41–US50, US61–62): reload safety,
 * idempotent stats, shard clearing, run history + replay, and the shareable
 * replay URL round-trip.
 *
 * Deterministic terminal loss: seed 'a' deals [5S, 8S, QS, 7H]; barehanding
 * QS (12) then 8S (8) ends the run at HP 0 with score -183, roomsCleared 1.
 */
import { expect, test } from '@playwright/test'
import {
  cardLabel,
  injectTerminalRunOnce,
  readLocalStorage,
  readRunShard,
  readStatsShard,
  resolveCard,
  startSeededRun,
  terminalWinRunData,
} from './helpers.js'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function loseSeedA(page: Parameters<typeof startSeededRun>[0]): Promise<void> {
  await startSeededRun(page, 'a')
  await resolveCard(page, 'QS', 'Barehanded — 12 dmg')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('8 / 20')
  await resolveCard(page, '8S', 'Barehanded — 8 dmg')
  await expect(page.getByRole('heading', { name: 'You Fell' })).toBeVisible()
}

test('mid-run reload keeps room and HP; Continue on title resumes', async ({ page }) => {
  await startSeededRun(page, 'w10')
  await resolveCard(page, '8C', 'Barehanded — 8 dmg')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('12 / 20')

  await page.reload()
  await expect(page.getByText('The dungeon has not been dealt yet.')).toBeVisible()

  await page.goto('/#/')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('status')).toContainText('Saved run restored.')
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('12 / 20')
  const room = page.getByRole('group', { name: 'Room cards' })
  await expect(room.getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('button', { name: cardLabel('8C'), exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: cardLabel('7S'), exact: true })).toBeVisible()
})

test('terminal loss: scorecard + survive reload + stats written exactly once + shard cleared', async ({
  page,
}) => {
  await loseSeedA(page)
  await expect(page.getByText('-183', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'You fell in the dungeon — final score -183.',
  )

  // Stats folded once at the terminal moment (US42).
  let stats = await readStatsShard(page.context())
  expect(stats).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 })
  expect(stats?.runs).toHaveLength(1)
  expect(stats?.runs[0]).toMatchObject({
    seed: 'a',
    outcome: 'lost',
    score: -183,
    roomsCleared: 1,
  })
  const run = await readRunShard(page.context())
  expect(run).toMatchObject({
    seed: 'a',
    statsWritten: true,
    outcome: { type: 'lost', score: -183 },
  })

  // The lose screen survives reloads; each resume re-shows it (US41) …
  for (let i = 0; i < 2; i++) {
    await page.reload()
    await page.getByRole('button', { name: 'Continue saved run' }).click()
    await expect(page.getByRole('heading', { name: 'You Fell' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText(
      'Defeat screen restored — final score -183.',
    )
    // … and reloads never double-count the run in the stats shard (Q37b).
    stats = await readStatsShard(page.context())
    expect(stats?.runs).toHaveLength(1)
    expect(stats?.gamesPlayed).toBe(1)
  }

  // Returning to title clears the saved run, and Continue disables (Q45).
  await page.getByRole('button', { name: 'Return to title' }).click()
  await expect(page).toHaveURL(/#\/$/)
  expect(await readLocalStorage(page.context(), 'scoundrel:run')).toBeNull()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
})

test('stats screen lists the finished run; Replay restarts the same seed', async ({ page }) => {
  await loseSeedA(page)
  await page.getByRole('button', { name: 'Return to title' }).click()

  await page.getByRole('button', { name: 'Stats' }).click()
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: 'Seed a' })
  await expect(row).toContainText('Lost')
  await expect(row).toContainText('-183')

  await page.getByRole('button', { name: 'Replay run a' }).click()
  await expect(page).toHaveURL(/#\/play\?seed=a/)
  // Same seed ⇒ same deterministic room as before (US50).
  for (const cardId of ['5S', '8S', 'QS', '7H']) {
    await expect(page.getByRole('button', { name: cardLabel(cardId), exact: true })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')
})

test('shareable replay link round-trips into an identical fresh run', async ({ page, browser }) => {
  await loseSeedA(page)
  const copy = page.getByRole('button', { name: 'Copy replay link' })
  await copy.click()
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible()

  const clip = await page.evaluate<string>('navigator.clipboard.readText()')
  expect(clip).toContain('#/play?seed=a')

  // A friend opening the link (fresh storage) boots the identical run (US62).
  const friend = await browser.newContext()
  try {
    const friendPage = await friend.newPage()
    await friendPage.goto(`/${clip}`)
    await expect(friendPage.getByRole('heading', { name: 'Dungeon' })).toBeVisible()
    for (const cardId of ['5S', '8S', 'QS', '7H']) {
      await expect(
        friendPage.getByRole('button', { name: cardLabel(cardId), exact: true }),
      ).toBeVisible()
    }
    await expect(friendPage.getByRole('region', { name: 'Run status' })).toContainText('20 / 20')
  } finally {
    await friend.close()
  }
})

test('terminal win screen survives reload with exactly one stats record', async ({ page }) => {
  // No deterministic seed wins quickly through the click flow, so the run
  // shard is injected with a terminal won RunData payload (task-sanctioned).
  await injectTerminalRunOnce(page, terminalWinRunData())

  await page.goto('/#/')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Dungeon Cleared' })).toBeVisible()
  await expect(page.getByText('17', { exact: true })).toBeVisible()
  await expect(page.getByText('w10', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Victory screen restored — final score 17.')

  let stats = await readStatsShard(page.context())
  expect(stats).toMatchObject({ gamesPlayed: 1, wins: 1 })
  expect(stats?.runs).toHaveLength(1)
  expect(stats?.runs[0]).toMatchObject({ seed: 'w10', outcome: 'won', score: 17 })

  await page.reload()
  await page.getByRole('button', { name: 'Continue saved run' }).click()
  await expect(page.getByRole('heading', { name: 'Dungeon Cleared' })).toBeVisible()
  stats = await readStatsShard(page.context())
  expect(stats?.runs).toHaveLength(1)
  expect(stats?.gamesPlayed).toBe(1)

  await page.getByRole('button', { name: 'Return to title' }).click()
  expect(await readLocalStorage(page.context(), 'scoundrel:run')).toBeNull()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
})
