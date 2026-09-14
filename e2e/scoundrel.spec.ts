import { expect, test, type Page } from '@playwright/test';
import { cardValue, previewFight } from '../src/engine';
import type { CardId, GameState } from '../src/engine';

// The Phaser build has no DOM UI: every interaction goes through the
// `window.__SCOUNDREL__` debug handle (enabled by the `?debug` query param).
// `worldToScreen(id)` maps a registered scene object — room cards by CardId,
// buttons by debugId — to page coordinates for real mouse clicks, and `store`
// exposes the zustand game store for assertions. The greedy strategy's
// decisions are computed in the test process from the store's engine state
// using the same pure helpers the UI's action panel uses, so its logic is
// identical to the old DOM-driven suite while every action is a canvas click.

interface DebugHandle {
  game: { scene: { isActive(sceneKey: string): boolean } };
  store: {
    getState(): { game: GameState | null; selectedCardId: CardId | null };
  };
  worldToScreen(id: string): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __SCOUNDREL__?: DebugHandle;
  }
}

const isMonster = (id: CardId): boolean => id.startsWith('club-') || id.startsWith('spade-');
const isWeapon = (id: CardId): boolean => id.startsWith('diamond-');
const isPotion = (id: CardId): boolean => id.startsWith('heart-');

// ---------------------------------------------------------------------------
// Fixtures & low-level helpers
// ---------------------------------------------------------------------------

// The app defaults to Chinese; most e2e tests assert against an English run,
// so they pin English before the app boots. The Chinese default gets its own
// test.
const ENGLISH_SETTINGS = JSON.stringify({
  version: 1,
  data: {
    config: { runAwayMode: 'once', potionsPerRoom: 'one', weaponDegradation: true },
    language: 'en',
  },
});

async function useEnglish(page: Page): Promise<void> {
  await page.addInitScript((settings) => {
    localStorage.setItem('scoundrel:settings', settings);
  }, ENGLISH_SETTINGS);
}

async function getGame(page: Page): Promise<GameState | null> {
  return page.evaluate(() => window.__SCOUNDREL__?.store.getState().game ?? null);
}

async function getSelectedCardId(page: Page): Promise<CardId | null> {
  return page.evaluate(() => window.__SCOUNDREL__?.store.getState().selectedCardId ?? null);
}

async function roomIds(page: Page): Promise<CardId[]> {
  const game = await getGame(page);
  if (game === null) throw new Error('no run in progress');
  return game.room;
}

async function hp(page: Page): Promise<number> {
  const game = await getGame(page);
  if (game === null) throw new Error('no run in progress');
  return game.hp;
}

async function waitForScene(page: Page, sceneKey: string, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((key) => window.__SCOUNDREL__?.game.scene.isActive(key) ?? false, sceneKey),
      { timeout, intervals: [50] },
    )
    .toBe(true);
}

async function waitForGame(
  page: Page,
  predicate: (game: GameState) => boolean,
  timeout = 5_000,
): Promise<GameState> {
  const latest: { game: GameState | null } = { game: null };
  await expect
    .poll(
      async () => {
        latest.game = await getGame(page);
        return latest.game !== null && predicate(latest.game);
      },
      { timeout, intervals: [50] },
    )
    .toBe(true);
  return latest.game as GameState;
}

/** Wait for the play scene with a dealt room — the steady state for run tests. */
async function waitForPlayRoom(page: Page): Promise<GameState> {
  await waitForScene(page, 'PlayScene');
  return waitForGame(page, (game) => game.room.length > 0);
}

/** Page-space center of a tracked scene object, or null when not on screen. */
async function locate(page: Page, id: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((objectId) => window.__SCOUNDREL__?.worldToScreen(objectId) ?? null, id);
}

