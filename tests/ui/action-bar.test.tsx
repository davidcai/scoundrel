import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { openRun } from '../helpers/game';
import { installMatchMedia } from '../helpers/media';

const t = createTranslator('en');
const zh = createTranslator('zh-Hans');
const SEED = 'action-bar-seed';

function resolveFirstCard(): void {
  fireEvent.click(document.querySelector<HTMLElement>('[data-card]')!);
  fireEvent.click(document.querySelector<HTMLElement>('.preview__actions button.button--primary')!);
}

describe('room actions hide unavailable controls', () => {
  it('shows Enter next room and Undo only while they are available', () => {
    installMatchMedia();
    openRun(SEED, DEFAULT_RULE_CONFIG);

    expect(screen.queryByRole('button', { name: t('play.enterNextRoom') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('play.undo') })).toBeNull();
    const runAway = screen.getByRole('button', { name: t('play.runAway') });
    expect(runAway).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByTestId('action-reasons')).toBeNull();

    resolveFirstCard();
    expect(screen.getByRole('button', { name: t('play.undo') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('play.enterNextRoom') })).toBeNull();
  });

  it('never hides the restriction line in the stylesheet', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8');
    for (const rule of css.matchAll(/\.action-bar__(?:reason|helper)\s*\{[^}]*\}/g)) {
      expect(rule[0]).not.toMatch(/display:\s*none/);
    }
  });

  it('applies the same hidden-action rule in Chinese', () => {
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      get: () => ['zh-CN'],
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      get: () => 'zh-CN',
    });
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    expect(screen.queryByRole('button', { name: zh('play.enterNextRoom') })).toBeNull();
    expect(screen.queryByRole('button', { name: zh('play.undo') })).toBeNull();
    expect(screen.getByRole('button', { name: zh('play.runAway') })).toBeInTheDocument();
  });
});
