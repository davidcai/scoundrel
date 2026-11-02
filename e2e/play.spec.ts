import { WINNING_ACTIONS, WINNING_SEED } from '../tests/fixtures/winning-run';
import { saved } from './save-helper';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createGame, encodeReplay, getCard, isRoomComplete, transition } from '../src/engine';
import type { Action, GameState, RoomState, CardId } from '../src/engine';

async function choose(page: Page, id: string) {
  await page.locator(`button[data-card-id="${id}"]`).click();
}
async function startCinder(page: Page) {
  await page.goto('/' + encodeReplay('cinder'));
  await expect(page.getByRole('heading', { name: 'Room 1', exact: true })).toBeVisible();
}
async function confirm(page: Page, action: Action) {
  if ('cardId' in action) await choose(page, action.cardId);
  const name =
    action.type === 'fight'
      ? action.mode === 'weapon'
        ? 'Fight with weapon'
        : 'Fight barehanded'
      : action.type === 'equip'
        ? 'Equip weapon'
        : action.type === 'drink'
          ? 'Drink potion'
          : action.type === 'escape'
            ? 'Run away'
            : 'Enter next room';
  await page.getByRole('button', { name, exact: true }).click();
}

test('New Run works, and menu/continue preserves the session', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await expect(page.locator('[data-card-id]')).toHaveCount(4);
  const seed = await page.locator('.seed-value').innerText();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  await expect(page.locator('.seed-value')).toHaveText(seed);
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('previews do not commit; confirm, undo, room entry and escape use real rules', async ({
  page,
}) => {
  await startCinder(page);
  await choose(page, 'heart-4');
  const potionButton = page.getByRole('button', { name: 'Drink potion', exact: true });
  await expect(potionButton).toContainText('Restore 0 health');
  await expect(potionButton).toHaveAccessibleDescription('Restore 0 health');
  await choose(page, 'spade-7');
  const weaponButton = page.getByRole('button', { name: 'Fight with weapon', exact: true });
  await expect(weaponButton).toBeDisabled();
  await expect(weaponButton).toHaveCSS('background-color', 'rgb(28, 37, 37)');
  await expect(page.getByRole('button', { name: 'Fight barehanded', exact: true })).toContainText(
    'Take 7 damage',
  );
  await expect(
    page.getByRole('button', { name: 'Fight barehanded', exact: true }),
  ).toHaveAccessibleDescription('Take 7 damage');
  await expect(page.locator('.health-value')).toHaveText('20 / 20');
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeEnabled();
  await choose(page, 'diamond-6');
  const equipButton = page.getByRole('button', { name: 'Equip weapon', exact: true });
  await expect(equipButton).toContainText('of power 6');
  await expect(equipButton).toHaveAccessibleDescription('of power 6');
  await equipButton.click();
  const replayHash = await page.evaluate(() => location.hash);
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => location.hash)).toBe(replayHash);
  await expect(page.getByRole('heading', { name: 'Your equipped weapon 6', exact: true })).toBeVisible();
  await choose(page, 'spade-7');
  await expect(weaponButton).toBeEnabled();
  await expect(weaponButton).toContainText('Take 1 damage');
  await expect(weaponButton).toHaveAccessibleDescription('Take 1 damage');
  await expect(
    page.locator('.preview').getByText('Health after action:', { exact: false }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Fight with weapon', exact: true }).click();
  await expect(page.locator('.health-value')).toHaveText('19 / 20');
  await choose(page, 'heart-4');
  await expect(potionButton).toContainText('Restore 1 health');
  await expect(potionButton).toHaveAccessibleDescription('Restore 1 health');
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo room', exact: true }).click();
  await expect(page.locator('.health-value')).toHaveText('20 / 20');
  await expect(page.locator('[data-card-id]')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'No weapon equipped' })).toBeVisible();
  await confirm(page, { type: 'equip', cardId: 'diamond-6' });
  await confirm(page, { type: 'fight', cardId: 'spade-7', mode: 'weapon' });
  await confirm(page, { type: 'drink', cardId: 'heart-4' });
  await page.getByRole('button', { name: 'Enter next room', exact: true }).click();
  await expect(page.locator('.carried')).toHaveText('Carried');
  await page.getByRole('button', { name: 'Run away', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run away', exact: true })).toBeDisabled();
  await expect(
    page.getByText('You cannot escape two rooms in a row.', { exact: true }),
  ).toBeVisible();
});

test('weapon fight shows zero damage when the weapon blocks the full attack', async ({ page }) => {
  await page.goto('/' + encodeReplay('pvz28b'));
  await choose(page, 'diamond-7');
  await page.getByRole('button', { name: 'Equip weapon', exact: true }).click();
  await choose(page, 'club-4');
  const weaponButton = page.getByRole('button', { name: 'Fight with weapon', exact: true });
  await expect(weaponButton).toBeEnabled();
  await expect(weaponButton).toContainText('Take 0 damage');
  await expect(weaponButton).toHaveAccessibleDescription('Take 0 damage');
});

test('seed input validates without replacing the run; rules freeze at start; keyboard selection works', async ({
  page,
}) => {
  await startCinder(page);
  const original = await page
    .locator('[data-card-id]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-card-id')));
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Enter seed', exact: true }).click();
  await page.getByLabel('Dungeon seed', { exact: true }).fill('invalid!');
  await page.getByRole('button', { name: 'Start dungeon', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter a valid seed before starting.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  expect(
    await page
      .locator('[data-card-id]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-card-id'))),
  ).toEqual(original);
  const first = page.locator('[data-card-id]').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-card-id]').nth(1)).toBeFocused();
  await expect(page.locator('[data-card-id]').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Weapon degradation', { exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  expect((await saved(page)).session.game.config.weaponDegradation).toBe(true);
});

