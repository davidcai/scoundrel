import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  canWeaponFightMonster,
  cardKind,
  type CardId,
} from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { formatCardName } from '../../src/i18n/messages';
import { findScenario, openRun, replayScenario } from '../helpers/game';

const t = createTranslator('en');
const SEED = 'a11y-seed';

function kindKey(cardId: CardId): string {
  const kind = cardKind(cardId);
  return kind === 'monster'
    ? t('card.kind.monster')
    : kind === 'weapon'
      ? t('card.kind.weapon')
      : t('card.kind.potion');
}

describe('play accessibility', () => {
  it('exposes card identity, kind, and position in the accessible name', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const roomCards = screen.getByRole('group', { name: t('a11y.roomCards') });
    const all = Array.from(roomCards.querySelectorAll<HTMLElement>('[data-card]'));
    expect(all).toHaveLength(4);

    all.forEach((card, index) => {
      const cardId = card.dataset.card as CardId;
      const label = card.getAttribute('aria-label') ?? '';
      expect(label).toContain(formatCardName(t, cardId));
      expect(label).toContain(kindKey(cardId));
      expect(label).toContain(t('card.captionIndex', { index: index + 1, total: 4 }));
      expect(card).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('renders one polite and one assertive live region', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    expect(screen.getByTestId('live-polite')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('live-assertive')).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces a selection without resolving it', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);
    const firstCard = document.querySelector<HTMLElement>('[data-card]')!;
    const cardId = firstCard.dataset.card as CardId;
    const health = screen.getByRole('progressbar').getAttribute('aria-valuenow');

    fireEvent.click(firstCard);

    expect(screen.getByTestId('live-polite').textContent).toContain(formatCardName(t, cardId));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(health);
    expect(document.querySelectorAll('[data-card]')).toHaveLength(4);
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports an invalid card selection assertively with the engine reason', () => {
    const scenario = findScenario(
      (state) => state.status === 'playing' && state.roomCleared && state.room.cards.length > 0,
    );
    replayScenario(scenario);

    const blockedCards = Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
    const blocked = blockedCards[0]!;
    expect(blocked).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(blocked);

    expect(screen.getByTestId('live-assertive').textContent).toContain(
      t('rejection.card-not-resolvable'),
    );
    expect(document.querySelectorAll('[data-card]')).toHaveLength(blockedCards.length);
  });

  it('names the health progressbar with the approved visible label', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAccessibleName(t('play.health', { health: 20, max: 20 }));
    expect(screen.getAllByText(t('play.health', { health: 20, max: 20 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(t('play.potionAvailable'))).toBeInTheDocument();
  });

  it('shows the plain weapon-usable status in an eligible monster preview', () => {
    const scenario = findScenario(
      (state) =>
        state.status === 'playing' &&
        state.weapon !== null &&
        state.room.cards.some(
          (roomCard) =>
            cardKind(roomCard.card) === 'monster' && canWeaponFightMonster(state, roomCard.card),
        ),
    );
    replayScenario(scenario);

    const eligible = scenario.state.room.cards.find(
      (roomCard) =>
        cardKind(roomCard.card) === 'monster' &&
        canWeaponFightMonster(scenario.state, roomCard.card),
    )!.card;
    const monster = document.querySelector<HTMLElement>(`[data-card="${eligible}"]`);
    expect(monster).not.toBeNull();
    fireEvent.click(monster!);

    expect(screen.getAllByText(t('preview.weaponUsable')).length).toBeGreaterThan(0);
  });

  it('describes health with a progressbar value text', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '20');
    expect(bar).toHaveAttribute('aria-valuetext', t('a11y.healthBar', { health: 20, max: 20 }));
  });

  it('shows a persistent status line with the last outcome', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);
    const status = screen.getByTestId('status-line');
    expect(status).toHaveTextContent(t('play.roomHint'));

    const firstCard = document.querySelector<HTMLElement>('[data-card]')!;
    fireEvent.click(firstCard);
    const confirm = document.querySelector<HTMLElement>('.preview__actions button.button--primary');
    fireEvent.click(confirm!);

    expect(screen.getByTestId('status-line').textContent?.length).toBeGreaterThan(0);
    expect(screen.getByTestId('status-line').textContent).not.toBe(t('play.roomHint'));
  });
});
