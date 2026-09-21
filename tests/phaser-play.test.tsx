import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { cardAriaLabel, cardHint, cardLabel, useLanguage } from '../src/i18n';
import { useGameStore } from '../src/store/game-store';
import { createPlayTable } from '../src/game';

type UserEvent = ReturnType<typeof userEvent.setup>;
type RunEndedCb = (info: { outcome: 'won' | 'lost' }) => void;

// ---------------------------------------------------------------------------
// Game-layer mock
// ---------------------------------------------------------------------------

/** Every handle the stubbed createPlayTable produced, in creation order. */
const handleRegistry = vi.hoisted(() => {
  return [] as Array<{
    runEndedCbs: Set<RunEndedCb>;
    /** Every `setReducedMotion` push, in order. */
    reducedCalls: boolean[];
  }>;
});

// The canvas mount is non-fatal under jsdom (no canvas/WebGL — PlayScreen logs
// and leaves the region inert), but stubbing the `src/game` entry keeps the
// suite fast and deterministic: the dynamic import resolves to a stub handle
// without ever loading Phaser. The stub carries the Phase 2 motion-era
// members (`onRunEnded`, `setReducedMotion`) so the gate + live
// reduced-motion wiring are exercisable; each handle registers itself in
// `handleRegistry` for the tests to drive.
vi.mock('../src/game', () => ({
  DESIGN_WIDTH: 960,
  DESIGN_HEIGHT: 600,
  createPlayTable: vi.fn(() => {
    const runEndedCbs = new Set<RunEndedCb>();
    const reducedCalls: boolean[] = [];
    handleRegistry.push({ runEndedCbs, reducedCalls });
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
      setReducedMotion: vi.fn((reduced: boolean) => {
        reducedCalls.push(reduced);
      }),
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

async function renderAt(hash: string) {
  window.location.hash = hash;
  return render(<App />);
}

/** The room mirror's node for a card (never the weapon readout's `.weapon-card`). */
function mirrorCard(cardId: CardId): HTMLElement {
  const el = document.querySelector<HTMLElement>(`.room-mirror [data-card-id="${cardId}"]`);
  if (el === null) throw new Error(`mirror node for ${cardId} not rendered`);
  return el;
}

function mirrorIds(): CardId[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.room-mirror [data-card-id]')).map(
    (el) => el.dataset.cardId as CardId,
  );
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

/** The latest stubbed handle entry (throws if no canvas was ever mounted). */
function lastHandleEntry(): { runEndedCbs: Set<RunEndedCb>; reducedCalls: boolean[] } {
  const entry = handleRegistry.at(-1);
  if (entry === undefined) throw new Error('no play table handle was created');
  return entry;
}

/** Fires the run-ended channel (post-flourish signal from the game lane). */
function fireRunEnded(outcome: 'won' | 'lost'): void {
  for (const cb of lastHandleEntry().runEndedCbs) {
    cb({ outcome });
  }
}

/**
 * Card selection through the overlay CardSelectionControl — the phaser path's
 * keyboard seam (the canvas cards are not DOM): Home jumps
 * to the first room card, ArrowRight cycles in engine room order.
 */
async function selectViaKeyboard(user: UserEvent, cardId: CardId): Promise<void> {
  const control = document.querySelector<HTMLElement>('.card-selection');
  if (control === null) throw new Error('card selection control not rendered');
  control.focus();
  await user.keyboard('{Home}');
  const index = currentGame().room.indexOf(cardId);
  for (let i = 0; i < index; i++) {
    await user.keyboard('{ArrowRight}');
  }
  expect(useGameStore.getState().selectedCardId).toBe(cardId);
}

// ---------------------------------------------------------------------------
// Phaser-path play screen (docs/phaser-plan.md §5 seam 2)
// ---------------------------------------------------------------------------

describe('play screen — phaser path', () => {
  it('renders the mirror + readout instead of the DOM table', async () => {
    act(() => useGameStore.getState().startRun('phaserhud', DEFAULT_CONFIG));
    await renderAt('#/play');

    // The canvas region mounts the game through the (stubbed) dynamic import.
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.play-table-region')).not.toBeNull();
    expect(document.querySelector('.play-table-canvas')).not.toBeNull();

    // No DOM card buttons: the canvas owns the card visuals, the mirror is
    // the aria-hidden test seam.
    expect(document.querySelectorAll('button.card')).toHaveLength(0);
    expect(mirrorIds()).toEqual(currentGame().room);
    expect(mirrorCard(currentGame().room[0]!).getAttribute('aria-hidden')).toBeNull(); // mirror root is aria-hidden, cards plain divs

    // The weapon readout carries the weapon-zone information; HUD unchanged.
    expect(document.querySelector('.weapon-readout')).not.toBeNull();
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.getByText(`${currentGame().dungeon.length} cards`)).toBeInTheDocument();
  });

  it('mirror matches the engine room and selection announces the card name', async () => {
    const user = userEvent.setup();
    const { seed, room } = seedFor((r) => r.filter(isMonster).length === 1);
    act(() => useGameStore.getState().startRun(seed, DEFAULT_CONFIG));
    await renderAt('#/play');

    expect(mirrorIds()).toEqual(room);
    expect(mirrorCard(room[0]!)).toBeInTheDocument();

    const monster = room.find(isMonster)!;
    await selectViaKeyboard(user, monster);

    // Screen-reader contract: the live region announces the card name and the
    // selected card's hint is rendered in DOM (the tooltip layer for keyboard).
    const control = document.querySelector('.card-selection') as HTMLElement;
    expect(within(control).getByText(cardLabel(monster))).toBeInTheDocument();
    expect(control.querySelector('.selection-hint')?.textContent).toBe(cardHint(monster));
    expect(mirrorCard(monster).querySelector('.selected-ring')).not.toBeNull();
  });

  it('selects a monster via the control, previews damage, and commits the fight', async () => {
    const user = userEvent.setup();
    const { seed, room } = seedFor((r) => r.filter(isMonster).length === 1);
    act(() => useGameStore.getState().startRun(seed, DEFAULT_CONFIG));
    await renderAt('#/play');

    const monster = room.find(isMonster)!;
    await selectViaKeyboard(user, monster);

    // Preview appears before committing; selection lives in the store.
    expect(useGameStore.getState().selectedCardId).toBe(monster);
    expect(screen.getByText(/fight barehanded — take \d+ damage/i)).toBeInTheDocument();

    const hpBefore = currentGame().hp;
    await user.click(screen.getByRole('button', { name: /fight barehanded/i }));
    expect(currentGame().hp).toBe(hpBefore - cardValue(monster));
    expect(useGameStore.getState().selectedCardId).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/slay/i);
    expect(currentGame().room).not.toContain(monster);
    expect(mirrorIds()).not.toContain(monster);
  });

  it('resolves 3 of 4 via the control + ActionPanel, enters the next room, and badges the carried card', async () => {
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

    await selectViaKeyboard(user, weapon);
    await user.click(screen.getByRole('button', { name: /^Equip/ }));
    await selectViaKeyboard(user, potion);
    await user.click(screen.getByRole('button', { name: /drink potion/i }));
    await selectViaKeyboard(user, monster);
    await user.click(screen.getByRole('button', { name: /fight with/i }));

    const enter = screen.getByRole('button', { name: /enter next room/i });
    expect(enter).toHaveAttribute('aria-disabled', 'false');

    // Selecting the carry card explains WHY it cannot be resolved.
    await selectViaKeyboard(user, carried);
    expect(screen.getByText(/the other 3 cards of this room are resolved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fight|equip|drink/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(enter);

    // The carried card is visually distinguished in the next room (mirror).
    await waitFor(() => expect(screen.getByText('Carried')).toBeInTheDocument());
    expect(currentGame().carriedCardId).toBe(carried);
    expect(currentGame().room[0]).toBe(carried);
    expect(mirrorIds()).toEqual(currentGame().room);
  });

  it('rewinds the room with Undo', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('undoseed', DEFAULT_CONFIG));
    await renderAt('#/play');

    const roomStart = currentGame().room;
    const target = roomStart.find(isPotion) ?? roomStart.find(isWeapon) ?? roomStart[0]!;
    await selectViaKeyboard(user, target);
    const confirmName = isPotion(target) ? /drink potion/i : isWeapon(target) ? /^Equip/ : /fight/i;
    await user.click(screen.getByRole('button', { name: confirmName }));
    expect(currentGame().room).toHaveLength(3);
    expect(currentGame().resolvedCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(currentGame().room).toEqual(roomStart);
    expect(currentGame().resolvedCount).toBe(0);
    expect(mirrorIds()).toEqual(roomStart);
  });

  it('forwards mirror clicks to the store with PlayScreen toggle semantics', async () => {
    act(() => useGameStore.getState().startRun('mirrorclick', DEFAULT_CONFIG));
    await renderAt('#/play');

    const room = currentGame().room;
    const first = room[0]!;

    // Click selects (the e2e pointer-input proxy — plan §4 Phase 1).
    fireEvent.click(mirrorCard(first));
    expect(useGameStore.getState().selectedCardId).toBe(first);
    expect(mirrorCard(first).dataset.selected).toBe('true');

    // Clicking the selected card again deselects.
    fireEvent.click(mirrorCard(first));
    expect(useGameStore.getState().selectedCardId).toBeNull();

    // Selecting another card moves the selection instead of stacking it.
    fireEvent.click(mirrorCard(room[1]!));
    expect(useGameStore.getState().selectedCardId).toBe(room[1]);
    expect(mirrorCard(room[1]!).querySelector('.selected-ring')).not.toBeNull();
  });

  it('Escape clears the keyboard selection', async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().startRun('esc deselect', DEFAULT_CONFIG));
    await renderAt('#/play');

    await selectViaKeyboard(user, currentGame().room[0]!);
    await user.keyboard('{Escape}');
    expect(useGameStore.getState().selectedCardId).toBeNull();
    expect(document.querySelector('.card-selection')?.getAttribute('data-selected-card-id')).toBe(
      null,
    );
  });

  it('weapon readout reflects the engine state after equip + fight', async () => {
    const user = userEvent.setup();
    const { seed, room } = seedFor(
      (r) =>
        r.some(isWeapon) &&
        r.some(isMonster) &&
        cardValue(r.find(isWeapon)!) >= cardValue(r.find(isMonster)!),
    );
    act(() => useGameStore.getState().startRun(seed, DEFAULT_CONFIG));
    await renderAt('#/play');

    const weapon = room.find(isWeapon)!;
    const monster = room.find(isMonster)!;

    await selectViaKeyboard(user, weapon);
    await user.click(screen.getByRole('button', { name: /^Equip/ }));
    expect(useGameStore.getState().selectedCardId).toBeNull();

    // Readout: weapon id carried on `.weapon-card`, threshold/count text.
    const weaponCard = document.querySelector('.weapon-card') as HTMLElement;
    expect(weaponCard.getAttribute('data-card-id')).toBe(weapon);
    expect(screen.getByText(/can fight any monster/i)).toBeInTheDocument();

    await selectViaKeyboard(user, monster);
    await user.click(screen.getByRole('button', { name: /fight with/i }));

    // Kill stack keeps list semantics + the last-kill badge.
    const list = document.querySelector('[role="list"]') as HTMLElement;
    expect(list).not.toBeNull();
    const items = Array.from(list.querySelectorAll('[role="listitem"]')) as HTMLElement[];
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute('aria-label')).toBe(cardAriaLabel(monster));
    expect(items[0]!.querySelector('.last-kill-badge')?.textContent).toBe('Last kill');
    expect(document.querySelector('.weapon-card')?.getAttribute('data-card-id')).toBe(weapon);
  });
});

// ---------------------------------------------------------------------------
// Win/lose handoff gate + live reduced motion (docs/phaser-plan.md §3, §4 Phase 2)
// ---------------------------------------------------------------------------

describe('win/lose handoff gate', () => {
  function seededRender(): Promise<void> {
    return (async () => {
      act(() => useGameStore.getState().startRun('gateseed', DEFAULT_CONFIG));
      await renderAt('#/play');
      // Wait for the (stubbed) canvas mount before finishing the run: the
      // gate's onRunEnded subscription must be live first.
      await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));
    })();
  }

  it('delays the scorecard until the canvas reports the run ended', async () => {
    await seededRender();
    vi.useFakeTimers();

    act(() => playOutGreedy());
    const game = useGameStore.getState().game;
    expect(game?.phase).not.toBe('playing');
    const outcome: 'won' | 'lost' = game!.phase === 'won' ? 'won' : 'lost';

    // Gate closed: the canvas region stays mounted, the scorecard does not
    // render yet — the flourish owns the screen.
    expect(screen.queryByRole('heading', { name: /victory|defeat/i })).not.toBeInTheDocument();
    expect(document.querySelector('.play-table-region')).not.toBeNull();
    // Subscribed exactly once per handle.
    expect(lastHandleEntry().runEndedCbs.size).toBe(1);

    // The flourish completes → onRunEnded fires → the gate opens.
    act(() => fireRunEnded(outcome));
    expect(
      screen.getByRole('heading', { name: outcome === 'won' ? /victory/i : /defeat/i }),
    ).toBeInTheDocument();
    expect(document.querySelector('.play-table-region')).toBeNull();
  });

  it('fails open after the handoff timeout', async () => {
    await seededRender();
    vi.useFakeTimers();

    act(() => playOutGreedy());
    expect(useGameStore.getState().game?.phase).not.toBe('playing');
    expect(screen.queryByRole('heading', { name: /victory|defeat/i })).not.toBeInTheDocument();

    // Just before the fail-open deadline the gate is still holding.
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByRole('heading', { name: /victory|defeat/i })).not.toBeInTheDocument();

    // At the deadline the scorecard takes over — the flourish is
    // presentation-only and must never strand the player (mount failures and
    // pre-Phase-2 handles included, since onRunEnded then never fires).
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('heading', { name: /victory|defeat/i })).toBeInTheDocument();
  });
});

