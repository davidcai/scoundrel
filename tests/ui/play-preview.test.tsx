import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  canResolveAnyCard,
  canWeaponFightMonster,
  cardKind,
  previewAction,
  previewCardResolution,
  previewMonster,
  type GameState,
} from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { describeCardPreview, formatMonsterMatchupTitle } from '../../src/i18n/messages';
import { findScenario, replayScenario } from '../helpers/game';

const t = createTranslator('en');

function actionDescription(state: GameState, card: string): string {
  const preview = previewCardResolution(state, card as never);
  if (!preview.ok) throw new Error(preview.reason);
  return describeCardPreview(
    t,
    { kind: 'action', event: preview.event },
    { health: state.health, weaponValue: state.weapon?.value ?? null },
  );
}

describe('play preview', () => {
  it('shows planned barehanded damage and applies exactly that damage', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        state.health >= 15 &&
        canResolveAnyCard(state) &&
        state.weapon === null &&
        state.room.cards.some((roomCard) => cardKind(roomCard.card) === 'monster'),
    );
    replayScenario(scenario);
    const state = scenario.state;

    const monster = state.room.cards.find(
      (roomCard) => cardKind(roomCard.card) === 'monster',
    )!.card;
    const preview = previewMonster(state, monster);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    fireEvent.click(document.querySelector<HTMLElement>(`[data-card="${monster}"]`)!);

    // The damage-summary line is intentionally absent; the matchup title and
    // choice labels carry the preview.
    expect(document.querySelector('.preview__description')).toBeNull();
    expect(document.querySelector('.preview__title')?.textContent).toBe(
      formatMonsterMatchupTitle(t, preview.preview, null),
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(state.health),
    );

    const barehanded = screen.getByRole('button', { name: /^Fight barehanded/ });
    expect(barehanded).toHaveTextContent(
      t('action.fightBarehandedWithDamage', { damage: preview.preview.barehanded.damage }),
    );
    fireEvent.click(barehanded);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(preview.preview.barehanded.healthAfter),
    );
  });

  it('disables the weapon choice the degradation chain forbids and explains why', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        canResolveAnyCard(state) &&
        state.weapon !== null &&
        !state.roomCleared &&
        state.room.cards.some(
          (roomCard) =>
            cardKind(roomCard.card) === 'monster' && !canWeaponFightMonster(state, roomCard.card),
        ),
    );
    replayScenario(scenario);
    const state = scenario.state;

    const monster = state.room.cards.find(
      (roomCard) =>
        cardKind(roomCard.card) === 'monster' && !canWeaponFightMonster(state, roomCard.card),
    )!.card;
    const preview = previewMonster(state, monster);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.weapon?.eligible).toBe(false);

    fireEvent.click(document.querySelector<HTMLElement>(`[data-card="${monster}"]`)!);

    const weaponChoice = screen.getByRole('button', { name: t('action.useWeapon') });
    expect(weaponChoice).toHaveAttribute('aria-disabled', 'true');
    expect(weaponChoice).toHaveTextContent(t('action.useWeapon'));
    expect(document.querySelector('.preview__title')?.textContent).toBe(
      formatMonsterMatchupTitle(t, preview.preview, state.weapon?.value ?? null),
    );
    expect(document.querySelector('.preview__description')).toBeNull();

    const cardsBefore = document.querySelectorAll('[data-card]').length;
    fireEvent.click(weaponChoice);
    expect(document.querySelectorAll('[data-card]')).toHaveLength(cardsBefore);
  });

  it('explains that a used potion is wasted and announces the waste on confirmation', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        canResolveAnyCard(state) &&
        state.potionUsedThisRoom &&
        state.room.cards.some((roomCard) => cardKind(roomCard.card) === 'potion'),
    );
    replayScenario(scenario);
    const state = scenario.state;

    const potion = state.room.cards.find((roomCard) => cardKind(roomCard.card) === 'potion')!.card;
    const resolution = previewCardResolution(state, potion);
    expect(resolution.ok).toBe(true);

    fireEvent.click(document.querySelector<HTMLElement>(`[data-card="${potion}"]`)!);

    const description = document.querySelector('.preview__description')?.textContent ?? '';
    expect(description).toBe(actionDescription(state, potion));
    expect(description).toContain(
      state.health >= 20 ? t('preview.potionWastedFull') : t('preview.potionWastedUsed'),
    );

    fireEvent.click(screen.getByRole('button', { name: t('action.drinkPotion') }));

    const wasteText = t('status.potionWasted', {
      health:
        resolution.ok && resolution.event.type === 'cardResolved'
          ? resolution.event.healthAfter
          : state.health,
    });
    expect(screen.getByTestId('live-polite').textContent).toContain(wasteText);
  });

  it('warns that equipping a new weapon discards the current weapon and its kills', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        canResolveAnyCard(state) &&
        state.weapon !== null &&
        !state.roomCleared &&
        state.room.cards.some((roomCard) => cardKind(roomCard.card) === 'weapon'),
    );
    replayScenario(scenario);
    const state = scenario.state;

    const weaponCard = state.room.cards.find(
      (roomCard) => cardKind(roomCard.card) === 'weapon',
    )!.card;

    fireEvent.click(document.querySelector<HTMLElement>(`[data-card="${weaponCard}"]`)!);

    const description = document.querySelector('.preview__description')?.textContent ?? '';
    expect(description).toBe(actionDescription(state, weaponCard));
    expect(description).toContain(String(state.weapon!.value));
  });

  it('previews a monster weapon attack with the same event the action will produce', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        canResolveAnyCard(state) &&
        state.weapon !== null &&
        state.room.cards.some(
          (roomCard) =>
            cardKind(roomCard.card) === 'monster' && canWeaponFightMonster(state, roomCard.card),
        ),
    );
    replayScenario(scenario);
    const state = scenario.state;

    const monster = state.room.cards.find(
      (roomCard) =>
        cardKind(roomCard.card) === 'monster' && canWeaponFightMonster(state, roomCard.card),
    )!.card;
    const preview = previewMonster(state, monster);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    const confirmed = previewCardResolution(state, monster, 'weapon');
    const armed = previewAction(state, { type: 'resolveCard', card: monster, attack: 'weapon' });
    expect(confirmed.ok).toBe(true);
    expect(armed.ok).toBe(true);
    if (!confirmed.ok || !armed.ok) return;
    expect(confirmed.event).toEqual(armed.event);

    const damage = preview.preview.weapon?.damage ?? 0;
    expect(damage).toBeGreaterThanOrEqual(0);

    fireEvent.click(document.querySelector<HTMLElement>(`[data-card="${monster}"]`)!);
    expect(document.querySelector('.preview__title')?.textContent).toBe(
      formatMonsterMatchupTitle(t, preview.preview, state.weapon?.value ?? null),
    );
    const weaponChoice = screen.getByRole('button', { name: /^Use weapon/ });
    expect(weaponChoice).toHaveTextContent(t('action.useWeaponWithDamage', { damage }));
    fireEvent.click(weaponChoice);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(preview.preview.weapon?.healthAfter),
    );
  });
});
