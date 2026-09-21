import { act, render, renderHook, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act as reactAct } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CONFIG,
  cardKind,
  createInitialState,
  reducer,
  type CardId,
  type GameState,
} from '../src/engine';
import { useGameStore } from '../src/store/game-store';
import { cardAriaLabel, cardHint, cardLabel, translate, useLanguage } from '../src/i18n';
import { RoomMirror } from '../src/ui/phaser/RoomMirror';
import { WeaponReadout } from '../src/ui/phaser/WeaponReadout';
import { CardSelectionControl } from '../src/ui/phaser/CardSelectionControl';
import { useCardHover, type PlayTableHandle } from '../src/ui/phaser/use-card-hover';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  // These tests assert the English UI (app defaults to Chinese).
  reactAct(() => useLanguage.setState({ lang: 'en', setting: 'en' }));
  reactAct(() => useGameStore.getState().reset());
});

const isWeapon = (c: CardId) => cardKind(c) === 'weapon';
const isMonster = (c: CardId) => cardKind(c) === 'monster';

function dealRoom(seed: string): GameState {
  return reducer(createInitialState(seed, DEFAULT_CONFIG), { type: 'DealRoom' }).state;
}

function findSeed(predicate: (room: CardId[]) => boolean): string {
  for (let i = 0; i < 500; i++) {
    const seed = `t${i}`;
    const room = createInitialState(seed, DEFAULT_CONFIG).dungeon.slice(0, 4);
    if (predicate(room)) return seed;
  }
  throw new Error('no seed matched');
}

// ---------------------------------------------------------------------------
// RoomMirror
// ---------------------------------------------------------------------------

