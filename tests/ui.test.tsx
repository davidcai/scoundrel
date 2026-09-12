import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import {
  DEFAULT_CONFIG,
  cardKind,
  cardValue,
  createInitialState,
  previewFight,
  type CardId,
  type GameAction,
  type GameState,
} from '../src/engine';
import { useGameStore } from '../src/store/gameStore';
import { useLanguage } from '../src/i18n';
import { loadStats } from '../src/store/stats';
import { loadSettings } from '../src/store/settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  // The app defaults to Chinese; these tests assert the English UI.
  act(() => useLanguage.setState({ lang: 'en' }));
  act(() => useGameStore.getState().reset());
  window.location.hash = '';
});

const isMonster = (c: CardId) => cardKind(c) === 'monster';
const isWeapon = (c: CardId) => cardKind(c) === 'weapon';
const isPotion = (c: CardId) => cardKind(c) === 'potion';

function seedFor(predicate: (room: CardId[]) => boolean): { seed: string; room: CardId[] } {
  for (let i = 0; i < 500; i++) {
    const seed = `t${i}`;
    const room = createInitialState(seed, DEFAULT_CONFIG).dungeon.slice(0, 4);
    if (predicate(room)) return { seed, room };
  }
  throw new Error('no seed matched');
}

function currentGame(): GameState {
  const game = useGameStore.getState().game;
  if (game === null) throw new Error('no active game');
  return game;
}

function cardButton(cardId: CardId): HTMLElement {
  const button = screen
    .getAllByRole('button')
    .find((b) => (b as HTMLElement).dataset.cardId === cardId);
  if (button === undefined) throw new Error(`card ${cardId} not rendered`);
  return button;
}

async function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

/** Greedy strategy via the store's act(): finishes any seeded run. */
function playOutGreedy(): void {
  let guard = 0;
  while (useGameStore.getState().game?.phase === 'playing' && guard++ < 1000) {
    const game = currentGame();
    if (game.room.length === 0) {
      act(() => useGameStore.getState().act({ type: 'DealRoom' }));
      continue;
    }
    const ready = game.dungeon.length > 0 && game.room.length === 1;
    if (ready) {
      act(() => useGameStore.getState().act({ type: 'EnterNextRoom' }));
      continue;
    }
    act(() => useGameStore.getState().act(pickGreedyAction(game)));
  }
}

function pickGreedyAction(state: GameState): GameAction {
  const room = state.room;
  const potion = room.find(isPotion);
  if (potion !== undefined && state.hp <= 12 && state.potionsUsedThisRoom === 0) {
    return { type: 'DrinkPotion', cardId: potion };
  }
  const best = room.filter(isWeapon).sort((a, b) => cardValue(b) - cardValue(a))[0];
  if (best !== undefined && (state.weapon === null || cardValue(best) > cardValue(state.weapon))) {
    return { type: 'EquipWeapon', cardId: best };
  }
  const monster = room.filter(isMonster).sort((a, b) => cardValue(a) - cardValue(b))[0];
  if (monster === undefined) {
    const any = room[0]!;
    return isWeapon(any)
      ? { type: 'EquipWeapon', cardId: any }
      : { type: 'DrinkPotion', cardId: any };
  }
  if (state.weapon !== null && previewFight(state, monster, false).legal) {
    return { type: 'FightMonster', cardId: monster };
  }
  return { type: 'FightMonster', cardId: monster, barehanded: true };
}

// ---------------------------------------------------------------------------
// Title & routing
// ---------------------------------------------------------------------------

