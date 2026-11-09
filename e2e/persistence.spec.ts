import { expect, test } from '@playwright/test';
import { DEFAULT_RULE_CONFIG, createInitialState } from '../src/engine';
import {
  findLostScenario,
  openTitle,
  playLossRun,
  projectLane,
  replaySteps,
  startSeededRun,
  statsDetail,
} from './support/game';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'full', 'Full-flow lane only.');
});

test('records one abandoned loss when a new run replaces an unfinished run', async ({ page }) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps.slice(0, 1));
  await openTitle(page);
  await expect(page.getByRole('button', { name: 'Continue run' })).toBeVisible();

  await page.getByRole('button', { name: 'New run' }).click();
  await expect(page.getByTestId('shell-notice')).toContainText('recorded as an abandoned loss');
  await expect(page.locator('.room-grid')).toBeVisible();

  await page.goto('/#/stats');
  await expect(statsDetail(page, 'Games played')).toHaveText('1');
  await expect(statsDetail(page, 'Wins')).toHaveText('0');
  await expect(statsDetail(page, 'Losses')).toHaveText('1');
  await expect(page.getByTestId('history-outcome')).toHaveText('Abandoned');

  await page.reload();
  await expect(statsDetail(page, 'Games played')).toHaveText('1');
});

test('discards an unfinished run only after confirmation and records one loss', async ({
  page,
}) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps.slice(0, 1));
  await openTitle(page);

  await page.getByRole('button', { name: 'Discard run' }).click();
  await expect(page.getByRole('heading', { name: 'Discard unfinished run?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard run' }).click();
  await expect(page.getByTestId('shell-notice')).toContainText('abandoned loss');
  await expect(page.getByRole('button', { name: 'Continue run' })).toHaveCount(0);

  await page.goto('/#/stats');
  await expect(statsDetail(page, 'Games played')).toHaveText('1');
  await expect(statsDetail(page, 'Losses')).toHaveText('1');
  await expect(page.getByTestId('history-outcome')).toHaveText('Abandoned');
});

test('records a completed result once across reloads and a second tab', async ({
  page,
  context,
}) => {
  await playLossRun(page);

  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await expect(statsDetail(page, 'Games played')).toHaveText('1');
  await page.reload();
  await expect(statsDetail(page, 'Games played')).toHaveText('1');

  const secondTab = await context.newPage();
  await secondTab.goto('/#/stats');
  await expect(secondTab.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await expect(
    secondTab.locator('dt', { hasText: 'Games played' }).locator('xpath=following-sibling::dd'),
  ).toHaveText('1');
  await secondTab.close();
});

test('replays a listed run as a fresh attempt', async ({ page }) => {
  const loss = await playLossRun(page);
  await page.goto('/#/stats');

  await page.getByRole('button', { name: `Replay run ${loss.seed}` }).click();
  await expect(page.getByRole('heading', { name: 'Room 1' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  await expect(page.getByRole('heading', { name: 'You fell' })).toHaveCount(0);
});

test('copies a replay link that reproduces the dungeon', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-wide', 'Clipboard copy is Chromium-only here.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const loss = await playLossRun(page);
  const linkInput = page.locator('textarea[readonly]');
  await expect(linkInput).toHaveCount(1);
  const link = await linkInput.inputValue();
  expect(link).toContain('#/play?seed=');

  await page.getByRole('button', { name: 'Copy replay link' }).click();
  await expect(page.getByTestId('copy-state')).toHaveText('Replay link copied.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(link);

  // Open the link in a fresh browser profile: reopening it in the same profile
  // restores the saved completed result that matches the play route instead of
  // starting a new attempt.
  const browser = context.browser();
  if (browser === null) throw new Error('A browser instance is required.');
  const recipient = await browser.newContext();
  try {
    const recipientPage = await recipient.newPage();
    await recipientPage.goto(link);
    await expect(recipientPage.getByRole('heading', { name: 'Room 1' })).toBeVisible();
    await expect(recipientPage.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    const expectedCards = createInitialState(loss.seed, DEFAULT_RULE_CONFIG)
      .room.cards.map((card) => card.card)
      .sort();
    const renderedCards = (
      await recipientPage
        .locator('.card[data-card]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-card') ?? ''),
        )
    ).sort();
    expect(renderedCards).toEqual(expectedCards);
  } finally {
    await recipient.close();
  }
});