describe('RoomMirror', () => {
  it('mirrors the room with data-card-id nodes, aria-hidden and non-focusable', () => {
    const game = dealRoom('mirrortest');
    const { container } = render(<RoomMirror game={game} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('room');
    expect(root.getAttribute('aria-hidden')).toBe('true');

    const ids = Array.from(root.querySelectorAll('[data-card-id]')).map(
      (el) => (el as HTMLElement).dataset.cardId,
    );
    expect(ids).toEqual(game.room);
    expect(root.querySelectorAll('.mirror-card')).toHaveLength(4);

    // Non-focusable: no buttons, no tabindex anywhere in the mirror.
    expect(root.querySelector('button, [tabindex]')).toBeNull();
  });

  it('forwards clicks to selectCard with PlayScreen toggle semantics', () => {
    const game = dealRoom('mirrorclick');
    const { container } = render(<RoomMirror game={game} />);
    const first = container.querySelector(`[data-card-id="${game.room[0]}"]`) as HTMLElement;

    fireEvent.click(first);
    expect(useGameStore.getState().selectedCardId).toBe(game.room[0]);
    expect(
      (container.querySelector(`[data-card-id="${game.room[0]}"]`) as HTMLElement).dataset.selected,
    ).toBe('true');
    expect(container.querySelector('.selected-ring')).not.toBeNull();

    // Clicking the selected card again deselects (exact PlayScreen semantics).
    fireEvent.click(first);
    expect(useGameStore.getState().selectedCardId).toBeNull();

    // Selecting another card moves the selection instead of stacking it.
    const second = container.querySelector(`[data-card-id="${game.room[1]}"]`) as HTMLElement;
    fireEvent.click(second);
    expect(useGameStore.getState().selectedCardId).toBe(game.room[1]);
  });

  it('badges the carried card', () => {
    const game = dealRoom('mirrorcarry');
    const { container } = render(<RoomMirror game={{ ...game, carriedCardId: game.room[2]! }} />);
    expect(container.querySelectorAll('.carried-badge')).toHaveLength(1);
    expect(container.querySelector('.carried-badge')!.textContent).toBe(
      translate('en', 'carriedBadge'),
    );
  });
});

// ---------------------------------------------------------------------------
// CardSelectionControl
// ---------------------------------------------------------------------------

describe('CardSelectionControl', () => {
  it('cycles the store selection with arrow keys and announces the card name', async () => {
    const user = userEvent.setup();
    const game = dealRoom('kbselect');
    const { container } = render(<CardSelectionControl game={game} />);

    const control = container.firstElementChild as HTMLElement;
    expect(control.getAttribute('data-selected-card-id')).toBeNull();
    control.focus();

    // No selection yet: the first arrow selects the first room card.
    await user.keyboard('{ArrowRight}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[0]);
    expect(control.getAttribute('data-selected-card-id')).toBe(game.room[0]);
    expect(screen.getByText(cardLabel(game.room[0]!))).toBeInTheDocument();

    // Wrapping cycle.
    await user.keyboard('{ArrowRight}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[1]);
    await user.keyboard('{ArrowLeft}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[0]);
    await user.keyboard('{ArrowLeft}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[game.room.length - 1]);

    await user.keyboard('{Home}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[0]);
    await user.keyboard('{End}');
    expect(useGameStore.getState().selectedCardId).toBe(game.room[game.room.length - 1]);
  });

  it('shows the selected card hint in DOM and Escape clears the selection', async () => {
    const user = userEvent.setup();
    const game = dealRoom('kbhint');
    const { container } = render(<CardSelectionControl game={game} />);
    const control = container.firstElementChild as HTMLElement;
    control.focus();

    expect(container.querySelector('.selection-hint')).toBeNull();
    await user.keyboard('{ArrowRight}');
    const hint = container.querySelector('.selection-hint') as HTMLElement;
    expect(hint.textContent).toBe(cardHint(game.room[0]!));

    await user.keyboard('{Escape}');
    expect(useGameStore.getState().selectedCardId).toBeNull();
    expect(container.querySelector('.selection-hint')).toBeNull();
    expect(control.getAttribute('data-selected-card-id')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// WeaponReadout
// ---------------------------------------------------------------------------

describe('WeaponReadout', () => {
  it('shows the empty state with no weapon and no kills', () => {
    const game = dealRoom('wreadempty');
    const { container } = render(<WeaponReadout game={game} />);
    expect(container.querySelector('.weapon-empty')!.textContent).toBe(
      translate('en', 'weaponEmpty'),
    );
  });

  it('carries the weapon id on .weapon-card and the threshold/count text', () => {
    const seed = findSeed((room) => room.some(isWeapon));
    let game = dealRoom(seed);
    const weapon = game.room.find(isWeapon)!;
    game = reducer(game, { type: 'EquipWeapon', cardId: weapon }).state;

    const { container } = render(<WeaponReadout game={game} />);
    const weaponCard = container.querySelector('.weapon-card') as HTMLElement;
    expect(weaponCard.getAttribute('data-card-id')).toBe(weapon);

    // Fresh weapon, no kills: fights any monster, zero kills counted.
    expect(container.textContent).toContain(translate('en', 'fightsAny'));
    expect(container.textContent).toContain(translate('en', 'killCount', { count: 0 }));
    expect(container.textContent).toContain(
      translate('en', 'noKillsFresh', { weapon: cardLabel(weapon) }),
    );
  });

  it('keeps kill-stack list semantics, per-kill labels, and the last-kill badge', () => {
    const seed = findSeed((room) => room.some(isWeapon) && room.some(isMonster));
    let game = dealRoom(seed);
    const weapon = game.room.find(isWeapon)!;
    const monster = game.room.find(isMonster)!;
    game = reducer(game, { type: 'EquipWeapon', cardId: weapon }).state;
    game = reducer(game, { type: 'FightMonster', cardId: monster }).state;

    const { container } = render(<WeaponReadout game={game} />);

    const list = container.querySelector('[role="list"]') as HTMLElement;
    expect(list.getAttribute('aria-label')).toBe(translate('en', 'slainAria'));
    const items = Array.from(list.querySelectorAll('[role="listitem"]')) as HTMLElement[];
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute('aria-label')).toBe(cardAriaLabel(monster));
    expect(items[0]!.querySelector('.last-kill-badge')!.textContent).toBe(
      translate('en', 'lastKillBadge'),
    );
    expect(container.querySelector('.weapon-card')!.getAttribute('data-card-id')).toBe(weapon);
    expect(container.textContent).toContain(translate('en', 'killCount', { count: 1 }));
  });
});

// ---------------------------------------------------------------------------
// useCardHover
// ---------------------------------------------------------------------------

describe('useCardHover', () => {
  function stubHandle(): {
    handle: PlayTableHandle;
    fire: (cardId: CardId | null) => void;
    unsub: ReturnType<typeof vi.fn>;
  } {
    let listener: ((cardId: CardId | null) => void) | undefined;
    const unsub = vi.fn();
    const handle: PlayTableHandle = {
      destroy: () => undefined,
      whenReady: () => Promise.resolve(),
      onHover: (cb) => {
        listener = cb;
        return unsub;
      },
      snapshot: () => Promise.resolve(''),
      // Phase 2 motion-era members (unused by the hover hook under test here).
      onRunEnded: () => () => undefined,
      setReducedMotion: () => undefined,
    };
    return { handle, fire: (cardId) => listener?.(cardId), unsub };
  }

  it('forwards sprite hover to the cursor position and clears on leave', () => {
    const { handle, fire } = stubHandle();
    const { result } = renderHook(() => useCardHover(handle));

    expect(result.current).toBeNull();
    act(() => fire('heart-3'));
    expect(result.current?.cardId).toBe('heart-3');
    act(() => fire(null));
    expect(result.current).toBeNull();
  });

  it('unsubscribes from the handle on unmount', () => {
    const { handle, unsub } = stubHandle();
    const { unmount } = renderHook(() => useCardHover(handle));
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
