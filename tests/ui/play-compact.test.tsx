import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { formatPreviewTitle } from '../../src/i18n/messages';
import { openRun } from '../helpers/game';
import { installMatchMedia } from '../helpers/media';

const t = createTranslator('en');
const SEED = 'compact-seed';

function firstCard(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-card]')!;
}

describe('play compact layout', () => {
  it('keeps the wide preview panel outside a dialog', () => {
    installMatchMedia();
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(firstCard());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.play-main__preview')).not.toBeNull();
  });

  it('moves the selected-card preview into a modal sheet on compact widths', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const card = firstCard();
    const cardId = card.dataset.card as Parameters<typeof formatPreviewTitle>[1];
    fireEvent.click(card);

    const dialog = screen.getByRole('dialog', { name: formatPreviewTitle(t, cardId) });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('dialog__panel--sheet');
    expect(document.querySelector('.play-main__preview')).toBeNull();
    expect(dialog.querySelector('.preview')).not.toBeNull();
  });

  it('offers a 44px close control and keeps the sheet above the fixed action bar', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(firstCard());

    const dialog = screen.getByRole('dialog');
    const close = dialog.querySelector('.dialog__close');
    expect(close).not.toBeNull();
    expect(close).toHaveAttribute('aria-label', t('preview.close'));

    const screenStyle = document.querySelector('.play-screen')?.getAttribute('style') ?? '';
    expect(screenStyle).toContain('--action-bar-height');

    fireEvent.click(close!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps metadata rows in the card markup for sub-132px fallback widths', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    const meta = document.querySelectorAll('.card__meta-name');
    expect(meta).toHaveLength(4);
    expect(meta[0]!.textContent?.length).toBeGreaterThan(0);
  });

  it('closes the compact sheet with Escape and restores focus to the card', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);
    const card = firstCard();

    fireEvent.click(card);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(card);
  });
});
