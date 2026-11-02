import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../src/engine';
import { createTranslator } from '../src/i18n';
import { openRun } from './helpers/game';
import { installMatchMedia } from './helpers/media';

const t = createTranslator('en');
const SEED = 'residual-seed';

function firstCard(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-card]')!;
}

function action(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function resolveFirstCard(): void {
  fireEvent.click(firstCard());
  fireEvent.click(document.querySelector<HTMLElement>('.preview__actions button.button--primary')!);
}

describe('Phase 3 review residuals', () => {
  it('references the visible restriction only from actions that are really disabled', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const enter = action(t('play.enterNextRoom'));
    const runAway = action(t('play.runAway'));
    const undo = action(t('play.undo'));

    expect(enter).toHaveAttribute('aria-disabled', 'true');
    expect(enter).toHaveAttribute('aria-describedby');
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAttribute('aria-describedby');
    expect(runAway).not.toHaveAttribute('aria-disabled');
    expect(runAway).not.toHaveAttribute('aria-describedby');

    const helper = screen.getByTestId('action-reasons');
    expect(helper).toHaveAttribute('id', enter.getAttribute('aria-describedby'));
    expect(helper).toHaveTextContent(
      t('play.disabledAction', {
        action: t('play.enterNextRoom'),
        reason: t('rejection.room-not-cleared'),
      }),
    );

    // After one resolution Undo becomes available: its description goes away.
    resolveFirstCard();
    expect(action(t('play.undo'))).not.toHaveAttribute('aria-disabled');
    expect(action(t('play.undo'))).not.toHaveAttribute('aria-describedby');
    expect(action(t('play.enterNextRoom'))).toHaveAttribute('aria-describedby');
  });

  it('keeps each restriction in its own element for locale-neutral spacing', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const helper = screen.getByTestId('action-reasons');
    const reasons = Array.from(helper.querySelectorAll('.action-bar__reason'));
    expect(reasons.length).toBe(2);
    expect(reasons[0]).toHaveTextContent(t('play.enterNextRoom'));
    expect(reasons[1]).toHaveTextContent(t('play.undo'));
    // Spacing comes from layout (separate elements), not a hardcoded ASCII space.
    expect(helper.textContent).toBe(reasons.map((reason) => reason.textContent).join(''));
  });

  it('marks the compact play surface inert while the preview sheet is open', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const content = document.querySelector<HTMLElement>('.play-screen__content')!;
    expect(content).not.toHaveAttribute('inert');

    fireEvent.click(firstCard());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(content).toHaveAttribute('inert');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(content).not.toHaveAttribute('inert');
  });
});
