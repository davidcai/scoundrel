import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { MESSAGES, cardLabel, cardAriaLabel, translate, useLanguage } from '../src/i18n';
import { loadLanguage, loadSettings } from '../src/store/settings';

afterEach(() => {
  localStorage.clear();
  act(() => useLanguage.getState().setLang('en'));
});

describe('translate', () => {
  it('interpolates params', () => {
    expect(translate('en', 'scoreOf', { score: 14 })).toBe('Score 14');
    expect(translate('zh', 'scoreOf', { score: 14 })).toBe('得分 14');
  });

  it('covers every message key in both languages', () => {
    const enKeys = Object.keys(MESSAGES.en);
    expect(enKeys.length).toBeGreaterThan(100);
    for (const key of enKeys) {
      expect(MESSAGES.zh[key as keyof typeof MESSAGES.en]).toBeTruthy();
    }
  });
});

describe('localized card labels', () => {
  it('labels cards in English when English is selected', () => {
    act(() => useLanguage.setState({ lang: 'en', setting: 'en' }));
    expect(cardLabel('club-8')).toBe('8 of Clubs');
    expect(cardAriaLabel('diamond-5')).toBe('5 of Diamonds, weapon, value 5');
  });

  it('labels cards in Chinese when selected', () => {
    act(() => useLanguage.setState({ lang: 'zh', setting: 'zh' }));
    expect(cardLabel('club-8')).toBe('梅花8');
    expect(cardLabel('heart-10')).toBe('红心10');
    expect(cardLabel('spade-a')).toBe('黑桃A');
    expect(cardAriaLabel('heart-4')).toBe('红心4，药水，数值4');
  });
});

describe('language switcher', () => {
  it('renders the Chinese UI and persists the choice', async () => {
    // Start from a clean slate with Chinese selected (setLang also re-syncs
    // <html lang>, which afterEach may have left as 'en').
    localStorage.clear();
    act(() => useLanguage.getState().setLang('zh'));

    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('button', { name: '新开一局' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(loadSettings().language).toBe('zh');

    // Switching to English persists and re-renders.
    act(() => useLanguage.getState().setLang('en'));
    expect(document.documentElement.lang).toBe('en');
    expect(loadSettings().language).toBe('en');
    expect(screen.getByRole('button', { name: 'New run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('detects the browser language on first visit', () => {
    localStorage.clear();
    // Fresh visits store 'auto'; jsdom reports en-US, so it renders English.
    expect(loadSettings().language).toBe('auto');
    expect(loadLanguage()).toBe('en');
  });
});
