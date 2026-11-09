import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { WINNING_RUN } from './fixtures/winning-run';
import {
  findLostScenario,
  openTitle,
  playLossRun,
  projectLane,
  replaySteps,
  startSeededRun,
  writeStorage,
} from './support/game';

const SCREENSHOT_DIR = join(process.cwd(), '.artifacts', 'phase5', 'screens');

test.beforeEach(({}, testInfo) => {
  test.skip(
    !['full', 'visual', 'touch', 'narrow'].includes(projectLane(testInfo)),
    'Visual evidence lane.',
  );
  test.skip(
    !testInfo.project.name.startsWith('chromium'),
    'Visual evidence is captured in the Chromium projects.',
  );
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test('captures visual evidence for this viewport', async ({ page }, testInfo) => {
  const shot = async (name: string) => {
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${testInfo.project.name}-${name}.png`) });
  };

  await openTitle(page);
  await shot('title');

  if (['touch', 'narrow'].includes(projectLane(testInfo))) {
    // The play screen is desktop-only; keep the dense compositions usable.
    await page.setViewportSize({ width: 665, height: 900 });
  }

  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await shot('play');

  await page.locator('.card').first().click();
  await expect(
    page.getByRole('button', { name: /Fight barehanded|Use weapon|Equip weapon|Drink potion/ }),
  ).toBeVisible();
  await shot('selected');
  await page.keyboard.press('Escape');

  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await shot('stats-empty');

  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await shot('settings');

  if (projectLane(testInfo) === 'full' || projectLane(testInfo) === 'touch') {
    await playLossRun(page);
    await shot('result-loss');
    await page.goto('/#/stats');
    await shot('stats-history');

    await startSeededRun(page, WINNING_RUN.seed);
    await replaySteps(page, WINNING_RUN.steps);
    await expect(page.getByRole('heading', { name: 'You survived' })).toBeVisible();
    await shot('result-win');

    await page.goto('/');
    await writeStorage(page, 'scoundrel:run', 'not-json');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Saved data notice' })).toBeVisible();
    await shot('recovery');
  }

  await page.screenshot({ path: join(SCREENSHOT_DIR, `${testInfo.project.name}-final.png`) });
});
