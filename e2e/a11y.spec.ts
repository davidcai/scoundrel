import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  findLostScenario,
  openTitle,
  playLossRun,
  projectLane,
  startSeededRun,
} from './support/game';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations
    .flatMap((violation) =>
      violation.nodes.map(
        (node) =>
          `${violation.id} (${violation.impact ?? 'unknown'}) ${node.target.join(' ')}: ${
            (node.failureSummary ?? '').split('\n')[0] ?? ''
          }`,
      ),
    )
    .join(' | ');
  expect(results.violations, `${label} violations: ${summary}`).toEqual([]);
}

test.beforeEach(({}, testInfo) => {
  test.skip(!['full', 'visual'].includes(projectLane(testInfo)), 'Accessibility lane.');
  test.skip(
    !['chromium-wide', 'webkit-wide', 'chromium-medium'].includes(testInfo.project.name),
    'Axe scans run on the Chromium and WebKit projects.',
  );
});

test('has no WCAG 2.2 AA violations on the title, help, statistics, and settings screens', async ({
  page,
}) => {
  await openTitle(page);
  await scan(page, 'title');
  await page.getByRole('button', { name: 'Rules and help' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan(page, 'help dialog');
  await page.keyboard.press('Escape');

  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
  await scan(page, 'statistics');

  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await scan(page, 'settings');
});

test('has no WCAG 2.2 AA violations during play and on the result screen', async ({ page }) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await scan(page, 'play');
  await page.locator('.card[data-card]').first().click();
  await scan(page, 'selected card preview');
  await page.keyboard.press('Escape');

  await playLossRun(page);
  await scan(page, 'result');
});
