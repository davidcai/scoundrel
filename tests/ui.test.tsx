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
import { useGameStore } from '../src/store/game-store';
import { useLanguage } from '../src/i18n';
import { loadStats } from '../src/store/stats';
import { loadSettings } from '../src/store/settings';
import { createPlayTable } from '../src/game';

// ---------------------------------------------------------------------------
// Game-layer mock
// ---------------------------------------------------------------------------

type RunEndedCb = (info: { outcome: 'won' | 'lost' }) => void;

/** Every handle the stubbed createPlayTable produced, in creation order. */
const handleRegistry = vi.hoisted(() => {
  return [] as Array<{ runEndedCbs: Set<RunEndedCb> }>;
});

// PlayScreen mounts the play table unconditionally (Phase 4): stubbing the
// `src/game` entry keeps Phaser out of the jsdom import chain (no
// canvas/WebGL there) and lets the terminal-screen tests open the handoff
// gate deterministically by firing the run-ended channel.
vi.mock('../src/game', () => ({
  DESIGN_WIDTH: 960,
  DESIGN_HEIGHT: 600,
  createPlayTable: vi.fn(() => {
    const runEndedCbs = new Set<RunEndedCb>();
    handleRegistry.push({ runEndedCbs });
    return {
      destroy: vi.fn(),
      whenReady: () => Promise.resolve(),
      onHover: vi.fn(() => () => undefined),
      snapshot: () => Promise.resolve(''),
      onRunEnded: vi.fn((cb: RunEndedCb) => {
        runEndedCbs.add(cb);
        return () => {
          runEndedCbs.delete(cb);
        };
      }),
      setReducedMotion: vi.fn(),
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  handleRegistry.length = 0;
  vi.mocked(createPlayTable).mockClear();
  localStorage.clear();
  // The app defaults to Chinese; these tests assert the English UI.
  act(() => useLanguage.setState({ lang: 'en', setting: 'en' }));
  act(() => useGameStore.getState().reset());
  window.location.hash = '';
});

const isMonster = (c: CardId) => cardKind(c) === 'monster';
const isWeapon = (c: CardId) => cardKind(c) === 'weapon';
const isPotion = (c: CardId) => cardKind(c) === 'potion';

function currentGame(): GameState {
  const game = useGameStore.getState().game;
  if (game === null) throw new Error('no active game');
  return game;
}

async function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

/** Opens the handoff gate via the stubbed handle's run-ended channel. */
function fireRunEnded(): void {
  const entry = handleRegistry.at(-1);
  if (entry === undefined) throw new Error('no play table handle was created');
  const outcome: 'won' | 'lost' = useGameStore.getState().game?.phase === 'won' ? 'won' : 'lost';
  for (const cb of entry.runEndedCbs) {
    cb({ outcome });
  }
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
    // The room is mirrored over the canvas (data-card-id nodes; card buttons
    // no longer exist — the canvas draws the cards).
    await waitFor(() =>
      expect(document.querySelectorAll('.room-mirror [data-card-id]')).toHaveLength(4),
    );
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
// The DOM room table (CardView buttons, WeaponStack, roving-focus nav) was
// deleted in Phase 4 — the canvas owns the table. Card selection/resolve
// flows are covered renderer-side by tests/phaser-play.test.tsx through the
// CardSelectionControl + ActionPanel; this suite keeps the renderer-independent
// overlay behavior.

describe('play screen', () => {
  it('labels every card for screen readers via the mirror and shows the HUD', async () => {
    act(() => useGameStore.getState().startRun('hudseed', DEFAULT_CONFIG));
    await renderAt('#/play');
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));

    // The mirror carries the exact engine room composition (the a11y seam;
    // per-card SR labels live in the keyboard control's live region).
    const ids = Array.from(document.querySelectorAll<HTMLElement>('.room-mirror [data-card-id]')).map(
      (el) => el.dataset.cardId,
    );
    expect(ids).toEqual(currentGame().room);
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.getByText(`${currentGame().dungeon.length} cards`)).toBeInTheDocument();
  });

  it('blocks running away twice in a row with a visible reason', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('runseed', DEFAULT_CONFIG));
    await renderAt('#/play');

    const runButton = screen.getByRole('button', { name: /flee/i });
    expect(runButton).toHaveAttribute('aria-disabled', 'false');
    await user.click(runButton);
    expect(screen.getByRole('status')).toHaveTextContent(/flee/i);

    const blocked = screen.getByRole('button', { name: /flee/i });
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
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));

    playOutGreedy();
    const game = currentGame();
    expect(['won', 'lost']).toContain(game.phase);
    // The handoff gate holds the scorecard until the flourish completes;
    // the stubbed handle's run-ended channel opens it (fail-open bounds it
    // at 1 s when the flourish never signals — see tests/phaser-play).
    act(() => fireRunEnded());
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
    // (The run ended before this mount, so the gate opens via the fail-open.)
    unmount();
    act(() => useGameStore.getState().reset());
    await renderAt('#/play');
    await waitFor(
      () =>
        expect(screen.getByRole('heading', { name: /victory|defeat/i })).toBeInTheDocument(),
      { timeout: 2000 },
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
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));
    playOutGreedy();
    act(() => fireRunEnded());
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
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));
    playOutGreedy();
    act(() => fireRunEnded());
    await waitFor(
      () => expect(screen.getByRole('heading', { name: /victory|defeat/i })).toBeInTheDocument(),
      { timeout: 2000 },
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
