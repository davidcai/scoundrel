/**
 * Spec Seam 3: interaction surfaces — keyboard play, SR announcements,
 * card artwork loading, and the run-away rule (incl. second-run block).
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { announceResult } from '../src/ui/announce'
import { runActionScript } from './support/engine'
import { liveRegion, hpDigits, roomCardIds, startSeededRun } from './support/driver'
import {
  ANNOUNCE_SEED,
  KBD_CARRIED,
  KBD_FIRST_ROOM,
  KBD_HP_AFTER_ROOM,
  KBD_SEED,
} from './support/scripts'
import type { Action } from '../src/engine'

test.describe.configure({ timeout: 60_000 })

const KBD_ROOM_ACTIONS: Action[] = [
  { type: 'StartNewRun', seed: KBD_SEED, config: { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true } },
  { type: 'DrinkPotion', cardId: 'heart-3' },
  { type: 'FightMonster', cardId: 'club-k', barehanded: false },
  { type: 'FightMonster', cardId: 'club-4', barehanded: false },
  { type: 'EnterNextRoom' },
]

/**
 * Arrow-key roaming is scoped to the room row (the handler lives on
 * .play-screen), so keyboard entry is Tab (standard composite-widget keying).
 * Focus returns to <body> after each resolution (the button ghost-swaps), so
 * every step re-enters via Tab and then proves ArrowRight lands on target.
 */
async function focusRoomCardByTab(page: Page, cardId: string): Promise<Locator> {
  const card = page.locator(`#room-row button[data-card-id="${cardId}"]`)
  for (let i = 0; i < 8; i++) {
    if ((await card.evaluate((el) => document.activeElement === el).catch(() => false))) break
    await page.keyboard.press('Tab')
  }
  await expect(card).toBeFocused()
  // ArrowRight from a focused card stays inside the room and wraps to the
  // next resolvable card; pressing it here would move OFF the target, so
  // only Tab is used to land exactly on the target.
  return card
}

async function playKbdStep(page: Page, cardId: string): Promise<void> {
  await focusRoomCardByTab(page, cardId)
  await page.keyboard.press('Enter') // select arms the confirm
  await page.keyboard.press('Enter') // second Enter confirms (selectCard → confirm)
}

test('keyboard-only play resolves a full room and deals the carried card', async ({ page }) => {
  const steps = runActionScript(KBD_SEED, KBD_ROOM_ACTIONS)
  await startSeededRun(page, KBD_SEED)
  expect(await roomCardIds(page)).toEqual(KBD_FIRST_ROOM)

  // Tab into the room, then prove ArrowLeft roams focus across resolvable
  // cards and ArrowRight wraps back (arrow navigation within the widget).
  const first = await focusRoomCardByTab(page, KBD_FIRST_ROOM[0])
  await page.keyboard.press('ArrowLeft')
  const lastUnresolved = page.locator(
    `#room-row button[data-card-id="${KBD_FIRST_ROOM[3]}"]`,
  )
  await expect(lastUnresolved).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(first).toBeFocused()

  // Select via keyboard, then cancel with Escape → selection clears.
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0)

  // Resolve the room's first 3 cards entirely by keyboard.
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  // heart-3 resolved into a ghost slot.
  await expect(
    page.locator('#room-row [aria-label="Resolved 3 of Hearts, potion, value 3"]'),
  ).toBeVisible()
  await expect(liveRegion(page)).toHaveText(announceResult(steps[1].result) ?? '')

  await playKbdStep(page, 'club-k')
  await expect(hpDigits(page)).toHaveText('7 / 20')
  await expect(liveRegion(page)).toHaveText(announceResult(steps[2].result) ?? '')

  await playKbdStep(page, 'club-4')
  await expect(hpDigits(page)).toHaveText(`${KBD_HP_AFTER_ROOM} / 20`)
  await expect(liveRegion(page)).toHaveText(announceResult(steps[3].result) ?? '')

  // Room complete: explicit next-room gate enables; undo stays armed.
  await expect(page.getByRole('button', { name: '↺ Undo Room' })).toBeEnabled()
  await page.getByRole('button', { name: 'Enter Next Room' }).click()

  const dealt = steps[4]
  if (dealt.result.type !== 'RoomDealt') throw new Error('kbd script drifted')
  expect(await roomCardIds(page)).toEqual([...dealt.result.cards])
  // The 4th un-resolved card auto-carries and is visibly marked.
  expect(dealt.result.cards[0]).toBe(KBD_CARRIED)
  await expect(page.locator('#room-row .card-carried')).toHaveText('carried')
})

