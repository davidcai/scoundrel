import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { MESSAGES, cardLabel, cardAriaLabel, translate, useLanguage } from '../src/i18n';
import { loadSettings } from '../src/store/settings';

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
  it('labels cards in English by default', () => {
    act(() => useLanguage.setState({ lang: 'en' }));
    expect(cardLabel('club-8')).toBe('8 of Clubs');
    expect(cardAriaLabel('diamond-5')).toBe('5 of Diamonds, weapon, value 5');
  });

  it('labels cards in Chinese when selected', () => {
    act(() => useLanguage.setState({ lang: 'zh' }));
    expect(cardLabel('club-8')).toBe('梅花8');
    expect(cardLabel('heart-10')).toBe('红心10');
    expect(cardLabel('spade-a')).toBe('黑桃A');
    expect(cardAriaLabel('heart-4')).toBe('红心4，药水，数值4');
  });
});

describe('language switcher', () => {
  it('renders the Chinese UI and persists the choice', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('button', { name: 'New run' })).toBeInTheDocument();

    // Switch language from the settings screen.
    act(() => useLanguage.getState().setLang('zh'));
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(loadSettings().language).toBe('zh');

    // Title screen re-renders in Chinese.
    expect(screen.getByRole('button', { name: '新开一局' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '统计' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByLabelText('语言 Language')).toBeInTheDocument();
  });

  it('auto-detects Chinese browsers only when nothing is stored', () => {
    localStorage.clear();
    // navigator.language is en-US in jsdom, so the default is English.
    expect(loadSettings().language).toBe('en');
  });
});
