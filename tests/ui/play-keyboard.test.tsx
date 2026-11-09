import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { findScenario, openRun, replayScenario } from '../helpers/game';
import { installMatchMedia } from '../helpers/media';

const t = createTranslator('en');
const SEED = 'keyboard-seed';

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
}

describe('play keyboard', () => {
  it('uses one tab stop with arrow keys inside the room grid', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const roomCards = cards();
    expect(roomCards).toHaveLength(4);
    expect(roomCards[0]).toHaveAttribute('tabindex', '0');
    expect(roomCards[1]).toHaveAttribute('tabindex', '-1');

    roomCards[0]!.focus();
    fireEvent.keyDown(roomCards[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(roomCards[1]);
    expect(roomCards[1]).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(roomCards[1]!, { key: 'End' });
    expect(document.activeElement).toBe(roomCards[3]);

    fireEvent.keyDown(roomCards[3]!, { key: 'Home' });
    expect(document.activeElement).toBe(roomCards[0]);

    fireEvent.keyDown(roomCards[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(roomCards[3]);
  });

  it('moves focus to the first card from the skip link', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(screen.getByRole('link', { name: t('app.skipLink') }));

    expect(document.activeElement).toBe(cards()[0]);
  });

  it('keeps cards as native buttons so Enter and Space activate them', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    for (const card of cards()) expect(card.tagName).toBe('BUTTON');
  });

  it('focuses the first room card after resolving a card', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);
    const firstCard = cards()[0]!;
    const cardId = firstCard.dataset.card as string;

    fireEvent.click(firstCard);
    // Clicking the selected card again clears it (no preview Cancel button).
    fireEvent.click(firstCard);
    fireEvent.click(firstCard);
    const confirm = document.querySelector<HTMLElement>('.preview__actions button.button--primary');
    expect(confirm).not.toBeNull();
    fireEvent.click(confirm!);

    // Selection was cleared; the remaining room keeps one tab stop.
    const remaining = cards();
    expect(remaining.length).toBeLessThan(4);
    expect(document.activeElement).toBe(remaining[0]);
    expect(remaining[0]!.dataset.card).not.toBe(cardId);
  });

  it('moves focus to the enabled Enter next room when the room clears', () => {
    const scenario = findScenario((state) => state.status === 'playing' && state.roomCleared);
    replayScenario(scenario);

    const enter = screen.getByRole('button', { name: t('play.enterNextRoom') });
    expect(enter).not.toHaveAttribute('aria-disabled');
    expect(document.activeElement).toBe(enter);
  });

  it('restores the selection and its focus after undo', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);
    const firstCard = cards()[0]!;
    const cardId = firstCard.dataset.card;

    fireEvent.click(firstCard);
    fireEvent.click(
      document.querySelector<HTMLElement>('.preview__actions button.button--primary')!,
    );

    const undo = screen.getByRole('button', { name: t('play.undo') });
    expect(undo).not.toHaveAttribute('aria-disabled');
    fireEvent.click(undo);

    const restored = document.querySelector<HTMLElement>(`[data-card="${cardId}"]`);
    expect(restored).not.toBeNull();
    expect(restored).toHaveAttribute('aria-pressed', 'true');
    expect(document.activeElement).toBe(restored);
  });

  it('focuses the first card after a deal even when compact media matches', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    expect(document.activeElement).toBe(cards()[0]);
  });
});
