import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import { ResultScreen, type ResultScreenProps } from '../../src/ui/screens/ResultScreen';
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

function renderResult(result: RunResult, overrides: Partial<ResultScreenProps> = {}) {
  return renderWithProviders(
    <ResultScreen
      result={result}
      onNewRun={vi.fn()}
      onBackToTitle={vi.fn()}
      onViewStatistics={vi.fn()}
      {...overrides}
    />,
  );
}

describe('result screen', () => {
  it('summarizes a lost run with its score, seed, and highlights', () => {
    renderResult(lostResult);

    const heading = screen.getByRole('heading', { level: 1, name: t('result.lostTitle') });
    expect(heading).toBeInTheDocument();
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector('.result-score')?.textContent).toMatch(/-?13/);
    expect(screen.getByText('result-seed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('live-polite').textContent).toContain('13');
  });

  it('summarizes a won run with surviving health as the score', () => {
    renderResult(wonResult);

    expect(
      screen.getByRole('heading', { level: 1, name: t('result.wonTitle') }),
    ).toBeInTheDocument();
    expect(document.querySelector('.result-score')?.textContent).toBe('7');
    expect(screen.getByText('victory-seed')).toBeInTheDocument();
    expect(screen.getByTestId('live-polite').textContent.length).toBeGreaterThan(0);
  });

  it('clamps fatal health to zero and shows the remaining monsters', () => {
    const fatal = { ...lostResult, health: -5 };
    renderResult(fatal, { remainingMonsters: 4 });

    const healthRow = screen
      .getByRole('rowheader', { name: t('result.healthLabel') })
      .closest('tr');
    expect(healthRow).toHaveTextContent('0');
    expect(healthRow).not.toHaveTextContent('-5');

    const remainingRow = screen
      .getByRole('rowheader', { name: t('result.remainingMonsters') })
      .closest('tr');
    expect(remainingRow).toHaveTextContent('4');
  });

  it('omits the remaining-monsters row for a win', () => {
    renderResult(wonResult);

    expect(screen.queryByText(t('result.remainingMonsters'))).not.toBeInTheDocument();
  });

  it('orders the result actions per the approved design', () => {
    renderResult(lostResult);

    const actions = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.result-panel__actions .button'),
    ).map((button) => ({
      label: button.textContent,
      variant: Array.from(button.classList).find((name) => name.startsWith('button--')),
    }));

    expect(actions).toEqual([
      { label: t('result.newRun'), variant: 'button--primary' },
      { label: t('result.backToTitle'), variant: 'button--secondary' },
      { label: t('result.viewStatistics'), variant: 'button--ghost' },
    ]);
  });

  it('renders the breakdown as a table with right-aligned values', () => {
    renderResult(lostResult);

    const table = screen.getByRole('table');
    expect(table).toHaveClass('data-table', 'result-table');
    expect(screen.getAllByRole('rowheader').length).toBeGreaterThan(2);
    for (const cell of table.querySelectorAll('td')) {
      expect(cell).toHaveClass('data-table__numeric');
    }
  });

  it('calls the result actions', () => {
    const onNewRun = vi.fn();
    const onBackToTitle = vi.fn();
    const onViewStatistics = vi.fn();
    renderResult(lostResult, { onNewRun, onBackToTitle, onViewStatistics });

    fireEvent.click(screen.getByRole('button', { name: t('result.newRun') }));
    fireEvent.click(screen.getByRole('button', { name: t('result.viewStatistics') }));
    fireEvent.click(screen.getByRole('button', { name: t('result.backToTitle') }));

    expect(onNewRun).toHaveBeenCalledTimes(1);
    expect(onViewStatistics).toHaveBeenCalledTimes(1);
    expect(onBackToTitle).toHaveBeenCalledTimes(1);
  });

  it('does not show a replay link on the result screen', () => {
    renderResult(lostResult);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/replay link/i)).not.toBeInTheDocument();
  });
});
