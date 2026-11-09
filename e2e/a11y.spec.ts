import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  DEFAULT_RULE_CONFIG,
  applyAction,
  cardKind,
  cardValue,
  createInitialState,
  isMonster,
  previewMonster,
  type GameState,
} from '../src/engine';
import {
  findLostScenario,
  openTitle,
  playLossRun,
  projectLane,
  replaySteps,
  startSeededRun,
  toAction,
  type UiStep,
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
    !['chromium-wide', 'chromium-medium'].includes(testInfo.project.name),
    'Axe scans run on the Chromium projects.',
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

test('has no WCAG 2.2 AA violations during play and on the result screen', async ({
  page,
}, testInfo) => {
  if (projectLane(testInfo) === 'touch') {
    await page.setViewportSize({ width: 665, height: 900 });
  }
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await scan(page, 'play');
  await page.locator('.card[data-card]').first().click();
  await scan(page, 'selected card preview');
  await page.keyboard.press('Escape');

  await playLossRun(page);
  await scan(page, 'result');
});

/**
 * Builds a deterministic carried-room fixture from the pure engine: search a
 * seed, play a safety-first policy until a room holds a card carried over from
 * the previous room, and remember the interface steps that got there. Keeping
 * the fixture engine-generated avoids checked-in save data.
 */
function findCarriedScenario(maxSeeds = 200): { seed: string; steps: UiStep[] } {
  for (let index = 0; index < maxSeeds; index += 1) {
    const seed = `a11y-carried-${index}`;
    let state = createInitialState(seed, DEFAULT_RULE_CONFIG);
    const steps: UiStep[] = [];
    for (let guard = 0; guard < 200 && state.status === 'playing'; guard += 1) {
      if (state.room.cards.some((card) => card.carried)) {
        return { seed, steps: [...steps] };
      }
      const step = carriedPolicy(state);
      const result = applyAction(state, toAction(step));
      if (!result.ok) throw new Error(`Carried fixture step rejected: ${result.reason}`);
      steps.push(step);
      state = result.state;
    }
  }
  throw new Error(`Could not find a carried-room fixture within ${maxSeeds} seeds.`);
}

/** Resolves known-safe cards until the room clears, then enters the next room. */
function carriedPolicy(state: GameState): UiStep {
  if (state.roomCleared) return { kind: 'enterNextRoom' };
  const cards = state.room.cards.filter((card) => !card.carried);
  const potion = cards.find((card) => cardKind(card.card) === 'potion');
  if (potion !== undefined && state.health <= 15) {
    return { kind: 'resolve', card: potion.card };
  }
  const weapon = cards.find((card) => cardKind(card.card) === 'weapon');
  if (weapon !== undefined && state.weapon === null) {
    return { kind: 'resolve', card: weapon.card };
  }
  const monsters = cards
    .filter((card) => isMonster(card.card))
    .sort((left, right) => cardValue(left.card) - cardValue(right.card));
  const monster = monsters[0];
  if (monster === undefined) return { kind: 'resolve', card: cards[0]!.card };
  if (state.weapon !== null) {
    const preview = previewMonster(state, monster.card);
    if (preview.ok && preview.preview.weapon?.eligible) {
      return { kind: 'resolve', card: monster.card, attack: 'weapon' };
    }
  }
  return { kind: 'resolve', card: monster.card, attack: 'barehanded' };
}

test('has no WCAG 2.2 AA violations on carried room cards', async ({ page }) => {
  const scenario = findCarriedScenario();
  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps);
  await expect(page.locator('.card__badge').first()).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await scan(page, 'carried room 1440x900');

  await page.setViewportSize({ width: 1024, height: 768 });
  await scan(page, 'carried room 1024x768');

  await page.setViewportSize({ width: 665, height: 900 });
  await scan(page, 'carried room 665x900');
});
