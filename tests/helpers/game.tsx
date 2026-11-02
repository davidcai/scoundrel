import { fireEvent, render, screen } from '@testing-library/react';
import App from '../../src/App';
import {
  DEFAULT_RULE_CONFIG,
  MAX_HEALTH,
  applyAction,
  canResolveAnyCard,
  canWeaponFightMonster,
  cardKind,
  cardValue,
  createInitialState,
  ruleOptions,
  type AttackMode,
  type CardId,
  type GameAction,
  type GameState,
  type RuleConfig,
} from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { playPath } from '../../src/ui/routes';

/** One decision the interface can perform (used to drive UI clicks and engine replay). */
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

/**
 * A reasonable default strategy: drink when wounded, upgrade weapons when
 * possible, prefer eligible weapon attacks, then barehanded from weakest.
 */
export const greedyPolicy: Policy = (state) => {
  if (state.roomCleared || !canResolveAnyCard(state)) return { kind: 'enterNextRoom' };
  const cards = state.room.cards.map((roomCard) => roomCard.card);
  const potions = cards.filter((card) => cardKind(card) === 'potion');
  const potionAllowed = ruleOptions(state.config).unlimitedPotions || !state.potionUsedThisRoom;
  if (potionAllowed && state.health < MAX_HEALTH && potions.length > 0) {
    return { kind: 'resolve', card: potions[0]! };
  }
  const weapons = cards
    .filter((card) => cardKind(card) === 'weapon')
    .sort((left, right) => cardValue(right) - cardValue(left));
  const betterWeapon = weapons.find((card) => cardValue(card) > (state.weapon?.value ?? 0));
  if (betterWeapon !== undefined) return { kind: 'resolve', card: betterWeapon };
  const monsters = cards
    .filter((card) => cardKind(card) === 'monster')
    .sort((left, right) => cardValue(left) - cardValue(right));
  const weaponTarget = monsters.find(
    (monster) => state.weapon !== null && canWeaponFightMonster(state, monster),
  );
  if (weaponTarget !== undefined) {
    return { kind: 'resolve', card: weaponTarget, attack: 'weapon' };
  }
  if (monsters.length > 0) {
    return { kind: 'resolve', card: monsters[0]!, attack: 'barehanded' };
  }
  return { kind: 'resolve', card: cards[0]! };
};

/** Replays a recorded decision list; policies are called once per step. */
export function scriptedPolicy(steps: readonly UiStep[]): Policy {
  let index = 0;
  return () => {
    const step = steps[index];
    if (step === undefined) {
      throw new Error(`Scripted plan exhausted after ${index} steps.`);
    }
    index += 1;
    return step;
  };
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

export function simulate(
  seed: string,
  config: RuleConfig,
  policy: Policy,
  maxSteps = 300,
): GameState {
  let state = createInitialState(seed, config);
  for (let step = 0; step < maxSteps && state.status === 'playing'; step += 1) {
    const result = applyAction(state, toAction(policy(state)));
    if (!result.ok) {
      throw new Error(`Policy step ${step} was rejected: ${result.reason}`);
    }
    state = result.state;
  }
  return state;
}

export function findSeed(outcome: 'won' | 'lost', policy: Policy, maxSeeds = 120): string {
  for (let index = 0; index < maxSeeds; index += 1) {
    const seed = `test-${index}`;
    if (simulate(seed, DEFAULT_RULE_CONFIG, policy).result?.outcome === outcome) {
      return seed;
    }
  }
  throw new Error(`Could not find a ${outcome} seed for the requested policy.`);
}

export interface Scenario {
  readonly seed: string;
  readonly config: RuleConfig;
  readonly steps: readonly UiStep[];
  readonly state: GameState;
}

/** Search seeds until a state matching `predicate` is reached, with its step history. */
export function findScenario(
  predicate: (state: GameState) => boolean,
  policy: Policy = greedyPolicy,
  maxSeeds = 120,
): Scenario {
  for (let index = 0; index < maxSeeds; index += 1) {
    const seed = `scenario-${index}`;
    const config: RuleConfig = DEFAULT_RULE_CONFIG;
    let state = createInitialState(seed, config);
    const steps: UiStep[] = [];
    if (predicate(state)) return { seed, config, steps, state };
    for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
      const next = policy(state);
      const result = applyAction(state, toAction(next));
      if (!result.ok) {
        throw new Error(`Scenario search step ${step} was rejected: ${result.reason}`);
      }
      state = result.state;
      steps.push(next);
      if (predicate(state)) return { seed, config, steps, state };
    }
  }
  throw new Error('Could not find a state matching the requested scenario.');
}

function confirmLabel(step: Extract<UiStep, { kind: 'resolve' }>): string {
  const t = createTranslator('en');
  if (step.attack === 'weapon') return t('action.useWeapon');
  if (step.attack === 'barehanded') return t('action.fightBarehanded');
  switch (cardKind(step.card)) {
    case 'weapon':
      return t('action.equipWeapon');
    case 'potion':
      return t('action.drinkPotion');
    default:
      return t('action.fightBarehanded');
  }
}

/** Render the app at a play route (direct hash-link path). */
export function openRun(seed: string, config: RuleConfig): void {
  window.history.replaceState(null, '', `#${playPath(seed, config)}`);
  render(<App />);
}

/** Perform one engine decision through real interface clicks, then replay it in the engine. */
export function applyStepThroughUi(step: UiStep, state: GameState): GameState {
  const t = createTranslator('en');
  if (step.kind === 'enterNextRoom') {
    fireEvent.click(screen.getByRole('button', { name: t('play.enterNextRoom') }));
  } else if (step.kind === 'runAway') {
    fireEvent.click(screen.getByRole('button', { name: t('play.runAway') }));
  } else {
    const cardButton = document.querySelector<HTMLElement>(`[data-card="${step.card}"]`);
    if (cardButton === null) throw new Error(`Card ${step.card} is not rendered.`);
    fireEvent.click(cardButton);
    fireEvent.click(screen.getByRole('button', { name: confirmLabel(step) }));
  }
  const result = applyAction(state, toAction(step));
  if (!result.ok) throw new Error(`Interface step was rejected: ${result.reason}`);
  return result.state;
}

export function replayScenario(scenario: Scenario): GameState {
  openRun(scenario.seed, scenario.config);
  let state = createInitialState(scenario.seed, scenario.config);
  for (const step of scenario.steps) state = applyStepThroughUi(step, state);
  return state;
}

/** Play a full run through real interface clicks and return the final engine state. */
export function playThroughUi(
  seed: string,
  config: RuleConfig,
  policy: Policy,
  maxSteps = 300,
): GameState {
  openRun(seed, config);
  let state = createInitialState(seed, config);
  for (let step = 0; step < maxSteps && state.status === 'playing'; step += 1) {
    state = applyStepThroughUi(policy(state), state);
  }
  return state;
}
