import { expect, test, type AwaitTableReady, type Page } from './renderer';

// Every action is driven through player-visible UI; card ids are only read
// off stable data attributes for targeting and assertions.
//
// The spec runs once per Playwright project (playwright.config.ts): `chromium`
// against the DOM renderer (app defaults) and `chromium-phaser` against the
// canvas renderer, seeded via the `scoundrel:settings` shard in e2e/renderer.ts.
// On the phaser path the DOM room mirror is the pointer-input proxy
// (`[data-card-id]` click/read locators work unchanged on both paths) and
// `[data-table-ready="true"]` gates canvas-dependent waits.

const valueOf = (cardId: string): number => {
  const rank = cardId.slice(cardId.indexOf('-') + 1);
  if (rank === 'j') return 11;
  if (rank === 'q') return 12;
  if (rank === 'k') return 13;
  if (rank === 'a') return 14;
  return Number(rank);
};

const isMonster = (id: string) => id.startsWith('club-') || id.startsWith('spade-');
const isWeapon = (id: string) => id.startsWith('diamond-');
const isPotion = (id: string) => id.startsWith('heart-');

// English card label (src/i18n.ts cardLabel, 'en'): "8 of Clubs" / "Jack of
// Spades" — used to assert the selection control's aria-live announcement.
const cardName = (cardId: string): string => {
  const rank = cardId.slice(cardId.indexOf('-') + 1);
  const names: Record<string, string> = { j: 'Jack', q: 'Queen', k: 'King', a: 'Ace' };
  const suits: Record<string, string> = {
    club: 'Clubs',
    diamond: 'Diamonds',
    heart: 'Hearts',
    spade: 'Spades',
  };
  return `${names[rank] ?? rank} of ${suits[cardId.slice(0, cardId.indexOf('-'))]}`;
};

async function roomIds(page: Page): Promise<string[]> {
  return page
    .locator('.room [data-card-id]')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.cardId as string));
}

async function hp(page: Page): Promise<number> {
  const text = await page.locator('.hud-group.hp .hud-value').innerText();
  return Number(text.split('/')[0]);
}

/**
 * When hurt and a potion is on the table, select it and drink it — unless the
 * confirm button says it would be wasted (second potion of the room), in which
 * case cancel and leave it to the generic pick below.
 */
async function drinkUsefulPotion(
  page: Page,
  ids: string[],
  currentHp: number,
  awaitTableReady: AwaitTableReady,
): Promise<boolean> {
  const potionId = ids.find(isPotion);
  if (potionId === undefined) return false;
  await awaitTableReady();
  await page.locator(`[data-card-id="${potionId}"]`).click();
  const drink = page.getByRole('button', { name: /drink potion/i });
  if (!(await drink.isVisible().catch(() => false))) return false;
  if (/wasted/i.test(await drink.innerText())) {
    await page.getByRole('button', { name: /cancel/i }).click();
    return false;
  }
  if (currentHp >= 20) {
    await page.getByRole('button', { name: /cancel/i }).click();
    return false;
  }
  await drink.click();
  return true;
}

