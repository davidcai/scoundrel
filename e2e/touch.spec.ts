import { expect, test } from '@playwright/test';
import { findLostScenario, projectLane, startSeededRun } from './support/game';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'touch', 'Touch lane only.');
});

test('keeps the wide play controls usable on a compact touch viewport', async ({ page }) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);

  // The play surface stays on the desktop composition and scrolls horizontally.
  const playWidth = await page
    .locator('.play-screen__content')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(playWidth).toBeGreaterThanOrEqual(1000);
  await expect(page.locator('.play-screen')).toHaveJSProperty('scrollWidth', 1000);

  // Primary actions meet the 44x44 touch target.
  const actionBar = page.getByRole('group', { name: 'Room actions' });
  const runAway = actionBar.getByRole('button', { name: 'Run away' });
  await expect(runAway).toBeVisible();
  const box = await runAway.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

  // Wide cards remain tappable.
  const cardBox = await page.locator('.card').first().boundingBox();
  expect(cardBox?.width ?? 0).toBeGreaterThanOrEqual(132);
  expect(cardBox?.height ?? 0).toBeGreaterThanOrEqual(132);

  // Tapping a card uses the inline wide preview, not a modal sheet.
  await page.locator('.card').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const preview = page.locator('.play-main__preview .preview');
  await expect(preview).toBeVisible();

  const actions = page.locator('.play-main__preview .preview__actions button:enabled');
  await expect(actions.first()).toBeVisible();
  await actions.last().click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
});
