import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { createTranslator } from '../src/i18n';
import { createScoundrelStore, type HistoryEntry, type StoredStats } from '../src/store';
import { createMemoryStoreFixture, recordCompletedRuns, writeShard } from './helpers/appStore';

const t = createTranslator('en');

function renderAt(hash: string, store: ReturnType<typeof createScoundrelStore>) {
  window.history.replaceState(null, '', hash);
  return render(<App store={store} />);
}

function summaryValue(label: string): string {
  const grid = document.querySelector('.stat-grid');
  if (grid === null) throw new Error('Stats grid missing.');
  const term = within(grid as HTMLElement).getByText(label);
  const value = term.parentElement?.querySelector('dd');
  if (value == null) throw new Error(`No value for ${label}`);
  return value.textContent ?? '';
}

function historyRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.history-table tbody tr'));
}

function sampleHistory(): HistoryEntry[] {
  return [
    {
      runId: 'run-abandoned',
      seed: 'seed-abandoned',
      config: 0,
      outcome: 'lost',
      abandoned: true,
      score: -12,
      health: 20,
      roomsExplored: 1,
      roomsCleared: 0,
      monstersDefeated: 0,
      potionsWasted: 0,
      finishedAt: '2026-10-30T18:15:00.000Z',
    },
    {
      runId: 'run-won-2',
      seed: 'seed-won-2',
      config: 0,
      outcome: 'won',
      abandoned: false,
      score: 15,
      health: 15,
      roomsExplored: 12,
      roomsCleared: 12,
      monstersDefeated: 20,
      potionsWasted: 1,
      finishedAt: '2026-10-29T10:05:00.000Z',
    },
    {
      runId: 'run-won-1',
      seed: 'seed-won-1',
      config: 1,
      outcome: 'won',
      abandoned: false,
      score: 20,
      health: 20,
      roomsExplored: 11,
      roomsCleared: 11,
      monstersDefeated: 19,
      potionsWasted: 0,
      finishedAt: '2026-10-28T09:00:00.000Z',
    },
  ];
}

function sampleStats(): StoredStats {
  const history = sampleHistory();
  return {
    statistics: {
      gamesPlayed: 3,
      wins: 2,
      losses: 1,
      bestScore: 20,
      currentStreak: 0,
      bestStreak: 2,
    },
    history,
    recordedRunIds: history.map((entry) => entry.runId),
  };
}

describe('statistics and history screen', () => {
  it('shows the zero state with a dash win rate and an empty history', () => {
    const { store } = createMemoryStoreFixture();
    renderAt('#/stats', store);

    const heading = screen.getByRole('heading', { level: 1, name: t('stats.title') });
    expect(heading).toHaveFocus();
    expect(summaryValue(t('stats.winRate'))).toBe(t('stats.none'));
    expect(summaryValue(t('stats.gamesPlayed'))).toBe('0');
    expect(screen.getByText(t('stats.emptyTitle'))).toBeInTheDocument();
    expect(historyRows()).toHaveLength(0);
  });

  it('renders seeded lifetime statistics and the newest-first history', () => {
    const { storage } = createMemoryStoreFixture();
    writeShard(storage, 'stats', sampleStats());
    const store = createScoundrelStore({ storage });
    renderAt('#/stats', store);

    expect(summaryValue(t('stats.gamesPlayed'))).toBe('3');
    expect(summaryValue(t('stats.wins'))).toBe('2');
    expect(summaryValue(t('stats.losses'))).toBe('1');
    expect(summaryValue(t('stats.winRate'))).toBe(t('stats.winRateValue', { percent: 67 }));
    expect(summaryValue(t('stats.bestScore'))).toBe('20');
    expect(summaryValue(t('stats.currentStreak'))).toBe('0');
    expect(summaryValue(t('stats.bestStreak'))).toBe('2');

    const rows = historyRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('seed-abandoned');
    expect(rows[1]).toHaveTextContent('seed-won-2');
    expect(rows[2]).toHaveTextContent('seed-won-1');
    expect(within(rows[0]!).getByTestId('history-outcome')).toHaveClass(
      'history-outcome--abandoned',
    );
    expect(within(rows[1]!).getByTestId('history-outcome')).toHaveClass('history-outcome--won');
    expect(screen.getByText(t('stats.historyNote'))).toBeInTheDocument();

    const scrollRegion = screen
      .getAllByRole('region', { name: t('stats.historyTitle') })
      .find((region) => region.getAttribute('tabindex') === '0');
    expect(scrollRegion).toBeDefined();
  });

  it('places outcome and score immediately after the date column', () => {
    const { storage } = createMemoryStoreFixture();
    writeShard(storage, 'stats', sampleStats());
    const store = createScoundrelStore({ storage });
    renderAt('#/stats', store);

    const headers = Array.from(document.querySelectorAll('.history-table thead th')).map(
      (cell) => cell.textContent,
    );
    expect(headers.slice(0, 4)).toEqual([
      t('stats.columnDate'),
      t('stats.columnOutcome'),
      t('stats.columnScore'),
      t('stats.columnSeed'),
    ]);
    expect(headers).toHaveLength(6);
    expect(headers).not.toContain('Rooms cleared');
  });

  it('replays a listed run with its original seed and options', () => {
    const { storage } = createMemoryStoreFixture();
    writeShard(storage, 'stats', sampleStats());
    const store = createScoundrelStore({ storage });
    renderAt('#/stats', store);

    const replay = screen.getByRole('button', {
      name: t('stats.replayLabel', { seed: 'seed-won-1' }),
    });
    fireEvent.click(replay);

    expect(window.location.hash).toContain('seed=seed-won-1');
    expect(window.location.hash).toContain('config=1');
    expect(screen.getByLabelText(t('a11y.seed', { seed: 'seed-won-1' }))).toBeInTheDocument();
    expect(store.getSnapshot().activeRun?.seed).toBe('seed-won-1');
  });

  it('shows thirty rows when more than thirty runs were recorded', () => {
    const { store } = createMemoryStoreFixture();
    recordCompletedRuns(store, 31);
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(31);
    expect(store.getSnapshot().history).toHaveLength(30);

    renderAt('#/stats', store);
    expect(historyRows()).toHaveLength(30);
    expect(summaryValue(t('stats.gamesPlayed'))).toBe('31');
    expect(screen.getByText(t('stats.historyNote'))).toBeInTheDocument();
  });

  it('returns to the title from statistics', () => {
    const { store } = createMemoryStoreFixture();
    renderAt('#/stats', store);
    fireEvent.click(screen.getByRole('button', { name: t('stats.close') }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title'));
    expect(window.location.hash).toBe('#/');
  });
});
