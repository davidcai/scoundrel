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

function resolveFirstCard(): void {
  fireEvent.click(firstCard());
  fireEvent.click(document.querySelector<HTMLElement>('.preview__actions button.button--primary')!);
}

describe('Phase 3 review residuals', () => {
  it('renders only available room actions', () => {
    openRun(SEED, DEFAULT_RULE_CONFIG);

    expect(screen.queryByRole('button', { name: t('play.enterNextRoom') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('play.undo') })).toBeNull();
    expect(screen.getByRole('button', { name: t('play.runAway') })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.queryByTestId('action-reasons')).toBeNull();

    // After one resolution Undo becomes available while Enter next room stays
    // hidden; Run away is now restricted, so its reason line is the only one.
    resolveFirstCard();
    expect(screen.getByRole('button', { name: t('play.undo') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('play.enterNextRoom') })).toBeNull();
    const helper = screen.getByTestId('action-reasons');
    expect(helper).toHaveTextContent(t('play.runAway'));
    expect(helper).toHaveTextContent(t('rejection.escape-after-resolution'));
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
