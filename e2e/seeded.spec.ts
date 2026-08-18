/**
 * Spec Seam 3: seeded determinism, exact full-run outcomes, and the
 * shareable-URL round-trip — all against the real engine + real UI clicks.
 * Every script is replayed through the pure engine at test time and the UI
 * must match it exactly (room deals, HP digits, deck count, announcements).
 */
import { expect, test } from '@playwright/test'
import { announceResult } from '../src/ui/announce'
import { cardAriaLabel } from '../src/ui/cards/cardMeta'
import { firstRoom, runActionScript, terminalOf } from './support/engine'
import { hpDigits, playScript, roomCardIds, startSeededRun } from './support/driver'
import {
  LOSS_ACTIONS,
  LOSS_FINAL_HP,
  LOSS_FINAL_SCORE,
  LOSS_SEED,
  WIN_ACTIONS,
  WIN_FINAL_HP,
  WIN_FINAL_SCORE,
  WIN_FIRST_ROOM,
  WIN_REPLAY_HASH,
  WIN_SEED,
} from './support/scripts'

test.describe.configure({ timeout: 120_000 })

interface StatsShard {
  version: number
  data: {
    gamesPlayed: number
    wins: number
    losses: number
    runs: { seed: string; outcome: string; score: number; roomsCleared: number }[]
  }
}

async function readStats(page: Parameters<typeof playScript>[0]): Promise<StatsShard['data']> {
  const raw = await page.evaluate(() => window.localStorage.getItem('scoundrel:stats'))
  expect(raw, 'stats shard exists').not.toBeNull()
  return (JSON.parse(raw ?? '{}') as StatsShard).data
}

test('seeded URL deals the engine-computed deterministic room', async ({ page }) => {
  // Engine truth recomputed live; the embedded literal pins determinism.
  expect([...firstRoom(WIN_SEED)]).toEqual(WIN_FIRST_ROOM)

  await startSeededRun(page, WIN_SEED)
  expect(await roomCardIds(page)).toEqual(WIN_FIRST_ROOM)
  for (const cardId of WIN_FIRST_ROOM) {
    await expect(
      page.locator(`#room-row button[data-card-id="${cardId}"]`),
    ).toHaveAttribute('aria-label', cardAriaLabel(cardId))
  }
  await expect(hpDigits(page)).toHaveText('20 / 20')
  await expect(page.getByRole('button', { name: /Seed 15/ })).toBeVisible()
})

test('seeded run reaches the exact engine-computed WIN', async ({ page }) => {
  const steps = runActionScript(WIN_SEED, WIN_ACTIONS)
  const terminal = terminalOf(steps)
  // Engine truth: terminal payload must match the pinned expectation.
  if (terminal.result.type !== 'GameWon') throw new Error('win script no longer wins')
  expect(terminal.result.score).toBe(WIN_FINAL_SCORE)
  expect(terminal.state.hp).toBe(WIN_FINAL_HP)
  expect(terminal.result.seed).toBe(WIN_SEED)

  await playScript(page, WIN_SEED, WIN_ACTIONS)

  const end = page.locator('.end-screen--won')
  await expect(end.getByRole('heading', { name: 'You survived the dungeon' })).toBeVisible()
  await expect(page.locator('[aria-label="Final score 2"]')).toHaveText(String(WIN_FINAL_SCORE))
  await expect(page.getByTestId('live-region')).toHaveText(announceResult(terminal.result) ?? '')
  await expect(page.locator('.scorecard-seed')).toHaveText(WIN_SEED)
  await expect(page.locator('.scorecard-url')).toHaveText(WIN_REPLAY_HASH)

  // The run shard keeps the terminal outcome inline (reload-safe scorecard).
  const runRaw = await page.evaluate(() => window.localStorage.getItem('scoundrel:run'))
  const run = JSON.parse(runRaw ?? '{}') as { data: { outcome: unknown } }
  expect(run.data.outcome).toEqual({ phase: 'won', score: WIN_FINAL_SCORE })

  // Stats written exactly once with the right record.
  const stats = await readStats(page)
  expect(stats.gamesPlayed).toBe(1)
  expect(stats.wins).toBe(1)
  expect(stats.losses).toBe(0)
  expect(stats.runs).toHaveLength(1)
  expect(stats.runs[0]).toMatchObject({
    seed: WIN_SEED,
    outcome: 'won',
    score: WIN_FINAL_SCORE,
    roomsCleared: terminal.state.runHighlights.roomsExplored,
  })
})

test('seeded run reaches the exact engine-computed LOSS', async ({ page }) => {
  const steps = runActionScript(LOSS_SEED, LOSS_ACTIONS)
  const terminal = terminalOf(steps)
  if (terminal.result.type !== 'GameLost') throw new Error('loss script no longer loses')
  expect(terminal.result.score).toBe(LOSS_FINAL_SCORE)
  expect(terminal.state.hp).toBe(LOSS_FINAL_HP)

  await playScript(page, LOSS_SEED, LOSS_ACTIONS)

  const end = page.locator('.end-screen--lost')
  await expect(end.getByRole('heading', { name: 'You died in the dungeon' })).toBeVisible()
  await expect(page.locator('[aria-label="Final score -178"]')).toHaveText(
    String(LOSS_FINAL_SCORE),
  )
  await expect(page.getByTestId('live-region')).toHaveText(announceResult(terminal.result) ?? '')
  await expect(page.locator('.scorecard-seed')).toHaveText(LOSS_SEED)

  const stats = await readStats(page)
  expect(stats).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 })
  expect(stats.runs).toHaveLength(1)
  expect(stats.runs[0]).toMatchObject({ seed: LOSS_SEED, outcome: 'lost', score: LOSS_FINAL_SCORE })
})

test('scorecard replay link loads an identical fresh run', async ({ page, browser }) => {
  await playScript(page, WIN_SEED, WIN_ACTIONS)

  // The scorecard renders the shareable link verbatim (same text the
  // "Copy replay link" button puts on the clipboard).
  await expect(page.getByRole('button', { name: 'Copy replay link' })).toBeVisible()
  const link = (await page.locator('.scorecard-url').innerText()).trim()
  expect(link).toBe(WIN_REPLAY_HASH)

  // A recipient opens the link in a FRESH browser context: no persisted run,
  // so the seeded URL starts an identical new run. (Same-context loads must
  // instead resume the persisted run — covered in persistence.spec.ts.)
  const recipient = await browser.newContext()
  const recipientPage = await recipient.newPage()
  try {
    await recipientPage.goto(`/${link}`)

    // Identical fresh run: same dealt room, full HP, full deck, room 1.
    expect(await roomCardIds(recipientPage)).toEqual(WIN_FIRST_ROOM)
    await expect(hpDigits(recipientPage)).toHaveText('20 / 20')
    await expect(
      recipientPage.locator('[aria-label="40 cards left in the dungeon"]'),
    ).toBeVisible()
    await expect(recipientPage.getByText('Room 1')).toBeVisible()
    await expect(recipientPage.getByTestId('live-region')).toHaveText(
      'A room of 4 cards is dealt.',
    )
  } finally {
    await recipient.close()
  }
})
