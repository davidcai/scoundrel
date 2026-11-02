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
  it('offers only Phase 3 controls', () => {
    renderTitle();

    expect(screen.getByRole('button', { name: t('title.newRun') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.rulesHelp') })).toBeInTheDocument();
    // Phase 4 controls are deliberately absent, not dead buttons.
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /statistics|stats/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /enter seed|replay link/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the three house-rule options, unchecked by default', () => {
    renderTitle();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    for (const checkbox of checkboxes) expect(checkbox).not.toBeChecked();
    expect(screen.getByText(t('rule.consecutiveEscapesAllowed'))).toBeInTheDocument();
    expect(screen.getByText(t('rule.unlimitedPotions'))).toBeInTheDocument();
    expect(screen.getByText(t('rule.degradationOff'))).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole('checkbox', { name: new RegExp(t('rule.consecutiveEscapesAllowed')) }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    expect(window.location.hash).toContain('config=1');
  });

  it('switches language from the title screen and remembers it for the run', () => {
    renderTitle();

    fireEvent.click(screen.getByRole('button', { name: t('language.chinese') }));

    const zh = createTranslator('zh-Hans');
    expect(screen.getByRole('button', { name: zh('title.newRun') })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-Hans');

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
