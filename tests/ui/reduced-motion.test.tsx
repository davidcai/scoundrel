import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { createTranslator } from '../../src/i18n';
import { installMatchMedia } from '../helpers/media';

const t = createTranslator('en');

function renderTitle(): void {
  window.history.replaceState(null, '', '#/');
  render(<App />);
}

describe('reduced motion', () => {
  it('defaults to full motion', () => {
    installMatchMedia();
    renderTitle();

    expect(document.documentElement.dataset.motion).toBe('full');
  });

  it('follows the system reduced-motion preference', () => {
    installMatchMedia({ reducedMotion: true });
    renderTitle();

    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('lets the preferences dialog override the system preference', () => {
    installMatchMedia();
    renderTitle();

    fireEvent.click(screen.getByRole('button', { name: t('title.rulesHelp') }));
    const reduceMotion = screen.getByRole('checkbox', { name: t('help.reduceMotion') });
    expect(reduceMotion).not.toBeChecked();

    fireEvent.click(reduceMotion);
    expect(document.documentElement.dataset.motion).toBe('reduced');

    fireEvent.click(reduceMotion);
    expect(document.documentElement.dataset.motion).toBe('full');
  });

  it('lets the player opt into reduced motion from the dialog', () => {
    installMatchMedia({ reducedMotion: true });
    renderTitle();

    expect(document.documentElement.dataset.motion).toBe('reduced');

    fireEvent.click(screen.getByRole('button', { name: t('title.rulesHelp') }));
    const reduceMotion = screen.getByRole('checkbox', { name: t('help.reduceMotion') });
    expect(reduceMotion).toBeChecked();

    fireEvent.click(reduceMotion);
    expect(document.documentElement.dataset.motion).toBe('full');
  });
});