/** Click a room card via the debug registry; retries until it is on screen. */
async function clickCard(page: Page, cardId: CardId, timeout = 5_000): Promise<void> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const pos = await locate(page, cardId);
    if (pos !== null) {
      await page.mouse.click(pos.x, pos.y);
      await expect
        .poll(() => getSelectedCardId(page), { timeout: 2_000, intervals: [50] })
        .toBe(cardId);
      return;
    }
    if (Date.now() > deadline) throw new Error(`card sprite not on screen: ${cardId}`);
    await page.waitForTimeout(50);
  }
}

/** Click a button via the debug registry, retrying until it is on screen. */
async function clickButton(page: Page, debugId: string, timeout = 5_000): Promise<void> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const pos = await locate(page, debugId);
    if (pos !== null) {
      await page.mouse.click(pos.x, pos.y);
      return;
    }
    if (Date.now() > deadline) throw new Error(`button not on screen: ${debugId}`);
    await page.waitForTimeout(50);
  }
}

/** Everything the action assertions watch for changes. */
const stateSignature = (game: GameState): string =>
  JSON.stringify([
    game.room,
    game.hp,
    game.weapon,
    game.killStack,
    game.resolvedCount,
    game.potionsUsedThisRoom,
    game.phase,
    game.dungeon.length,
    game.carriedCardId,
  ]);

/** Click a store-dispatching button and wait for the engine state to move. */
async function clickActionButton(page: Page, debugId: string): Promise<void> {
  const before = await getGame(page);
  const beforeSignature = before === null ? 'no-run' : stateSignature(before);
  // A click can land during a scene rebuild or tween and hit nothing; retry
  // until the engine state actually moves (or the button is gone).
  const deadline = Date.now() + 10_000;
  for (;;) {
    await clickButton(page, debugId);
    const game = await getGame(page);
    const signature = game === null ? 'run-cleared' : stateSignature(game);
    if (signature !== beforeSignature) return;
    if (Date.now() > deadline) {
      throw new Error(`click on ${debugId} produced no state change (last: ${signature})`);
    }
    await page.waitForTimeout(100);
  }
}

/**
 * Deterministic greedy strategy, played entirely through the real canvas UI —
 * the port of the old DOM-driven helper. Potion when hurt (unless wasted or at
 * full health), best weapon upgrade, otherwise the weakest monster; fight with
 * the weapon when the damage is survivable, barehanded otherwise.
 */