describe('live reduced motion', () => {
  function stubMatchMedia(initialMatches: boolean): {
    listeners: Set<(event: MediaQueryListEvent) => void>;
    setMatches: (matches: boolean) => void;
  } {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let matches = initialMatches;
    const fakeMq = {
      get matches() {
        return matches;
      },
      addEventListener: (_type: 'change', cb: (event: MediaQueryListEvent) => void) => {
        listeners.add(cb);
      },
      removeEventListener: (_type: 'change', cb: (event: MediaQueryListEvent) => void) => {
        listeners.delete(cb);
      },
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => fakeMq as unknown as MediaQueryList),
    );
    return {
      listeners,
      setMatches: (next: boolean) => {
        matches = next;
        for (const cb of listeners) {
          cb({ matches: next } as MediaQueryListEvent);
        }
      },
    };
  }

  it('carries the media query into the create-time opts and pushes live changes', async () => {
    const media = stubMatchMedia(false);
    act(() => useGameStore.getState().startRun('motionseed', DEFAULT_CONFIG));
    await renderAt('#/play');
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));

    // Create-time opts carry the initial (un-reduced) value...
    expect(vi.mocked(createPlayTable).mock.lastCall?.[1]).toEqual({ reducedMotion: false });
    // ...and the live channel is subscribed but has pushed nothing yet (the
    // create opts ARE the initial value).
    expect(lastHandleEntry().reducedCalls).toEqual([]);

    // OS toggle / Playwright reducedMotion emulation flips the query.
    act(() => {
      media.setMatches(true);
    });
    expect(lastHandleEntry().reducedCalls).toEqual([true]);

    act(() => {
      media.setMatches(false);
    });
    expect(lastHandleEntry().reducedCalls).toEqual([true, false]);
  });

  it('the motion=off param forces reduced motion at create and live', async () => {
    const media = stubMatchMedia(false);
    act(() => useGameStore.getState().startRun('motionoff', DEFAULT_CONFIG));
    await renderAt('#/play?seed=motionoff&motion=off');
    await waitFor(() => expect(createPlayTable).toHaveBeenCalledTimes(1));

    // Create-time opts are forced reduced...
    expect(vi.mocked(createPlayTable).mock.lastCall?.[1]).toEqual({ reducedMotion: true });
    // ...and the escape hatch is pushed live on arrival.
    expect(lastHandleEntry().reducedCalls).toEqual([true]);

    // The media query ORs into the escape hatch: un-reducing the query keeps
    // reduced motion on while the param is present.
    act(() => {
      media.setMatches(true);
    });
    act(() => {
      media.setMatches(false);
    });
    expect(lastHandleEntry().reducedCalls).toEqual([true, true, true]);
  });
});
