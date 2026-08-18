/**
 * Win/lose scorecard: outcome, final HP, score, seed, toggles, run
 * highlights, and the copy-replay-link affordance (URL composition asserted).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createGameStore, GameStoreProvider } from '../../store/gameStore';
import { makeConfig, makeFakeEngine, makeState } from '../../test/fixtures';
import { saveRun } from '../../persistence/run';
import { slotsFor } from '../../test/fixtures';
import { EndScreen } from './EndScreen';

beforeEach(() => {
  localStorage.clear();
});

function renderEnd(overrides: Partial<Parameters<typeof makeState>[0]> = {}, score = -9) {
  const store = createGameStore({ engine: makeFakeEngine() });
  const state = makeState({
    seed: 'dead99',
    hp: -3,
    phase: 'lost',
    runHighlights: { monstersKilled: 9, potionsWasted: 2, roomsExplored: 12 },
    ...overrides,
  });
  store.setState({
    game: state,
    slots: slotsFor(state.room),
    outcome: { phase: state.phase === 'won' ? 'won' : 'lost', score },
  });
  render(
    <GameStoreProvider value={store}>
      <EndScreen />
    </GameStoreProvider>,
  );
  return store;
}

describe('EndScreen', () => {
  it('renders the loss scorecard with outcome, HP, score, seed, toggles, highlights', () => {
    renderEnd();
    expect(screen.getByRole('heading', { name: 'You died in the dungeon' })).toBeInTheDocument();
    expect(screen.getByLabelText('Final score -9')).toBeInTheDocument();
    expect(screen.getByText('-3')).toBeInTheDocument(); // final HP
    expect(screen.getByText('9')).toBeInTheDocument(); // monsters slain
    expect(screen.getByText('2')).toBeInTheDocument(); // potions wasted
    expect(screen.getByText('12')).toBeInTheDocument(); // rooms explored
    expect(screen.getByText('dead99')).toBeInTheDocument();
    expect(
      screen.getByText(/run-away once · one potion per room · weapon degradation on/),
    ).toBeInTheDocument();
  });

  it('renders the win scorecard', () => {
    renderEnd({ phase: 'won', hp: 14 }, 14);
    expect(screen.getByRole('heading', { name: 'You survived the dungeon' })).toBeInTheDocument();
    expect(screen.getByLabelText('Final score 14')).toBeInTheDocument();
  });

  it('shows the replay URL with seed + encoded config', () => {
    renderEnd({
      config: makeConfig({ runAwayMode: 'unlimited', weaponDegradation: false }),
    });
    expect(screen.getByText('#/play?seed=dead99&config=u1n')).toBeInTheDocument();
  });

  it('copy replay link writes the absolute URL to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderEnd();
    // fireEvent (not userEvent): userEvent.setup() replaces navigator.clipboard
    // with its own stub and would shadow this mock.
    fireEvent.click(screen.getByRole('button', { name: 'Copy replay link' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}${window.location.pathname}#/play?seed=dead99&config=o1d`,
    );
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('Back to title clears the run record', async () => {
    const store = renderEnd();
    const game = store.getState().game;
    if (game === null) throw new Error('expected an active game');
    saveRun({
      state: game,
      slots: slotsFor([]),
      slotsSnapshot: null,
      carriedCardId: null,
      statsWritten: true,
      outcome: { phase: 'lost', score: -9 },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back to title' }));
    expect(store.getState().game).toBeNull();
    expect(window.location.hash).toBe('#/');
  });
});
