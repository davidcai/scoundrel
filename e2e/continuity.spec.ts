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
  await expect(page.getByRole('button', { name: 'Run away' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(beforeReload.state.health),
  );

  await replaySteps(page, scenario.steps.slice(2));
  await expect(page.getByRole('heading', { name: 'You fell' })).toBeVisible();
});

test('keeps a completed result after reload and records statistics once', async ({ page }) => {
  const loss = await playLossRun(page);

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
  await expect(page.getByText(loss.seed).first()).toBeVisible();

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
  await expect(page.getByRole('button', { name: 'Continue run' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue run' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    String(before.state.health),
  );
});

test('rejects invalid replay links and unknown routes without creating a run', async ({ page }) => {
  await openTitle(page);
  await page.getByRole('button', { name: 'Replay link' }).click();
  await page
    .getByLabel('Replay link or seed URL', { exact: true })
    .fill('https://example.com/not-a-replay-link');
  await page.getByRole('button', { name: 'Start from link' }).click();
  await expect(page.getByTestId('link-error')).toBeVisible();
  expect(await readStorage(page, RUN_KEY)).toBeNull();

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
