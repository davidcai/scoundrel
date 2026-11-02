import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { doomedPolicy, findSeed, openRun } from '../helpers/game';

const t = createTranslator('en');

/**
 * Regressions for the strict axe gate (aria-prohibited-attr and
 * label-content-name-mismatch) that qa runs against the built app.
 */
describe('axe regressions', () => {
  it('exposes the live regions with status and alert roles', () => {
    openRun(findSeed('lost', doomedPolicy), DEFAULT_RULE_CONFIG);

    const polite = screen.getByTestId('live-polite');
    expect(polite).toHaveAttribute('role', 'status');
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(polite).toHaveAttribute('aria-atomic', 'true');

    const assertive = screen.getByTestId('live-assertive');
    expect(assertive).toHaveAttribute('role', 'alert');
    expect(assertive).toHaveAttribute('aria-live', 'assertive');
    expect(assertive).toHaveAttribute('aria-atomic', 'true');
  });

  it('does not label generic div elements without a role', () => {
    openRun(findSeed('lost', doomedPolicy), DEFAULT_RULE_CONFIG);
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-card]')!);

    const offenders = Array.from(document.querySelectorAll('div[aria-label]'))
      .filter((element) => !element.hasAttribute('role'))
      .map((element) => element.className);
    expect(offenders).toEqual([]);
  });

  it('names the dungeon count chip through a valid role', () => {
    openRun(findSeed('lost', doomedPolicy), DEFAULT_RULE_CONFIG);

    const chip = document.querySelector<HTMLElement>('.dungeon-chip');
    expect(chip).not.toBeNull();
    expect(chip).toHaveAttribute('role', 'img');
    expect(chip?.getAttribute('aria-label')).toBe(t('a11y.dungeonCount', { count: 40 }));
  });

  it('starts a card accessible name with its visible caption (WCAG 2.5.3)', () => {
    openRun(findSeed('lost', doomedPolicy), DEFAULT_RULE_CONFIG);

    const firstCard = document.querySelector<HTMLButtonElement>('[data-card]')!;
    fireEvent.click(firstCard);
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');

    const caption = within(firstCard).getByText(/Card \d of 4/).textContent ?? '';
    const label = firstCard.getAttribute('aria-label') ?? '';
    expect(caption.length).toBeGreaterThan(0);
    expect(label.startsWith(caption)).toBe(true);
    expect(label).toContain(t('card.state.selected'));
  });
});