describe('title screen', () => {
  it('shows the menu without Continue when there is no saved run', async () => {
    await renderAt('#/');
    expect(screen.getByRole('heading', { name: /scoundrel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
  });

  it('starts a new run from the title and deals a room of four cards', async () => {
    const user = userEvent.setup();
    await renderAt('#/');
    await user.click(screen.getByRole('button', { name: 'New run' }));
    await waitFor(() => expect(window.location.hash).toBe('#/play'));
    const cards = await screen.findAllByRole('button', {
      name: /, (monster|weapon|potion), value \d+/i,
    });
    expect(cards).toHaveLength(4);
    expect(useGameStore.getState().game?.room).toHaveLength(4);
    // The run is persisted so a reload can resume it.
    expect(localStorage.getItem('scoundrel:run')).not.toBeNull();
  });

  it('shows Continue when a run is in progress', async () => {
    act(() => useGameStore.getState().startRun('contseed', DEFAULT_CONFIG));
    await renderAt('#/');
    expect(screen.getByRole('button', { name: /continue/i })).toHaveTextContent('contseed');
  });

  it('opens the seeded play route and starts the deterministic run', async () => {
    await renderAt('#/play?seed=repro42');
    await waitFor(() => expect(useGameStore.getState().game?.seed).toBe('repro42'));
    const expected = createInitialState('repro42', DEFAULT_CONFIG).dungeon.slice(0, 4);
    expect(useGameStore.getState().game?.room).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Room interaction
// ---------------------------------------------------------------------------

describe('play screen', () => {
  it('labels every card for screen readers and shows the HUD', async () => {
    act(() => useGameStore.getState().startRun('hudseed', DEFAULT_CONFIG));
    await renderAt('#/play');
    const room = currentGame().room;
    for (const card of room) {
      const label = cardButton(card).getAttribute('aria-label');
      expect(label).toMatch(/(monster|weapon|potion), value \d+/);
    }
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.getByText(`${currentGame().dungeon.length} cards`)).toBeInTheDocument();
  });

  it('selects a monster, previews damage, and commits the fight', async () => {
    const user = userEvent.setup();
    const { seed, room } = seedFor((r) => r.filter(isMonster).length === 1);
    act(() => useGameStore.getState().startRun(seed, DEFAULT_CONFIG));
    await renderAt('#/play');

    const monster = room.find(isMonster)!;
    await user.click(cardButton(monster));

    // Preview appears before committing; selection lives in the store, not the engine.
    expect(useGameStore.getState().selectedCardId).toBe(monster);
    expect(screen.getByText(/fight barehanded — take \d+ damage/i)).toBeInTheDocument();

    const hpBefore = currentGame().hp;
    await user.click(screen.getByRole('button', { name: /fight barehanded/i }));
    expect(currentGame().hp).toBe(hpBefore - cardValue(monster));
    expect(useGameStore.getState().selectedCardId).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/slay/i);
  });

  it('resolves 3 of 4, enters the next room, and badges the carried card', async () => {
    const user = userEvent.setup();
    const { seed, room } = seedFor(
      (r) => r.filter(isMonster).length === 1 && r.some(isWeapon) && r.some(isPotion),
    );
    act(() => useGameStore.getState().startRun(seed, DEFAULT_CONFIG));
    await renderAt('#/play');

    const weapon = room.find(isWeapon)!;
    const potion = room.find(isPotion)!;
    const monster = room.find(isMonster)!;
    const carried = room.find((c) => c !== weapon && c !== potion && c !== monster)!;

    // Enter Next Room is gated until 3 are resolved.
    expect(screen.getByRole('button', { name: /enter next room/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.click(cardButton(weapon));
    await user.click(screen.getByRole('button', { name: /^Equip/ }));
    await user.click(cardButton(potion));
    await user.click(screen.getByRole('button', { name: /drink potion/i }));
    await user.click(cardButton(monster));
    await user.click(screen.getByRole('button', { name: /fight with/i }));

    const enter = screen.getByRole('button', { name: /enter next room/i });
    expect(enter).toHaveAttribute('aria-disabled', 'false');

    // Selecting the carry card explains WHY it cannot be resolved — the other
    // 3 cards of the room are already resolved (no fight/equip/drink buttons).
    await user.click(cardButton(carried));
    expect(screen.getByText(/the other 3 cards of this room are resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fight|equip|drink/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(enter);

    // The carried card is visually distinguished in the next room.
    await waitFor(() => expect(screen.getByText('Carried')).toBeInTheDocument());
    expect(currentGame().carriedCardId).toBe(carried);
    expect(currentGame().room[0]).toBe(carried);
  });

  it('rewinds the room with Undo to Room Start', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('undoseed', DEFAULT_CONFIG));
    await renderAt('#/play');

    const roomStart = currentGame().room;
    const target = roomStart.find(isPotion) ?? roomStart.find(isWeapon) ?? roomStart[0]!;
    await user.click(cardButton(target));
    const confirmName = isPotion(target) ? /drink potion/i : isWeapon(target) ? /^Equip/ : /fight/i;
    await user.click(screen.getByRole('button', { name: confirmName }));
    expect(currentGame().room).toHaveLength(3);
    expect(currentGame().resolvedCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /undo to room start/i }));
    expect(currentGame().room).toEqual(roomStart);
    expect(currentGame().resolvedCount).toBe(0);
  });

  it('blocks running away twice in a row with a visible reason', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('runseed', DEFAULT_CONFIG));
    await renderAt('#/play');

    const runButton = screen.getByRole('button', { name: /run away/i });
    expect(runButton).toHaveAttribute('aria-disabled', 'false');
    await user.click(runButton);
    expect(screen.getByRole('status')).toHaveTextContent(/flee/i);

    const blocked = screen.getByRole('button', { name: /run away/i });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    await user.click(blocked);
    expect(screen.getByRole('status')).toHaveTextContent(/two rooms in a row/i);
  });
});

// ---------------------------------------------------------------------------
// Terminal screen, stats idempotency, reload safety
// ---------------------------------------------------------------------------

describe('win/lose screen', () => {
  it('renders the scorecard, writes stats exactly once, and survives reload', async () => {
    act(() => useGameStore.getState().startRun('terminalseed', DEFAULT_CONFIG));
    const { unmount } = await renderAt('#/play');

    playOutGreedy();
    const game = currentGame();
    expect(['won', 'lost']).toContain(game.phase);
    if (game.phase === 'lost') {
      expect(screen.getByRole('heading', { name: /defeat/i })).toBeInTheDocument();
    } else {
      expect(screen.getByRole('heading', { name: /victory/i })).toBeInTheDocument();
    }
    expect(screen.getByTestId('final-score')).toBeInTheDocument();

    // Stats written exactly once (idempotent flag).
    let stats = loadStats();
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.runs).toHaveLength(1);
    expect(stats.runs[0]?.seed).toBe('terminalseed');
    if (game.phase === 'won') {
      expect(stats.runs[0]?.score).toBe(game.hp);
    } else {
      expect(stats.runs[0]?.score).toEqual(expect.any(Number));
    }
    expect(stats.runs[0]?.outcome).toBe(game.phase === 'won' ? 'won' : 'lost');

    // Reload: the terminal screen survives and stats are NOT double-counted.
    unmount();
    act(() => useGameStore.getState().reset());
    await renderAt('#/play');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /victory|defeat/i })).toBeInTheDocument(),
    );
    stats = loadStats();
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.runs).toHaveLength(1);
  });

  it('copies the replay link', async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, so override it after.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    act(() => useGameStore.getState().startRun('shareseed', DEFAULT_CONFIG));
    await renderAt('#/play');
    playOutGreedy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copy replay link/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /copy replay link/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('#/play?seed=shareseed');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /replay link copied/i })).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Settings & stats screens
