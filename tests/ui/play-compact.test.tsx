import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { openRun } from '../helpers/game';
import { installMatchMedia } from '../helpers/media';
const SEED = 'compact-seed';

function firstCard(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-card]')!;
}

describe('play layout is always wide', () => {
  it('keeps the wide preview panel outside a dialog', () => {
    installMatchMedia();
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(firstCard());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.play-main__preview')).not.toBeNull();
  });

  it('keeps the inline preview even when compact media matches', () => {
    installMatchMedia({ compact: true });
    openRun(SEED, DEFAULT_RULE_CONFIG);

    fireEvent.click(firstCard());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.play-main__preview')).not.toBeNull();
    expect(document.querySelector('.preview__title')).not.toBeNull();
    expect(document.querySelector('.play-main__room-actions')).toBeNull();
  });
});
