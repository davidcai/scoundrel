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

function disabledButton(name: string): HTMLElement {
  const button = screen.getByRole('button', { name });
  expect(button).toHaveAttribute('aria-disabled', 'true');
  return button;
}

function describedReason(button: HTMLElement): string {
  const id = button.getAttribute('aria-describedby');
  expect(id).toBeTruthy();
  const helper = document.getElementById(id ?? '');
  expect(helper).not.toBeNull();
  expect(helper).toHaveClass('action-bar__helper');
  expect(helper).not.toHaveAttribute('aria-hidden', 'true');
  return helper?.textContent ?? '';
}

describe('disabled room actions explain their restriction', () => {
  it('links every disabled action to a visible reason on wide screens', () => {
    installMatchMedia();
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const enter = disabledButton(t('play.enterNextRoom'));
    const undo = disabledButton(t('play.undo'));

    expect(describedReason(enter)).toContain(
      t('play.disabledAction', {
        action: t('play.enterNextRoom'),
        reason: t('rejection.room-not-cleared'),
      }),
    );
    expect(describedReason(undo)).toContain(
      t('play.disabledAction', {
        action: t('play.undo'),
        reason: t('rejection.undo-unavailable'),
      }),
    );
    // Run away is available at the start of a room.
    expect(screen.getByRole('button', { name: t('play.runAway') })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('keeps the reason line visible at compact widths (MAJOR-1 regression)', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const enter = disabledButton(t('play.enterNextRoom'));
    const reason = describedReason(enter);
    expect(reason).toContain(t('rejection.room-not-cleared'));

    const helper = screen.getByTestId('action-reasons');
    expect(helper.id).toBe(enter.getAttribute('aria-describedby'));

    // Regression guard: no stylesheet rule may hide the reason line again.
    const css = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8');
    for (const rule of css.matchAll(/\.action-bar__(?:reason|helper)\s*\{[^}]*\}/g)) {
      expect(rule[0]).not.toMatch(/display:\s*none/);
    }
  });

  it('describes disabled actions in Chinese at compact width', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(screen.getAllByRole('button', { name: t('play.help') }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: zh('language.chinese') }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    const enter = disabledButton(zh('play.enterNextRoom'));
    const reason = describedReason(enter);
    expect(reason).toContain(
      zh('play.disabledAction', {
        action: zh('play.enterNextRoom'),
        reason: zh('rejection.room-not-cleared'),
      }),
    );
    expect(reason).toContain(zh('rejection.undo-unavailable'));
  });
});
