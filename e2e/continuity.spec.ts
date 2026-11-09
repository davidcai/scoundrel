import { expect, test } from '@playwright/test';
import { DEFAULT_RULE_CONFIG } from '../src/engine';
import {
  findLostScenario,
  installUnavailableStorage,
  openTitle,
  playLossRun,
  projectLane,
  readStorage,
  replaySteps,
  simulateSteps,
  startSeededRun,
  writeStorage,
} from './support/game';

const RUN_KEY = 'scoundrel:run';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'full', 'Full-flow lane only.');
});

test('resumes an active run after reload', async ({ page }) => {
  const scenario = findLostScenario();
  const beforeReload = simulateSteps(
    scenario.seed,
    DEFAULT_RULE_CONFIG,
    scenario.steps.slice(0, 2),
  );

  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps.slice(0, 2));
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(beforeReload.state.health),
  );

  await page.reload();
  await expect(page.locator('.room-grid')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(beforeReload.state.health),
  );

  await replaySteps(page, scenario.steps.slice(2));
  await expect(page.getByRole('heading', { name: 'You fell' })).toBeVisible();
});

test('keeps a completed result after reload and records statistics once', async ({ page }) => {
  await playLossRun(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'You fell' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'You fell' })).toBeVisible();

  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await expect(
    page.locator('dt', { hasText: 'Games played' }).locator('xpath=following-sibling::dd'),
  ).toHaveText('1');
  await expect(
    page.locator('dt', { hasText: 'Losses' }).locator('xpath=following-sibling::dd'),
  ).toHaveText('1');
  await expect(page.getByTestId('history-outcome')).toHaveText('Lost');

  await page.reload();
  await expect(
    page.locator('dt', { hasText: 'Games played' }).locator('xpath=following-sibling::dd'),
  ).toHaveText('1');
});

test('rejects an invalid seed without changing the active run', async ({ page }) => {
  const scenario = findLostScenario();
  const before = simulateSteps(scenario.seed, DEFAULT_RULE_CONFIG, scenario.steps.slice(0, 2));
  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps.slice(0, 2));

  await openTitle(page);
  await expect(page.getByRole('button', { name: 'Continue run' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter seed' }).click();
  await page.getByLabel('Seed', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Start with this seed' }).click();

  await expect(page.getByTestId('seed-error')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue run' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue run' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(before.state.health),
  );
});

test('starts a deterministic run from a testing play URL', async ({ page }) => {
  await page.goto('/#/play?seed=testing-url&config=1');

  await expect(page.getByRole('heading', { name: 'Room 1' })).toBeVisible();
  await expect(page.getByLabel('Run seed testing-url')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay link' })).toHaveCount(0);
});

test('rejects unknown and invalid play routes without creating a run', async ({ page }) => {
  await openTitle(page);

  await page.goto('/#/playground?seed=abc&config=0');
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();

  await page.goto('/#/play?seed=%20&config=9');
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();
});

test('offers recovery for an unreadable saved run and keeps the raw data', async ({ page }) => {
  await openTitle(page);
  await writeStorage(page, RUN_KEY, 'not-json');
  await page.reload();

  await expect(page.getByRole('region', { name: 'Saved data notice' })).toBeVisible();
  await expect(
    page.getByText('The saved run could not be read. The data has been kept.'),
  ).toBeVisible();
  expect(await readStorage(page, RUN_KEY)).toBe('not-json');

  await page.getByRole('button', { name: 'Discard unreadable run' }).click();
  await expect(page.getByRole('region', { name: 'Saved data notice' })).toHaveCount(0);
  expect(await readStorage(page, RUN_KEY)).toBeNull();
});

test('keeps saved data from a newer version unchanged', async ({ page }) => {
  const raw = '{"schemaVersion":99,"data":{}}';
  await openTitle(page);
  await writeStorage(page, RUN_KEY, raw);
  await page.reload();

  await expect(page.getByRole('region', { name: 'Saved data notice' })).toBeVisible();
  await expect(
    page.getByText('Saved data from a newer version was found and was not changed.'),
  ).toBeVisible();
  expect(await readStorage(page, RUN_KEY)).toBe(raw);
});

test('falls back to session-only play when storage is unavailable', async ({ page, context }) => {
  await installUnavailableStorage(context);
  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Saved data notice' })).toBeVisible();
  await expect(
    page.getByText(
      'Saving is unavailable in this browser. You can play, but progress will not be saved.',
    ),
  ).toBeVisible();
  await startSeededRun(page, findLostScenario().seed);
  await expect(page.getByText('Not saving', { exact: true })).toBeVisible();
});