// ---------------------------------------------------------------------------

describe('settings screen', () => {
  it('toggles house rules and persists them', async () => {
    const user = userEvent.setup();
    expect(loadSettings().config).toEqual(DEFAULT_CONFIG);
    await renderAt('#/settings');

    await user.click(screen.getByRole('switch', { name: /one potion per room/i }));
    expect(loadSettings().config.potionsPerRoom).toBe('unlimited');

    await user.click(screen.getByRole('switch', { name: /weapon degradation/i }));
    expect(loadSettings().config.weaponDegradation).toBe(false);
  });
});

describe('stats screen', () => {
  it('renders aggregates and offers replay of a recorded run', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('statseed', DEFAULT_CONFIG));
    const first = await renderAt('#/play');
    playOutGreedy();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /victory|defeat/i })).toBeInTheDocument(),
    );
    act(() => useGameStore.getState().finishRun());
    first.unmount();

    await renderAt('#/stats');
    expect(screen.getByText('Games played')).toBeInTheDocument();
    const history = screen.getByRole('table', { name: /run history/i });
    expect(within(history).getByText('statseed')).toBeInTheDocument();

    await user.click(within(history).getByRole('button', { name: 'Replay' }));
    await waitFor(() => expect(window.location.hash).toContain('#/play?seed=statseed'));
  });
});
