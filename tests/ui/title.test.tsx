import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../src/App';
import { createTranslator } from '../../src/i18n';

const t = createTranslator('en');

function renderTitle(): void {
  window.history.replaceState(null, '', '#/');
  render(<App />);
}

describe('title screen', () => {
  it('offers the Phase 4 entry points and no Continue while nothing is saved', () => {
    renderTitle();

    expect(screen.getByRole('button', { name: t('title.newRun') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.rulesHelp') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.statistics') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.settings') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.enterSeed') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replay link/i })).not.toBeInTheDocument();

    // Nothing is saved yet, so there is nothing to continue or discard.
    expect(screen.queryByRole('button', { name: t('title.continue') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('title.discardRun') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('title.lastResult') })).not.toBeInTheDocument();
  });

  it('moves the three house-rule options into settings, unchecked by default', () => {
    renderTitle();
    fireEvent.click(screen.getByRole('button', { name: t('title.settings') }));

    for (const rule of [
      t('rule.consecutiveEscapesAllowed'),
      t('rule.unlimitedPotions'),
      t('rule.degradationOff'),
    ]) {
      const checkbox = screen.getByRole('checkbox', { name: new RegExp(rule) });
      expect(checkbox).not.toBeChecked();
    }
  });

  it('renders a decorative artwork fan and a real build version', () => {
    renderTitle();

    const fan = document.querySelector('.title-screen__art');
    expect(fan).not.toBeNull();
    expect(fan).toHaveAttribute('aria-hidden', 'true');
    const images = Array.from(fan!.querySelectorAll<HTMLImageElement>('img'));
    expect(images.length).toBeGreaterThan(0);
    expect(images.length).toBeLessThanOrEqual(3);
    for (const image of images) {
      expect(image.getAttribute('alt')).toBe('');
      expect(image.src).toMatch(/\.png$/);
      expect(image.src).not.toContain('assets-old');
    }

    const version = import.meta.env.VITE_APP_VERSION ?? 'dev';
    expect(screen.getByText(t('title.footer', { version }))).toBeInTheDocument();
  });

  it('passes enabled house rules into the new run link', () => {
    renderTitle();
    fireEvent.click(screen.getByRole('button', { name: t('title.settings') }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: new RegExp(t('rule.consecutiveEscapesAllowed')) }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('settings.close') }));
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    expect(window.location.hash).toContain('config=1');
  });

  it('changes language in settings and remembers it for the run', () => {
    renderTitle();
    fireEvent.click(screen.getByRole('button', { name: t('title.settings') }));
    fireEvent.click(screen.getByRole('button', { name: t('language.chinese') }));

    const zh = createTranslator('zh-Hans');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh('settings.title'));
    expect(document.documentElement.lang).toBe('zh-Hans');

    fireEvent.click(screen.getByRole('button', { name: zh('settings.close') }));
    fireEvent.click(screen.getByRole('button', { name: zh('title.newRun') }));
    expect(screen.getAllByText(zh('play.roomHint')).length).toBeGreaterThan(0);
  });

  it('opens help as a modal dialog and restores focus on close', () => {
    renderTitle();
    const trigger = screen.getByRole('button', { name: t('title.rulesHelp') });
    trigger.focus();

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: t('help.title') });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps focus inside the help dialog while tabbing', () => {
    renderTitle();
    fireEvent.click(screen.getByRole('button', { name: t('title.rulesHelp') }));

    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, input'));
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
