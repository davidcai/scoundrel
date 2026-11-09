import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { createTranslator } from '../../src/i18n';

const en = createTranslator('en');
const zh = createTranslator('zh-Hans');

function setBrowserLanguages(languages: string[]): void {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    get: () => languages,
  });
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    get: () => languages[0] ?? 'en-US',
  });
}

function renderAt(path = '#/'): void {
  window.history.replaceState(null, '', path);
  render(<App />);
}

afterEach(() => setBrowserLanguages(['en-US']));

describe('language', () => {
  it('auto-detects Simplified Chinese browsers', () => {
    setBrowserLanguages(['zh-CN', 'en-US']);
    renderAt();

    expect(screen.getByRole('button', { name: zh('title.newRun') })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-Hans');
  });

  it('falls back to English for an unsupported browser language', () => {
    setBrowserLanguages(['fr-FR']);
    renderAt();

    expect(screen.getByRole('button', { name: en('title.newRun') })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('carries a language set in settings into the run', () => {
    setBrowserLanguages(['en-US']);
    renderAt();

    fireEvent.click(screen.getByRole('button', { name: en('title.settings') }));
    fireEvent.click(screen.getByRole('button', { name: en('language.chinese') }));
    expect(document.documentElement.lang).toBe('zh-Hans');
    fireEvent.click(screen.getByRole('button', { name: zh('settings.close') }));
    fireEvent.click(screen.getByRole('button', { name: zh('title.newRun') }));

    expect(document.querySelector('.room-hint__full')?.textContent).toBe(zh('play.roomHint'));
    expect(
      screen.getByRole('heading', { level: 1, name: zh('play.roomNumber', { number: 1 }) }),
    ).toBeInTheDocument();
  });
});