/** Deterministic greedy strategy, played entirely through the real UI. */
async function playOutGreedy(page: Page, awaitTableReady: AwaitTableReady): Promise<void> {
  for (let guard = 0; guard < 500; guard++) {
    if (
      await page
        .getByRole('dialog')
        .isVisible()
        .catch(() => false)
    )
      return;
    const ids = await roomIds(page);
    if (ids.length === 0) return;

    // Enter the next room once only the carry card is left.
    if (ids.length === 1) {
      const dungeonText = await page
        .locator('.hud-group', { hasText: 'Dungeon' })
        .locator('.hud-value')
        .innerText();
      if (Number(dungeonText.split(' ')[0]) > 0) {
        const enter = page.getByRole('button', { name: /enter next room/i });
        if ((await enter.getAttribute('aria-disabled')) === 'false') {
          await enter.click();
          continue;
        }
      }
    }

    // Pick: healing potion when hurt, weapon upgrade, weakest monster, fallback.
    const currentHp = await hp(page);
    if (currentHp <= 12 && (await drinkUsefulPotion(page, ids, currentHp, awaitTableReady)))
      continue;
    let chosen: string | undefined;
    if (chosen === undefined) {
      const bestRoomWeapon = ids.filter(isWeapon).sort((a, b) => valueOf(b) - valueOf(a))[0];
      const weaponCards = page.locator('.weapon-card');
      const equippedId =
        (await weaponCards.count()) > 0 ? await weaponCards.getAttribute('data-card-id') : null;
      if (
        bestRoomWeapon !== undefined &&
        (equippedId === null || valueOf(bestRoomWeapon) > valueOf(equippedId))
      ) {
        chosen = bestRoomWeapon;
      }
    }
    chosen ??= ids.filter(isMonster).sort((a, b) => valueOf(a) - valueOf(b))[0] ?? ids[0];
    if (chosen === undefined) return;

    await awaitTableReady();
    await page.locator(`[data-card-id="${chosen}"]`).click();

    if (isMonster(chosen)) {
      const fightWith = page.getByRole('button', { name: /fight with .* take (\d+) damage/i });
      const barehanded = page.getByRole('button', { name: /fight barehanded/i });
      if (await fightWith.isVisible().catch(() => false)) {
        const damage = Number((await fightWith.innerText()).match(/take (\d+) damage/)![1]);
        if (damage < currentHp) {
          await fightWith.click();
          continue;
        }
      }
      if (await barehanded.isVisible().catch(() => false)) {
        await barehanded.click(); // lethal or not — barehanding ends the run or the monster
        continue;
      }
      return;
    }
    if (isWeapon(chosen)) {
      const equip = page.getByRole('button', { name: /^Equip/ });
      if (await equip.isVisible().catch(() => false)) {
        await equip.click();
        continue;
      }
      return;
    }
    const drink = page.getByRole('button', { name: /drink potion/i });
    if (await drink.isVisible().catch(() => false)) {
      await drink.click();
      continue;
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Title & interaction
// ---------------------------------------------------------------------------

test.describe('language detection', () => {
  // Boot on app defaults (no renderer seeding): this suite tests detection.
  test.use({ seedSettings: false });
  test.use({ locale: 'zh-CN' });

  test('a zh-configured browser opens in Chinese by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('button', { name: '新开局' })).toBeVisible();

    // Fresh visits default to auto-detection; a zh browser resolves to Chinese.
    await page.getByRole('button', { name: '设置' }).click();
    await expect(page.getByLabel('语言 Language')).toHaveValue('auto');

    // An explicit choice persists across a reload.
    await page.getByLabel('语言 Language').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Language')).toHaveValue('en');
  });
});

test('title screen offers the full menu and a new run deals a room', async ({
  page,
  awaitTableReady,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /scoundrel/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();

  await page.getByRole('button', { name: 'New run' }).click();
  await expect(page).toHaveURL(/#\/play/);
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  await expect(page.locator('.hud-group.hp .hud-value')).toHaveText('20/20');
});

test('keyboard navigation reaches every card and arrows move selection', async ({
  page,
  awaitTableReady,
  tableRenderer,
}) => {
  await page.goto('/#/play?seed=kbtest');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();

  if (tableRenderer === 'phaser') {
    // Canvas path (docs/phaser-plan.md §5): the cards are sprites, not DOM —
    // keyboard input goes through the overlay CardSelectionControl; the canvas
    // draws the highlight ring and the DOM mirror reflects it.
    const control = page.locator('.card-selection');
    await control.focus();

    // No selection yet: the first arrow selects the first room card.
    await page.keyboard.press('ArrowRight');
    const ids = await roomIds(page);
    await expect(control).toHaveAttribute('data-selected-card-id', ids[0]!);
    await expect(
      page.locator(`.room-mirror [data-card-id="${ids[0]}"] .selected-ring`),
    ).toBeVisible();

    // A screen-reader live region announces the newly selected card's name.
    await expect(page.locator('.card-selection [aria-live="polite"]')).toHaveText(
      cardName(ids[0]!),
    );

    // Arrows cycle with wrap; End jumps to the last card.
    await page.keyboard.press('ArrowRight');
    await expect(control).toHaveAttribute('data-selected-card-id', ids[1]!);
    await page.keyboard.press('End');
    await expect(control).toHaveAttribute('data-selected-card-id', ids[ids.length - 1]!);
    await expect(page.locator('.card-selection [aria-live="polite"]')).toHaveText(
      cardName(ids[ids.length - 1]!),
    );

    // Escape deselects.
    await page.keyboard.press('Escape');
    expect(await control.getAttribute('data-selected-card-id')).toBeNull();
  } else {
    await page.locator('.room .card').first().focus();
    await expect(page.locator('.room .card').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    const secondId = await page
      .locator('.room .card')
      .nth(1)
      .evaluate((el) => (el as HTMLElement).dataset.cardId);
    await expect(page.locator(`[data-card-id="${secondId}"]`)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.room .card').first()).toBeFocused();

    // Enter selects the card — same as a click (selection ring).
    await page.keyboard.press('Enter');
    await expect(page.locator('.room .card').first().locator('.selected-ring')).toBeVisible();
  }

  // A screen-reader live region announces the dealt room.
  await expect(page.getByRole('status')).toContainText(/room/i);
});

test('carried cards are marked in the next room', async ({ page, awaitTableReady }) => {
  // s20 opens with [diamond-5, heart-9, spade-8, diamond-9].
  await page.goto('/#/play?seed=s20');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();

  await page.locator('[data-card-id="diamond-5"]').click();
  await page.getByRole('button', { name: /^Equip/ }).click();
  await page.locator('[data-card-id="heart-9"]').click();
  await page.getByRole('button', { name: /drink potion/i }).click();
  await page.locator('[data-card-id="spade-8"]').click();
  await page.getByRole('button', { name: /fight with/i }).click();

  const enter = page.getByRole('button', { name: /enter next room/i });
  await expect(enter).toHaveAttribute('aria-disabled', 'false');
  await enter.click();

  await expect(page.locator('.carried-badge')).toHaveCount(1);
  await expect(page.locator('.room [data-card-id]').first()).toHaveAttribute(
    'data-card-id',
    'diamond-9',
  );
});

// ---------------------------------------------------------------------------
// Seeded determinism & shareable URLs
// ---------------------------------------------------------------------------

test('the same seed deals the same room every time', async ({ page, awaitTableReady }) => {
  await page.goto('/#/play?seed=determinism');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  const first = await roomIds(page);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/play?seed=determinism');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  const second = await roomIds(page);
  expect(second).toEqual(first);
});

test('a full seeded run ends in a scorecard, records stats once, and survives reload', async ({
  page,
  awaitTableReady,
}) => {
  await page.goto('/#/play?seed=e2fterm');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  await playOutGreedy(page, awaitTableReady);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole('heading', { name: /victory|defeat/i })).toBeVisible();
  await expect(dialog.getByTestId('final-score')).toBeVisible();

  // The run was recorded in stats exactly once.
  await page.goto('/#/stats');
  const history = page.getByRole('table', { name: /run history/i });
  await expect(history).toContainText('e2fterm');
  await expect(history.locator('.run-row')).toHaveCount(1);

  // Reloading the terminal screen (no seed in URL) restores the scorecard
  // from the persisted run — and does not double-count the stats entry.
  await page.goto('/#/play');
  await page.reload();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/stats');
  await expect(history.locator('.run-row')).toHaveCount(1);
});

test('the replay link round-trips through the clipboard', async ({ page, awaitTableReady }) => {
  // Clipboard access needs explicit permissions on the fixture context.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.goto('/#/play?seed=sharetest');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  const firstRoom = await roomIds(page);

  await playOutGreedy(page, awaitTableReady);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: /copy replay link/i }).click();
  await expect(dialog.getByRole('button', { name: /replay link copied/i })).toBeVisible();

  const link = await page.evaluate(() => navigator.clipboard?.readText() ?? '');
  expect(link).toContain('#/play?seed=sharetest');

  // A full navigation (not a hash change) so the store boots fresh.
  await page.goto('about:blank');
  await page.goto(link);
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  expect(await roomIds(page)).toEqual(firstRoom);
});

// ---------------------------------------------------------------------------
// Persistence mid-run
// ---------------------------------------------------------------------------

test('a mid-run page load without the seed resumes the saved room state', async ({
  page,
  awaitTableReady,
}) => {
  // s0 opens with [club-q, diamond-6, diamond-5, diamond-8].
  await page.goto('/#/play?seed=s0');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await awaitTableReady();
  const hpBefore = await hp(page);

  await page.locator('[data-card-id="diamond-6"]').click();
  await page.getByRole('button', { name: /^Equip/ }).click();
  await expect(page.locator('.room [data-card-id]')).toHaveCount(3);
  await expect(page.locator('.weapon-card')).toHaveAttribute('data-card-id', 'diamond-6');

  // Navigating away and reloading (no seed in URL) resumes the saved run.
  await page.goto('/#/play');
  await page.reload();
  await expect(page.locator('.room [data-card-id]')).toHaveCount(3);
  await awaitTableReady();
  await expect(page.locator('.weapon-card')).toHaveAttribute('data-card-id', 'diamond-6');
  expect(await hp(page)).toBe(hpBefore);
});

// ---------------------------------------------------------------------------
// Canvas visual regression (docs/phaser-plan.md §4 Phase 1 exit criterion)
// ---------------------------------------------------------------------------

test.describe('phaser canvas', () => {
  test('the dealt table renders the room at the seeded layout', async ({
    page,
    awaitTableReady,
    tableRenderer,
  }) => {
    test.skip(tableRenderer !== 'phaser', 'the canvas snapshot is a phaser-path check');
    await page.goto('/#/play?seed=tableshot');
    await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
    await awaitTableReady();
    const canvas = page.locator('.play-table-canvas canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveScreenshot('table-scene.png');
  });
});
