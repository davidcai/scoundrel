import { expect, test, type Page } from '@playwright/test';

// Every action is driven through player-visible UI; card ids are only read
// off stable data attributes for targeting and assertions.

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

async function roomIds(page: Page): Promise<string[]> {
  return page
    .locator('.room [data-card-id]')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.cardId as string));
}

async function hp(page: Page): Promise<number> {
  const text = await page.locator('.hud-group.hp .hud-value').innerText();
  return Number(text.split('/')[0]);
}

async function potionAvailable(page: Page): Promise<boolean> {
  const text = await page.locator('.hud-group', { hasText: 'Potion' }).innerText();
  return text.includes('available');
}

/** Deterministic greedy strategy, played entirely through the real UI. */
async function playOutGreedy(page: Page): Promise<void> {
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
    let chosen: string | undefined;
    if (currentHp <= 12 && (await potionAvailable(page))) {
      chosen = ids.find(isPotion);
    }
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
// Language fixtures
// ---------------------------------------------------------------------------

// The app defaults to Chinese; most e2e tests assert the English UI, so they
// pin English before the app boots. The Chinese default gets its own test.
const ENGLISH_SETTINGS = JSON.stringify({
  version: 1,
  data: {
    config: { runAwayMode: 'once', potionsPerRoom: 'one', weaponDegradation: true },
    language: 'en',
  },
});

async function useEnglish(page: Page): Promise<void> {
  await page.addInitScript(
    (settings) => localStorage.setItem('scoundrel:settings', settings),
    ENGLISH_SETTINGS,
  );
}

// ---------------------------------------------------------------------------
// Title & interaction
// ---------------------------------------------------------------------------

test.describe('language detection', () => {
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

test('title screen offers the full menu and a new run deals a room', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /scoundrel/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();

  await page.getByRole('button', { name: 'New run' }).click();
  await expect(page).toHaveURL(/#\/play/);
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await expect(page.locator('.hud-group.hp .hud-value')).toHaveText('20/20');
});

test('keyboard navigation reaches every card and arrows move focus', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/#/play?seed=kbtest');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);

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

  // A screen-reader live region announces the dealt room.
  await expect(page.getByRole('status')).toContainText(/room/i);
});

test('carried cards are marked in the next room', async ({ page }) => {
  // s20 opens with [diamond-5, heart-9, spade-8, diamond-9].
  await useEnglish(page);
  await page.goto('/#/play?seed=s20');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);

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

test('the same seed deals the same room every time', async ({ page }) => {
  await useEnglish(page);
  await page.goto('/#/play?seed=determinism');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  const first = await roomIds(page);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/play?seed=determinism');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  const second = await roomIds(page);
  expect(second).toEqual(first);
});

test('a full seeded run ends in a scorecard, records stats once, and survives reload', async ({
  page,
}) => {
  await useEnglish(page);
  await page.goto('/#/play?seed=e2fterm');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  await playOutGreedy(page);

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

test('the replay link round-trips through the clipboard', async ({ browser }) => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();

  await useEnglish(page);
  await page.goto('/#/play?seed=sharetest');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  const firstRoom = await roomIds(page);

  await playOutGreedy(page);
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
  expect(await roomIds(page)).toEqual(firstRoom);
  await context.close();
});

// ---------------------------------------------------------------------------
// Persistence mid-run
// ---------------------------------------------------------------------------

test('a mid-run page load without the seed resumes the saved room state', async ({ page }) => {
  // s0 opens with [club-q, diamond-6, diamond-5, diamond-8].
  await useEnglish(page);
  await page.goto('/#/play?seed=s0');
  await expect(page.locator('.room [data-card-id]')).toHaveCount(4);
  const hpBefore = await hp(page);

  await page.locator('[data-card-id="diamond-6"]').click();
  await page.getByRole('button', { name: /^Equip/ }).click();
  await expect(page.locator('.room [data-card-id]')).toHaveCount(3);
  await expect(page.locator('.weapon-card')).toHaveAttribute('data-card-id', 'diamond-6');

  // Navigating away and reloading (no seed in URL) resumes the saved run.
  await page.goto('/#/play');
  await page.reload();
  await expect(page.locator('.room [data-card-id]')).toHaveCount(3);
  await expect(page.locator('.weapon-card')).toHaveAttribute('data-card-id', 'diamond-6');
  expect(await hp(page)).toBe(hpBefore);
});
