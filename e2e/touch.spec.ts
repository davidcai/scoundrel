import { expect, test } from '@playwright/test';
import { confirmLabel, findLostScenario, projectLane, startSeededRun } from './support/game';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'touch', 'Touch lane only.');
});

test('plays comfortably on a compact touch viewport', async ({ page }) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);

  // No horizontal page scrolling at a 390px viewport.
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: root.scrollWidth, innerWidth: window.innerWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

  // Primary actions meet the 44x44 touch target.
  const actionBar = page.getByRole('group', { name: 'Room actions' });
  for (const name of ['Enter next room', 'Run away', 'Undo', 'Help']) {
    const box = await actionBar.getByRole('button', { name }).boundingBox();
    expect(box, `${name} should be rendered`).not.toBeNull();
    expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(44);
  }

  // Room cards fill the compact track and remain tappable.
  const cardBox = await page.locator('.card').first().boundingBox();
  expect(cardBox?.width ?? 0).toBeGreaterThanOrEqual(132);
  expect(cardBox?.height ?? 0).toBeGreaterThanOrEqual(132);

  const actionBarTop = (await actionBar.boundingBox())?.y;
  expect(actionBarTop).toBeDefined();

  // Tapping a card opens the preview sheet above the fixed action bar.
  await page.locator('.card').first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox?.y ?? 0).toBeGreaterThanOrEqual(0);
  if (actionBarTop !== undefined) {
    expect((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0)).toBeLessThanOrEqual(actionBarTop + 1);
  }

  const closeBox = await page.getByRole('button', { name: 'Close preview' }).boundingBox();
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'Close preview' }).click();
  await expect(sheet).toHaveCount(0);

  // Confirm the first scripted card through the sheet, then undo to room start.
  const step = scenario.steps[0];
  if (step === undefined || step.kind !== 'resolve') {
    throw new Error('The fixture must start with a resolve step.');
  }
  await page.locator(`[data-card="${step.card}"]`).click();
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: confirmLabel(step), exact: true }).click();
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', '20');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
});
