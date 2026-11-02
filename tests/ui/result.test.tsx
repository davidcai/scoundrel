import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { ResultScreen } from '../../src/ui/screens/ResultScreen';
import { renderWithProviders } from '../helpers/render';

const t = createTranslator('en');

const lostResult: RunResult = {
  outcome: 'lost',
  health: 0,
  score: -13,
  seed: 'result-seed',
  config: 0,
  highlights: {
    monstersDefeated: 3,
    potionsWasted: 1,
    roomsExplored: 2,
    roomsCleared: 1,
  },
};

const wonResult: RunResult = {
  outcome: 'won',
  health: 7,
  score: 7,
  seed: 'victory-seed',
  config: 0,
  highlights: {
    monstersDefeated: 10,
    potionsWasted: 0,
    roomsExplored: 5,
    roomsCleared: 5,
  },
};

describe('result screen', () => {
  it('summarizes a lost run with its score, seed, and highlights', () => {
    renderWithProviders(
      <ResultScreen result={lostResult} onNewRun={vi.fn()} onBackToTitle={vi.fn()} />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: t('result.lostTitle') });
    expect(heading).toBeInTheDocument();
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector('.result-score')?.textContent).toMatch(/-?13/);
    expect(screen.getByText('result-seed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('live-polite').textContent).toContain('13');
  });

  it('summarizes a won run with surviving health as the score', () => {
    renderWithProviders(
      <ResultScreen result={wonResult} onNewRun={vi.fn()} onBackToTitle={vi.fn()} />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: t('result.wonTitle') }),
    ).toBeInTheDocument();
    expect(document.querySelector('.result-score')?.textContent).toBe('7');
    expect(screen.getByText('victory-seed')).toBeInTheDocument();
    expect(screen.getByTestId('live-polite').textContent.length).toBeGreaterThan(0);
  });

  it('clamps fatal health to zero and shows the remaining monsters', () => {
    const fatal = { ...lostResult, health: -5 };
    renderWithProviders(
      <ResultScreen
        result={fatal}
        remainingMonsters={4}
        onNewRun={vi.fn()}
        onBackToTitle={vi.fn()}
      />,
    );

    const healthRow = screen.getByText(t('result.healthLabel')).closest('.result-panel__row');
    expect(healthRow).toHaveTextContent('0');
    expect(healthRow).not.toHaveTextContent('-5');

    const remainingRow = screen
      .getByText(t('result.remainingMonsters'))
      .closest('.result-panel__row');
    expect(remainingRow).toHaveTextContent('4');
  });

  it('omits the remaining-monsters row for a win', () => {
    renderWithProviders(
      <ResultScreen result={wonResult} onNewRun={vi.fn()} onBackToTitle={vi.fn()} />,
    );

    expect(screen.queryByText(t('result.remainingMonsters'))).not.toBeInTheDocument();
  });

  it('calls the result actions', () => {
    const onNewRun = vi.fn();
    const onBackToTitle = vi.fn();
    renderWithProviders(
      <ResultScreen result={lostResult} onNewRun={onNewRun} onBackToTitle={onBackToTitle} />,
    );

    fireEvent.click(screen.getByRole('button', { name: t('result.newRun') }));
    fireEvent.click(screen.getByRole('button', { name: t('result.backToTitle') }));

    expect(onNewRun).toHaveBeenCalledTimes(1);
    expect(onBackToTitle).toHaveBeenCalledTimes(1);
  });
});
