/**
 * Playwright-facing drivers: replay engine scripts through the real UI with
 * per-step assertions (live region text, HP readout, room layout) against
 * engine truth. UI-only helpers — all game math comes from support/engine.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { announceResult } from '../../src/ui/announce'
import type { Action } from '../../src/engine'
import { runActionScript } from './engine'
import { CANON_CODE } from './scripts'

/** The app's single polite live region (role=status + aria-live=polite). */
export function liveRegion(page: Page): Locator {
  return page.getByTestId('live-region')
}

/** Unresolved room cards, in DOM slot order. */
export async function roomCardIds(page: Page): Promise<string[]> {
  return page.locator('#room-row button[data-card-id]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-card-id') ?? ''),
  )
}

export function hpDigits(page: Page): Locator {
  return page.locator('.hud-hp-digits')
}

/** Starts a deterministic run via the shareable URL scheme. */
export async function startSeededRun(page: Page, seed: string): Promise<void> {
  await page.goto(`/#/play?seed=${seed}&config=${CANON_CODE}`)
  await expect(page.locator('#room-row')).toBeVisible()
  await expect(liveRegion(page)).toHaveText('A room of 4 cards is dealt.')
}

/** Runs one script action through the UI (cards go select → confirm). */
async function playAction(page: Page, action: Action): Promise<void> {
  switch (action.type) {
    case 'FightMonster':
    case 'DrinkPotion':
    case 'EquipWeapon': {
      await page.locator(`#room-row button[data-card-id="${action.cardId}"]`).click()
      if (action.type === 'FightMonster' && action.barehanded === true) {
        // Shown only when a weapon is equipped; without one the fight is
        // barehanded anyway, so the flag is a no-op in the UI.
        const bare = page.getByLabel('Fight barehanded')
        if ((await bare.count()) > 0) await bare.check()
      }
      await page.getByRole('button', { name: 'Confirm', exact: true }).click()
      return
    }
    case 'EnterNextRoom':
      await page.getByRole('button', { name: 'Enter Next Room' }).click()
      return
    case 'RunAway':
      await page.getByRole('button', { name: 'Run Away' }).click()
      return
    default:
      throw new Error(`driver cannot play ${JSON.stringify(action)}`)
  }
}

/**
 * Boots the seeded run, replays the whole script through real clicks, and
 * after every action asserts the live-region announcement, the HUD HP digits,
 * and (on room deals) the exact dealt room ids. Returns the engine-computed
 * script for caller-side terminal assertions.
 */
export async function playScript(page: Page, seed: string, actions: readonly Action[]) {
  const steps = runActionScript(seed, actions)
  await page.goto(`/#/play?seed=${seed}&config=${CANON_CODE}`)
  await expect(page.locator('#room-row')).toBeVisible()

  for (const [i, step] of steps.entries()) {
    if (step.action.type === 'StartNewRun') {
      // The URL boot already performed StartNewRun (store contract).
      await expect(liveRegion(page)).toHaveText('A room of 4 cards is dealt.')
      if (step.result.type === 'RoomDealt') {
        expect(await roomCardIds(page)).toEqual([...step.result.cards])
      }
      continue
    }
    await playAction(page, step.action)

    const announced = announceResult(step.result)
    expect(announced, `step ${i} produces an announcement`).not.toBeNull()
    await expect(liveRegion(page), `step ${i} announcement`).toHaveText(announced ?? '')

    if (step.state.phase === 'playing') {
      await expect(hpDigits(page), `step ${i} hp`).toHaveText(
        `${step.state.hp} / ${step.state.maxHp}`,
      )
      await expect(
        page.locator(`[aria-label="${step.state.dungeon.length} cards left in the dungeon"]`),
        `step ${i} deck count`,
      ).toBeVisible()
    }
    if (step.result.type === 'RoomDealt') {
      expect(await roomCardIds(page), `step ${i} dealt room`).toEqual([...step.result.cards])
    }
  }
  return steps
}