test('responsive English and Chinese play layouts have loaded images and no horizontal overflow', async ({
  page,
}) => {
  await startCinder(page);
  for (const language of ['en', 'zh']) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#language').selectOption(language);
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: language === 'zh' ? '继续游戏' : 'Continue run', exact: true })
      .click();
    for (const width of [320, 390, 637, 768, 1000, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect
        .poll(() =>
          page
            .locator('.card img')
            .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
        )
        .toBe(true);
    }
  }
});

test('a full real-interface run can win, share, and replay with final undo blocked', async ({
  page,
}) => {
  const seed = WINNING_SEED;
  const actions = WINNING_ACTIONS;
  await page.goto('/' + encodeReplay(seed));
  for (const action of actions) await confirm(page, action);
  await expect(page.getByRole('heading', { name: 'You survived.', exact: true })).toBeVisible();
  for (const language of ['en', 'zh']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('#language').selectOption(language);
    await page.keyboard.press('Escape');
    for (const width of [320, 600, 705, 885, 1000, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.locator('.result-screen').evaluate((screen) => {
        const items = Array.from(screen.children).filter(
          (element) => element.getBoundingClientRect().height > 0,
        );
        const bounds = screen.getBoundingClientRect();
        return {
          oneColumn: items.every(
            (item) =>
              Math.abs(item.getBoundingClientRect().left - bounds.left) < 1 &&
              Math.abs(item.getBoundingClientRect().right - bounds.right) < 1,
          ),
          ordered: items.every(
            (item, i) =>
              i === 0 ||
              item.getBoundingClientRect().top >= items[i - 1].getBoundingClientRect().bottom,
          ),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(layout, `${language} ${width}px`).toEqual({
        oneColumn: true,
        ordered: true,
        overflow: false,
      });
    }
  }
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.locator('#language').selectOption('en');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Undo room', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You survived.', exact: true })).toBeVisible();
  expect((await saved(page)).session.statistics.wins).toBe(1);
  const replay = await page.getByLabel('Replay link', { exact: true }).inputValue();
  expect(replay).toContain(`seed=${seed}`);
  await page.getByRole('button', { name: 'Replay this dungeon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Room 1', exact: true })).toBeVisible();
});

test('a lethal run reaches the result screen and cannot undo', async ({ page }) => {
  await startCinder(page);
  let state: GameState = createGame('cinder');
  while (state.status === 'playing') {
    const b: RoomState = state.board;
    let action: Action;
    if (isRoomComplete(b)) action = { type: 'next-room' };
    else {
      const id: CardId = b.room.find((id) => getCard(id).kind === 'monster') ?? b.room[0];
      const c = getCard(id);
      action =
        c.kind === 'monster'
          ? { type: 'fight', cardId: id, mode: 'barehanded' }
          : { type: c.kind === 'weapon' ? 'equip' : 'drink', cardId: id };
    }
    state = transition(state, action).state;
    await confirm(page, action);
  }
  await expect(
    page.getByRole('heading', { name: 'The dungeon claimed you.', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo room', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'The dungeon claimed you.', exact: true }),
  ).toBeVisible();
  expect((await saved(page)).session.statistics.losses).toBe(1);
});
