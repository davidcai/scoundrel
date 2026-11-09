import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { createTranslator } from '../src/i18n';
import { createScoundrelStore } from '../src/store';
import { createMemoryStorage } from '../src/store/storage';

const t = createTranslator('en');
const zh = createTranslator('zh-Hans');

function renderAt(hash: string, store: ReturnType<typeof createScoundrelStore>) {
  window.history.replaceState(null, '', hash);
  return render(<App store={store} />);
}

describe('settings screen and persisted preferences', () => {
  it('persists language and reduced motion across reloads', () => {
    const storage = createMemoryStorage();
    const first = createScoundrelStore({ storage });
    const view = renderAt('#/settings', first);

    const heading = screen.getByRole('heading', { level: 1, name: t('settings.title') });
    expect(heading).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: t('language.chinese') }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh('settings.title'));
    expect(document.documentElement.lang).toBe('zh-Hans');

    const motion = screen.getByRole('checkbox', { name: zh('settings.reduceMotion') });
    fireEvent.click(motion);
    expect(motion).toBeChecked();
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(first.getSnapshot().settings).toMatchObject({ locale: 'zh-Hans', reducedMotion: true });
    view.unmount();

    const second = createScoundrelStore({ storage });
    renderAt('#/settings', second);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh('settings.title'));
    expect(screen.getByRole('checkbox', { name: zh('settings.reduceMotion') })).toBeChecked();
    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(document.documentElement.dataset.motion).toBe('reduced');
  });

  it('keeps the language toggle pressed state honest', () => {
    const storage = createMemoryStorage();
    const store = createScoundrelStore({ storage });
    renderAt('#/settings', store);

    const english = screen.getByRole('button', { name: t('language.english') });
    const chinese = screen.getByRole('button', { name: t('language.chinese') });
    expect(english).toHaveAttribute('aria-pressed', 'true');
    expect(chinese).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(chinese);
    expect(screen.getByRole('button', { name: zh('language.chinese') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers Auto and follows the browser language preference', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => ['zh-CN', 'en'],
    });
    try {
      const storage = createMemoryStorage();
      const store = createScoundrelStore({ storage });
      const view = renderAt('#/settings', store);

      const auto = screen.getByRole('button', { name: t('language.auto') });
      expect(auto).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: t('language.english') })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      fireEvent.click(auto);
      expect(store.getSnapshot().settings.locale).toBe('auto');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh('settings.title'));
      expect(screen.getByRole('button', { name: zh('language.auto') })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: zh('language.english') })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(document.documentElement.lang).toBe('zh-Hans');
      view.unmount();

      const reloaded = createScoundrelStore({ storage });
      renderAt('#/settings', reloaded);
      expect(reloaded.getSnapshot().settings.locale).toBe('auto');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zh('settings.title'));
    } finally {
      if (original !== undefined) Object.defineProperty(window.navigator, 'languages', original);
    }
  });

  it('turns reduced motion back to full when the preference is cleared', () => {
    const storage = createMemoryStorage();
    const store = createScoundrelStore({ storage });
    renderAt('#/settings', store);

    const motion = screen.getByRole('checkbox', { name: t('settings.reduceMotion') });
    fireEvent.click(motion);
    expect(document.documentElement.dataset.motion).toBe('reduced');
    fireEvent.click(motion);
    expect(motion).not.toBeChecked();
    expect(document.documentElement.dataset.motion).toBe('full');
    expect(store.getSnapshot().settings.reducedMotion).toBe(false);
  });

  it('closes settings back to the title', () => {
    const storage = createMemoryStorage();
    const store = createScoundrelStore({ storage });
    renderAt('#/settings', store);
    fireEvent.click(screen.getByRole('button', { name: t('settings.close') }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title'));
    expect(window.location.hash).toBe('#/');
  });
});
