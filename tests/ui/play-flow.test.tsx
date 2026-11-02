import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_CONFIG } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { WINNING_RUN } from '../fixtures/winning-run';
import { doomedPolicy, findSeed, playThroughUi, scriptedPolicy } from '../helpers/game';

const t = createTranslator('en');

describe('play flow', () => {
  it('wins a seeded run through real interface actions', () => {
    const { seed, steps } = WINNING_RUN;
    const final = playThroughUi(seed, DEFAULT_RULE_CONFIG, scriptedPolicy(steps));

    expect(final.status).toBe('won');
    expect(final.result?.outcome).toBe('won');
    expect(
      screen.getByRole('heading', { level: 1, name: t('result.wonTitle') }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('result.scoreLabel'))).toBeInTheDocument();
    expect(screen.getByText(seed)).toBeInTheDocument();
  }, 60_000);

  it('loses a seeded run through real interface actions', () => {
    const seed = findSeed('lost', doomedPolicy);
    const final = playThroughUi(seed, DEFAULT_RULE_CONFIG, doomedPolicy);

    expect(final.status).toBe('lost');
    expect(final.result?.outcome).toBe('lost');
    expect(
      screen.getByRole('heading', { level: 1, name: t('result.lostTitle') }),
    ).toBeInTheDocument();
    // §6 removed the duplicate "Outcome" row: the outcome lives in the heading
    // and its icon, and the breakdown is a table.
    expect(screen.queryByText(t('result.outcomeLost'))).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: t('result.highlightsTitle') })).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: t('result.remainingMonsters') }),
    ).toBeInTheDocument();
  }, 60_000);

  it('starts another run from the result screen', () => {
    const seed = findSeed('lost', doomedPolicy);
    playThroughUi(seed, DEFAULT_RULE_CONFIG, doomedPolicy);

    fireEvent.click(screen.getByRole('button', { name: t('result.newRun') }));

    expect(
      screen.getByRole('heading', { level: 1, name: t('play.roomNumber', { number: 1 }) }),
    ).toBeInTheDocument();
    expect(window.location.hash.startsWith('#/play?seed=')).toBe(true);
    expect(screen.queryByRole('heading', { name: t('result.lostTitle') })).not.toBeInTheDocument();
  }, 60_000);

  it('returns to the title screen from the result screen', () => {
    const seed = findSeed('lost', doomedPolicy);
    playThroughUi(seed, DEFAULT_RULE_CONFIG, doomedPolicy);

    fireEvent.click(screen.getByRole('button', { name: t('result.backToTitle') }));

    expect(screen.getByRole('heading', { level: 1, name: t('app.title') })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  }, 60_000);
});