async function playOutGreedy(page: Page): Promise<void> {
  for (let guard = 0; guard < 500; guard++) {
    const game = await getGame(page);
    if (game === null || game.phase !== 'playing') return;
    if (
      await page.evaluate(() => window.__SCOUNDREL__?.game.scene.isActive('GameOverScene') ?? false)
    ) {
      return;
    }

    const ids = game.room;
    if (ids.length === 0) return;

    // Enter the next room once only the carry card is left.
    if (ids.length === 1 && game.dungeon.length > 0) {
      await clickActionButton(page, 'btn-enter-next-room');
      continue;
    }

    // Pick: healing potion when hurt, weapon upgrade, weakest monster, fallback.
    const currentHp = game.hp;
    if (currentHp <= 12) {
      const potionId = ids.find(isPotion);
      const potionWasted = game.config.potionsPerRoom === 'one' && game.potionsUsedThisRoom >= 1;
      if (potionId !== undefined && !potionWasted && currentHp < game.maxHp) {
        await clickCard(page, potionId);
        await clickActionButton(page, 'btn-drink-potion');
        continue;
      }
    }

    let chosen: CardId | undefined;
    const bestRoomWeapon = ids.filter(isWeapon).sort((a, b) => cardValue(b) - cardValue(a))[0];
    if (
      bestRoomWeapon !== undefined &&
      (game.weapon === null || cardValue(bestRoomWeapon) > cardValue(game.weapon))
    ) {
      chosen = bestRoomWeapon;
    }
    chosen ??= ids.filter(isMonster).sort((a, b) => cardValue(a) - cardValue(b))[0] ?? ids[0];
    if (chosen === undefined) return;

    await clickCard(page, chosen);

    if (isMonster(chosen)) {
      const withWeapon = game.weapon !== null ? previewFight(game, chosen, false) : null;
      if (withWeapon !== null && withWeapon.legal && withWeapon.damage < currentHp) {
        await clickActionButton(page, 'btn-fight-weapon');
        continue;
      }
      if (previewFight(game, chosen, true).legal) {
        await clickActionButton(page, 'btn-fight-barehanded'); // lethal or not
        continue;
      }
      return;
    }
    if (isWeapon(chosen)) {
      if ((await locate(page, 'btn-equip-weapon')) !== null) {
        await clickActionButton(page, 'btn-equip-weapon');
        continue;
      }
      return;
    }
    if ((await locate(page, 'btn-drink-potion')) !== null) {
      await clickActionButton(page, 'btn-drink-potion');
      continue;
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Title & interaction
// ---------------------------------------------------------------------------

test.describe('language detection', () => {
  test.use({ locale: 'zh-CN' });

  test('a zh-configured browser opens in Chinese by default', async ({ page }) => {
    await page.goto('/?debug');
    await waitForScene(page, 'TitleScene');

    // Fresh visits default to auto-detection; a zh browser resolves to Chinese.
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    // An explicit choice made through the canvas settings persists across a reload.
    await clickButton(page, 'btn-settings');
    await clickButton(page, 'btn-lang-en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('title screen offers the full menu and a new run deals a room', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/?debug');
  await waitForScene(page, 'TitleScene');
  for (const debugId of [
    'btn-new-run',
    'btn-enter-seed',
    'btn-stats',
    'btn-settings',
    'btn-about',
  ]) {
    expect(await locate(page, debugId)).not.toBeNull();
  }

  await clickButton(page, 'btn-new-run');
  await expect(page).toHaveURL(/#\/play/);
  const game = await waitForPlayRoom(page);
  expect(game.room).toHaveLength(4);
  expect(game.hp).toBe(20);
  expect(game.maxHp).toBe(20);
  expect(game.dungeon).toHaveLength(40);
});

test('keyboard navigation reaches every card and escape deselects', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/?debug#/play?seed=kbtest');
  const room = (await waitForPlayRoom(page)).room;
  expect(room).toHaveLength(4);

  // Settle the pointer on a corner of the canvas that holds no interactive
  // object; Phaser's keyboard plugin listens on the window, so keys land
  // regardless of element focus.
  await page.mouse.click(10, 10);

  // ArrowRight twice roves focus to the second card; Enter selects it.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => getSelectedCardId(page), { timeout: 2_000, intervals: [50] })
    .toBe(room[1]);

  // Escape deselects.
  await page.keyboard.press('Escape');
  await expect.poll(() => getSelectedCardId(page), { timeout: 2_000, intervals: [50] }).toBe(null);

  // ArrowLeft moves focus back to the first card; Enter selects it.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => getSelectedCardId(page), { timeout: 2_000, intervals: [50] })
    .toBe(room[0]);
});

test('carried cards are marked in the next room', async ({ page }) => {
  // s20 opens with [diamond-5, heart-9, spade-8, diamond-9].
  await useEnglish(page);
  await page.goto('/?debug#/play?seed=s20');
  const game = await waitForPlayRoom(page);
  expect(game.room).toEqual(['diamond-5', 'heart-9', 'spade-8', 'diamond-9']);

  await clickCard(page, 'diamond-5');
  await clickActionButton(page, 'btn-equip-weapon');
  await clickCard(page, 'heart-9');
  await clickActionButton(page, 'btn-drink-potion');
  await clickCard(page, 'spade-8');
  await clickActionButton(page, 'btn-fight-weapon');

  await clickActionButton(page, 'btn-enter-next-room');

  // The leftover card is carried into the next room, at the front of the row.
  const next = await waitForGame(page, (state) => state.carriedCardId === 'diamond-9');
  expect(next.room[0]).toBe('diamond-9');
  await page.screenshot({ path: 'test-results/carried-badge.png' });
});

// ---------------------------------------------------------------------------
// Seeded determinism & shareable URLs
// ---------------------------------------------------------------------------

test('the same seed deals the same room every time', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/?debug#/play?seed=determinism');
  await waitForPlayRoom(page);
  const first = await roomIds(page);

  await page.evaluate(() => localStorage.clear());
  await page.goto('/?debug#/play?seed=determinism');
  await waitForPlayRoom(page);
  const second = await roomIds(page);

  expect(second).toEqual(first);
});

test('a full seeded run ends in a scorecard, records stats once, and survives reload', async ({
  page,
}) => {
  test.setTimeout(120_000); // full greedy playthrough: slow on CI runners
  await useEnglish(page);
  await page.goto('/?debug#/play?seed=e2fterm');
  await waitForPlayRoom(page);
  await playOutGreedy(page);

  await waitForScene(page, 'GameOverScene');
  const final = await getGame(page);
  expect(final !== null && final.phase !== 'playing').toBe(true);

  // The run was recorded in stats exactly once.
  const readRunSeeds = (): Promise<string[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('scoundrel:stats');
      if (raw === null) return [];
      const parsed = JSON.parse(raw) as { data?: { runs?: Array<{ seed: string }> } };
      return (parsed.data?.runs ?? []).map((run) => run.seed);
    });
  expect(await readRunSeeds()).toEqual(['e2fterm']);

  // The stats screen is its own scene.
  await page.goto('/?debug#/stats');
  await waitForScene(page, 'StatsScene');

  // Reloading the terminal screen (no seed in URL) restores the scorecard
  // from the persisted run — and does not double-count the stats entry.
  await page.goto('/?debug#/play');
  await page.reload();
  await waitForScene(page, 'GameOverScene');
  expect(await readRunSeeds()).toEqual(['e2fterm']);
});

test('the replay link round-trips through the clipboard', async ({ browser }) => {
  test.setTimeout(120_000); // full greedy playthrough: slow on CI runners
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();

  await useEnglish(page);
  await page.goto('/?debug#/play?seed=sharetest');
  const firstRoom = (await waitForPlayRoom(page)).room;

  await playOutGreedy(page);
  await waitForScene(page, 'GameOverScene');
  await clickButton(page, 'btn-copy-link');
  const link = await page.evaluate(() => navigator.clipboard?.readText() ?? '');
  expect(link).toContain('#/play?seed=sharetest');

  // A full navigation (not a hash change) so the store boots fresh. The
  // `?debug` query is re-appended — the copied link itself is asserted above.
  const hash = new URL(link).hash;
  await page.goto('about:blank');
  await page.goto(`/?debug${hash}`);
  const reopened = await waitForPlayRoom(page);
  expect(reopened.room).toEqual(firstRoom);
  await context.close();
});

// ---------------------------------------------------------------------------
// Persistence mid-run
// ---------------------------------------------------------------------------

test('a mid-run page load without the seed resumes the saved room state', async ({ page }) => {
  // s0 opens with [club-q, diamond-6, diamond-5, diamond-8].
  await useEnglish(page);
  await page.goto('/?debug#/play?seed=s0');
  const game = await waitForPlayRoom(page);
  expect(game.room).toEqual(['club-q', 'diamond-6', 'diamond-5', 'diamond-8']);
  const hpBefore = await hp(page);

  await clickCard(page, 'diamond-6');
  await clickActionButton(page, 'btn-equip-weapon');
  const afterEquip = await waitForGame(page, (state) => state.room.length === 3);
  expect(afterEquip.weapon).toBe('diamond-6');

  // Navigating away from the seed and reloading (no seed in URL) resumes the
  // saved run.
  await page.goto('/?debug#/play');
  await page.reload();
  const resumed = await waitForPlayRoom(page);
  expect(resumed.room).toHaveLength(3);
  expect(resumed.weapon).toBe('diamond-6');
  expect(resumed.hp).toBe(hpBefore);
});
