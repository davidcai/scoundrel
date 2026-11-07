import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import {
  DEFAULT_RULE_CONFIG,
  applyAction,
  canResolveAnyCard,
  cardKind,
  cardValue,
  createInitialState,
  isMonster,
  type AttackMode,
  type CardId,
  type GameAction,
  type GameState,
  type RuleConfig,
} from '../../src/engine';

/** One decision the interface can perform, mirroring the unit-test helper type. */
export type UiStep =
  | { readonly kind: 'resolve'; readonly card: CardId; readonly attack?: AttackMode }
  | { readonly kind: 'enterNextRoom' }
  | { readonly kind: 'runAway' };

export type Policy = (state: GameState) => UiStep;

export function toAction(step: UiStep): GameAction {
  switch (step.kind) {
    case 'resolve':
      return {
        type: 'resolveCard',
        card: step.card,
        ...(step.attack === undefined ? {} : { attack: step.attack }),
      };
    case 'enterNextRoom':
      return { type: 'enterNextRoom' };
    case 'runAway':
      return { type: 'runAway' };
  }
}

/** A losing strategy: always fight barehanded and never drink on purpose. */
export const doomedPolicy: Policy = (state) => {
  if (state.roomCleared || !canResolveAnyCard(state)) return { kind: 'enterNextRoom' };
  const cards = state.room.cards.map((roomCard) => roomCard.card);
  const monsters = cards
    .filter((card) => cardKind(card) === 'monster')
    .sort((left, right) => cardValue(left) - cardValue(right));
  if (monsters.length > 0) {
    return { kind: 'resolve', card: monsters[0]!, attack: 'barehanded' };
  }
  return { kind: 'resolve', card: cards[0]! };
};

export interface Simulation {
  readonly seed: string;
  readonly state: GameState;
  readonly steps: readonly UiStep[];
}

/** Replays a policy in the engine and records the produced steps. */
export function simulate(
  seed: string,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
  policy: Policy = doomedPolicy,
  maxSteps = 300,
): Simulation {
  let state = createInitialState(seed, config);
  const steps: UiStep[] = [];
  for (let step = 0; step < maxSteps && state.status === 'playing'; step += 1) {
    const next = policy(state);
    const result = applyAction(state, toAction(next));
    if (!result.ok) {
      throw new Error(`Policy step ${step} was rejected: ${result.reason}`);
    }
    steps.push(next);
    state = result.state;
  }
  return { seed, state, steps };
}

/** Replays an explicit decision list in the engine (used to validate fixtures). */
export function simulateSteps(
  seed: string,
  config: RuleConfig,
  steps: readonly UiStep[],
): Simulation {
  let state = createInitialState(seed, config);
  for (const [index, step] of steps.entries()) {
    const result = applyAction(state, toAction(step));
    if (!result.ok) {
      throw new Error(`Fixture step ${index} was rejected: ${result.reason}`);
    }
    state = result.state;
  }
  return { seed, state, steps };
}

/** Finds the first doomed-policy seed that loses under the default rules. */
export function findLostScenario(maxSeeds = 120): Simulation {
  for (let index = 0; index < maxSeeds; index += 1) {
    const simulation = simulate(`test-${index}`);
    if (simulation.state.result?.outcome === 'lost') return simulation;
  }
  throw new Error(`Could not find a lost run within ${maxSeeds} seeds.`);
}

export function requiredResult(state: GameState) {
  const result = state.result;
  if (result === null) throw new Error('The run has not finished yet.');
  return result;
}

/** Confirm-button matcher; monster attacks include the projected damage in the label. */
export function confirmLabel(step: Extract<UiStep, { kind: 'resolve' }>): string | RegExp {
  if (step.attack === 'weapon') return /^Use weapon/;
  if (step.attack === 'barehanded') return /^Fight barehanded/;
  switch (cardKind(step.card)) {
    case 'weapon':
      return 'Equip weapon';
    case 'potion':
      return 'Drink potion';
    default:
      return /^Fight barehanded/;
  }
}

