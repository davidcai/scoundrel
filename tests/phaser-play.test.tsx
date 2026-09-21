import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import {
  DEFAULT_CONFIG,
  cardKind,
  cardValue,
  createInitialState,
  type CardId,
  type GameState,
} from '../src/engine';
import { cardAriaLabel, cardHint, cardLabel, useLanguage } from '../src/i18n';
import { useGameStore } from '../src/store/game-store';
import { useTableRenderer } from '../src/ui/table-renderer';
import { createPlayTable } from '../src/game';

type UserEvent = ReturnType<typeof userEvent.setup>;

// ---------------------------------------------------------------------------
// Game-layer mock
// ---------------------------------------------------------------------------

// The canvas mount is non-fatal under jsdom (no canvas/WebGL — PlayScreen logs
// and leaves the region inert), but stubbing the `src/game` entry keeps the
// suite fast and deterministic: the dynamic import resolves to a stub handle
// without ever loading Phaser. The stub shape mirrors `PlayTableHandle`.
vi.mock('../src/game', () => ({
  DESIGN_WIDTH: 960,
  DESIGN_HEIGHT: 600,
  createPlayTable: vi.fn(() => ({
    destroy: vi.fn(),
    whenReady: () => Promise.resolve(),
    onHover: vi.fn(() => () => undefined),
    snapshot: () => Promise.resolve(''),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  // The app defaults to Chinese; these tests assert the English UI.
  act(() => useLanguage.setState({ lang: 'en', setting: 'en' }));
  act(() => useGameStore.getState().reset());
  // Route through the real settings seam (the same one the SettingsScreen
  // toggle drives): flips the reactive hook AND persists the settings shard.
  act(() => useTableRenderer.getState().setRenderer('phaser'));
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

/**
 * Card selection through the overlay CardSelectionControl — the phaser path's
 * keyboard seam (the DOM path's `.card` buttons don't exist here): Home jumps
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

    // The weapon readout replaces WeaponStack; HUD unchanged.
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