test('polite live region announces equip, combat, and potion results', async ({ page }) => {
  await startSeededRun(page, ANNOUNCE_SEED)

  // Exactly one polite status region at app root.
  await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveCount(1)
  await expect(liveRegion(page)).toHaveText('A room of 4 cards is dealt.')

  await page.locator('#room-row button[data-card-id="diamond-8"]').click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(liveRegion(page)).toHaveText('Equipped 8 of Diamonds.')

  // Barehanded fight in spite of the equipped weapon (checkbox flow).
  await page.locator('#room-row button[data-card-id="spade-7"]').click()
  await page.getByLabel('Fight barehanded').check()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(liveRegion(page)).toHaveText('Fought 7 of Spades barehanded. Took 7 damage.')
  await expect(hpDigits(page)).toHaveText('13 / 20')

  await page.locator('#room-row button[data-card-id="heart-4"]').click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(liveRegion(page)).toHaveText('Drank 4 of Hearts. Healed 4 HP.')
  await expect(hpDigits(page)).toHaveText('17 / 20')
})

async function expectAllLoaded(images: Locator): Promise<void> {
  const count = await images.count()
  expect(count, 'expected rendered card images').toBeGreaterThan(0)
  await expect
    .poll(
      () =>
        images.evaluateAll((els) =>
          els.every(
            (el) =>
              el instanceof HTMLImageElement &&
              el.complete &&
              el.naturalWidth > 0,
          ),
        ),
      { timeout: 15_000 },
    )
    .toBe(true)
}

test('every rendered card image resolves (no broken artwork)', async ({ page }) => {
  // Title backdrop fan.
  await page.goto('/')
  await expectAllLoaded(page.locator('.title-backdrop img'))

  // Play screen: room cards, then the weapon zone after an equip.
  await startSeededRun(page, ANNOUNCE_SEED)
  await expectAllLoaded(page.locator('.play-screen img'))
  await page.locator('#room-row button[data-card-id="diamond-8"]').click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    page.locator('section[aria-label="Weapon and defeated monsters"] [data-card-id="diamond-8"]'),
  ).toBeVisible()
  await expectAllLoaded(page.locator('.play-screen img'))
  // Weapon with a kill stack: weapon fight puts the slain card on the stack.
  await page.locator('#room-row button[data-card-id="spade-7"]').click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expectAllLoaded(page.locator('.play-screen img'))
})

test('Run Away re-deals, and a second consecutive run is blocked with reason', async ({ page }) => {
  await startSeededRun(page, ANNOUNCE_SEED)
  const before = await roomCardIds(page)

  await page.getByRole('button', { name: 'Run Away' }).click()
  await expect(liveRegion(page)).toHaveText('You ran away. A new room is dealt.')
  const after = await roomCardIds(page)
  expect(after.some((id) => before.includes(id)), 'new room shares no cards with the fled room').toBe(false)
  // Fled cards went to the dungeon bottom: the deck count is unchanged.
  await expect(page.locator('[aria-label="40 cards left in the dungeon"]')).toBeVisible()
  await expect(page.getByText('Run spent', { exact: true })).toBeVisible()

  // Second consecutive run: blocked button carries the reason tooltip.
  const runBtn = page.getByRole('button', { name: 'Run Away' })
  await expect(runBtn).toHaveAttribute('aria-disabled', 'true')
  await runBtn.focus()
  await expect(page.getByRole('tooltip')).toContainText(
    "You can't run from two rooms in a row.",
  )
  await runBtn.click({ force: true })
  expect(await roomCardIds(page), 'blocked run leaves the room untouched').toEqual(after)
  await expect(liveRegion(page)).toHaveText('You ran away. A new room is dealt.')
})