/** Performs one decision through the real interface. */
export async function performStep(page: Page, step: UiStep): Promise<void> {
  if (step.kind === 'enterNextRoom') {
    await page.getByRole('button', { name: 'Enter next room' }).click();
    return;
  }
  if (step.kind === 'runAway') {
    await page.getByRole('button', { name: 'Run away' }).click();
    return;
  }
  await page.locator(`[data-card="${step.card}"]`).click();
  await page.getByRole('button', { name: confirmLabel(step) }).click();
}

export async function replaySteps(page: Page, steps: readonly UiStep[]): Promise<void> {
  for (const step of steps) await performStep(page, step);
}

export async function openTitle(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();
}

export async function startSeededRun(
  page: Page,
  seed: string,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
): Promise<void> {
  await openTitle(page);
  await page.getByRole('button', { name: 'Enter seed' }).click();
  await page.getByLabel('Seed', { exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Start with this seed' }).click();
  await expect(page).toHaveURL(
    new RegExp(`#/play\\?seed=${escapeRegExp(encodeURIComponent(seed))}&config=${config}$`),
  );
  await expect(page.getByRole('button', { name: 'Enter next room' })).toBeVisible();
}

export async function startSharedLink(page: Page, link: string): Promise<void> {
  await openTitle(page);
  await page.getByRole('button', { name: 'Replay link' }).click();
  await page.getByLabel('Replay link or seed URL', { exact: true }).fill(link);
  await page.getByRole('button', { name: 'Start from link' }).click();
}

export interface LossRun extends Simulation {
  readonly result: {
    readonly outcome: string;
    readonly score: number;
    readonly health: number;
    readonly remainingMonsters: number;
  };
}

/** Plays a complete losing run through the interface and returns its expected result. */
export async function playLossRun(page: Page): Promise<LossRun> {
  const scenario = findLostScenario();
  await startSeededRun(page, scenario.seed);
  await replaySteps(page, scenario.steps);
  await expect(page.getByRole('heading', { name: 'You fell' })).toBeVisible();
  const result = requiredResult(scenario.state);
  return {
    ...scenario,
    result: {
      outcome: result.outcome,
      score: result.score,
      health: result.health,
      remainingMonsters: scenario.state.dungeon.filter((card) => isMonster(card)).length,
    },
  };
}

const PARAGRAPH_RESULT_LABELS = new Set(['Outcome', 'Score']);

/**
 * Asserts a result value shown as a "Label value" paragraph, a result-breakdown
 * table row (label in a row header, value in the following cell), or a
 * description row in the seed/rules metadata list.
 */
export async function expectResultValue(page: Page, label: string, value: string): Promise<void> {
  if (PARAGRAPH_RESULT_LABELS.has(label)) {
    const row = page.locator('p', { hasText: new RegExp(`^${escapeRegExp(label)}`) }).first();
    await expect(row).toContainText(value);
    return;
  }
  const tableHeader = page.locator('th', { hasText: label }).first();
  if ((await tableHeader.count()) > 0) {
    await expect(tableHeader.locator('xpath=following-sibling::td')).toHaveText(value);
    return;
  }
  const definition = page
    .locator('dt', { hasText: label })
    .locator('xpath=following-sibling::dd')
    .first();
  await expect(definition).toHaveText(value);
}

export function statsDetail(page: Page, label: string) {
  return page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd').first();
}

export async function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
}

export async function writeStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ storageKey, storageValue }) => {
      window.localStorage.setItem(storageKey, storageValue);
    },
    { storageKey: key, storageValue: value },
  );
}

export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.clear());
}

/** Makes browser storage unusable so the app must fall back to session-only mode. */
export async function installUnavailableStorage(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is unavailable', 'SecurityError');
      },
    });
  });
}

export function projectLane(testInfo: TestInfo): string {
  return String((testInfo.project.metadata as { lane?: unknown }).lane ?? '');
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
