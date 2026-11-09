import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_RULE_CONFIG } from '../src/engine';
import { WINNING_RUN } from './fixtures/winning-run';
import {
  confirmLabel,
  findLostScenario,
  openTitle,
  projectLane,
  simulateSteps,
  startSeededRun,
  type UiStep,
} from './support/game';

test.beforeEach(({}, testInfo) => {
  test.skip(projectLane(testInfo) !== 'full', 'Full-flow lane only.');
  test.skip(
    testInfo.project.name !== 'chromium-wide',
    'Keyboard-only run is checked in Chromium wide.',
  );
});

interface FocusInfo {
  readonly tag: string;
  readonly card: string | null;
  readonly text: string;
  readonly label: string;
}

async function focused(page: Page): Promise<FocusInfo> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      tag: element?.tagName ?? '',
      card: element?.getAttribute('data-card') ?? null,
      text: (element?.textContent ?? '').trim(),
      label: element?.getAttribute('aria-label') ?? '',
    };
  });
}

async function tabTo(
  page: Page,
  predicate: (info: FocusInfo) => boolean,
  description: string,
  maxTabs = 80,
): Promise<FocusInfo> {
  for (let index = 0; index < maxTabs; index += 1) {
    const info = await focused(page);
    if (predicate(info)) return info;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard focus did not reach ${description}.`);
}

async function pressButton(page: Page, name: string | RegExp): Promise<void> {
  const matches = (value: string) => (typeof name === 'string' ? value === name : name.test(value));
  await tabTo(
    page,
    (info) => info.tag === 'BUTTON' && (matches(info.text) || matches(info.label)),
    `the "${String(name)}" button`,
  );
  await page.keyboard.press('Enter');
}

async function focusCard(page: Page, card: string): Promise<void> {
  const current = await focused(page);
  if (current.card === null) {
    await tabTo(page, (info) => info.card !== null, `room card ${card}`);
  }
  for (let index = 0; index < 6; index += 1) {
    if ((await focused(page)).card === card) return;
    await page.keyboard.press('ArrowRight');
  }
  for (let index = 0; index < 8; index += 1) {
    if ((await focused(page)).card === card) return;
    await page.keyboard.press('ArrowLeft');
  }
  throw new Error(`Keyboard focus did not reach card ${card}.`);
}

async function keyboardReplay(page: Page, steps: readonly UiStep[]): Promise<void> {
  for (const step of steps) {
    if (step.kind === 'enterNextRoom') {
      await pressButton(page, 'Enter next room');
      continue;
    }
    if (step.kind === 'runAway') {
      await pressButton(page, 'Run away');
      continue;
    }
    await focusCard(page, step.card);
    await page.keyboard.press('Enter');
    await pressButton(page, confirmLabel(step));
  }
}

async function startSeededRunByKeyboard(page: Page, seed: string): Promise<void> {
  await openTitle(page);
  await pressButton(page, 'Enter seed');
  await tabTo(page, (info) => info.tag === 'INPUT', 'the seed input');
  await page.keyboard.type(seed);
  await pressButton(page, 'Start with this seed');
  await expect(page.locator('.room-grid')).toBeVisible();
}

test('completes a winning run using only the keyboard', async ({ page }) => {
  const expected = simulateSteps(WINNING_RUN.seed, DEFAULT_RULE_CONFIG, WINNING_RUN.steps);
  expect(expected.state.result?.outcome).toBe('won');

  await startSeededRunByKeyboard(page, WINNING_RUN.seed);
  await keyboardReplay(page, WINNING_RUN.steps);

  await expect(page.getByRole('heading', { name: 'You survived' })).toBeVisible();
});

test('shows a visible focus indicator and keeps focus inside dialogs', async ({ page }) => {
  await openTitle(page);
  await tabTo(
    page,
    (info) => info.tag === 'BUTTON' && info.text === 'New run',
    'the New run button',
  );
  const ring = await page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return { outlineWidth: 0, outlineStyle: 'none', boxShadow: 'none' };
    const style = getComputedStyle(element);
    return {
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
    };
  });
  expect(ring.outlineWidth > 0 || ring.outlineStyle !== 'none' || ring.boxShadow !== 'none').toBe(
    true,
  );

  await pressButton(page, 'Rules and help');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let index = 0; index < 6; index += 1) await page.keyboard.press('Tab');
  const insideDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return (
      dialog !== null && document.activeElement !== null && dialog.contains(document.activeElement)
    );
  });
  expect(insideDialog).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rules and help' })).toBeFocused();
});

test('resolves a card and undoes it with the keyboard', async ({ page }) => {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
  await tabTo(page, (info) => info.card !== null, 'the first room card');
  await keyboardReplay(page, scenario.steps.slice(0, 1));
  await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', '20');
  await pressButton(page, 'Undo');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
});
