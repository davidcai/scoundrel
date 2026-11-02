import { expect, test } from '@playwright/test';
import { DEFAULT_RULE_CONFIG } from '../src/engine';
import { WINNING_RUN } from './fixtures/winning-run';
import {
  playLossRun,
  projectLane,
  replaySteps,
  expectResultValue,
  simulateSteps,
  startSeededRun,
} from './support/game';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'full', 'Full-flow lane only.');
});

test('wins a seeded run through the real interface', async ({ page }) => {
  const expected = simulateSteps(WINNING_RUN.seed, DEFAULT_RULE_CONFIG, WINNING_RUN.steps);
  const result = expected.state.result;
  expect(result, 'fixture replay must finish the run').not.toBeNull();
  expect(result?.outcome).toBe('won');

  await startSeededRun(page, WINNING_RUN.seed);
  await replaySteps(page, WINNING_RUN.steps);

  await expect(page.getByRole('heading', { name: 'You survived' })).toBeVisible();
  await expectResultValue(page, 'Score', String(result?.score));
  await expectResultValue(page, 'Final health', String(result?.health));
  await expectResultValue(page, 'Seed', WINNING_RUN.seed);
  await expect(page.getByText('Monsters remaining')).toHaveCount(0);
});

test('loses a run through the real interface and clamps final health', async ({ page }) => {
  const loss = await playLossRun(page);
  expect(loss.result.outcome).toBe('lost');

  await expectResultValue(page, 'Score', String(loss.result.score));
  await expectResultValue(page, 'Final health', String(Math.max(0, loss.result.health)));
  await expectResultValue(page, 'Monsters remaining', String(loss.result.remainingMonsters));
  await expectResultValue(page, 'Seed', loss.seed);
});
