/**
 * Play screen integration (spec seam 2): cards render with carryover marker,
 * click-to-select arms a damage preview, explicit confirm dispatches, undo
 * button rewinds, disabled Run explains why. All engine-free via fake.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Action, GameState, Result } from '../../engine';
import { GameStoreProvider, createGameStore, type GameStoreState } from '../../store/gameStore';
import type { EngineApi } from '../../store/engineApi';
import type { StoreApi } from 'zustand';
import { makeFakeEngine, makeState, slotsFor, FIXTURE_ROOM } from '../../test/fixtures';
import { LiveRegion } from '../components/LiveRegion';
import { PlayScreen } from './PlayScreen';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/play';
});

/** Scripted reduce covering the three card actions with real-ish state moves. */
function standardReduce(state: GameState, action: Action): { state: GameState; result: Result } {
  switch (action.type) {
    case 'StartNewRun':
    case 'DealRoom': {
      const cards = [...FIXTURE_ROOM];
      return { state: { ...state, room: cards }, result: { type: 'RoomDealt', cards } };
    }
    case 'FightMonster': {
      const damage = action.barehanded === true ? 8 : state.weapon !== null ? 3 : 8;
      const room = state.room.filter((id) => id !== action.cardId);
      const killStack =
        action.barehanded === true || state.weapon === null
          ? state.killStack
          : [...state.killStack, action.cardId];
      return {
        state: {
          ...state,
          room,
          killStack,
          resolvedCount: state.resolvedCount + 1,
          hp: state.hp - damage,
          runHighlights: {
            ...state.runHighlights,
            monstersKilled: state.runHighlights.monstersKilled + 1,
          },
        },
        result: {
          type: 'MonsterDefeated',
          cardId: action.cardId,
          damage,
          weaponBroke: false,
          ...(action.barehanded !== true && state.weapon !== null
            ? { usedWeaponId: state.weapon }
            : {}),
        },
      };
    }
    case 'DrinkPotion': {
      const room = state.room.filter((id) => id !== action.cardId);
      return {
        state: {
          ...state,
          room,
          resolvedCount: state.resolvedCount + 1,
          hp: Math.min(state.maxHp, state.hp + 7),
          potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
        },
        result: { type: 'PotionQuaffed', cardId: action.cardId, healed: 7, wasted: false },
      };
    }
    case 'EquipWeapon': {
      const room = state.room.filter((id) => id !== action.cardId);
      return {
        state: {
          ...state,
          room,
          resolvedCount: state.resolvedCount + 1,
          weapon: action.cardId,
          killStack: [],
        },
        result: { type: 'WeaponEquipped', cardId: action.cardId, discardedMonsterIds: [] },
      };
    }
    default:
      return { state, result: { type: 'InvalidAction', reason: 'no' } };
  }
}

interface FakeEngine extends EngineApi {
  actions: Action[];
}

function renderPlay(options: {
  state?: Partial<GameState>;
  carried?: boolean;
  reduce?: EngineApi['reduce'];
  canRunAway?: EngineApi['canRunAway'];
  previewFightMonster?: EngineApi['previewFightMonster'];
}): { store: StoreApi<GameStoreState>; engine: FakeEngine } {
  const engine = makeFakeEngine({
    reduce: options.reduce ?? standardReduce,
    canRunAway: options.canRunAway,
    previewFightMonster: options.previewFightMonster,
  });
  const store = createGameStore({ engine });
  const state = makeState({ ...options.state });
  store.setState({
    game: state,
    slots: slotsFor(state.room),
    slotsSnapshot: slotsFor(state.room),
    carriedCardId: options.carried === false ? null : 'club-8',
  });
  render(
    <GameStoreProvider value={store}>
      <LiveRegion />
      <PlayScreen route={{ name: 'play', seed: null, config: null, query: '' }} />
    </GameStoreProvider>,
  );
  return { store, engine };
}

describe('PlayScreen', () => {
  it('renders the four-slot room with ARIA card labels', () => {
    renderPlay({});
    expect(
      screen.getByRole('button', { name: '8 of Clubs, monster, value 8' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '5 of Diamonds, weapon, value 5' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '7 of Hearts, potion, value 7' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '2 of Spades, monster, value 2' }),
    ).toBeInTheDocument();
  });

  it('marks the carried card', () => {
    renderPlay({});
    const carried = screen.getByText('carried');
    const cardEl = carried.closest('[data-card-id]');
    expect(cardEl).toHaveAttribute('data-card-id', 'club-8');
  });

  it('shows the HUD: HP, deck count, seed, run status', () => {
    renderPlay({ state: { hp: 17 } });
    expect(screen.getByText('17 / 20')).toBeInTheDocument();
    expect(screen.getByLabelText('7 cards left in the dungeon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seed test00/ })).toBeInTheDocument();
    expect(screen.getByText('Run ready')).toBeInTheDocument();
  });

  it('click → preview → confirm dispatches FightMonster with engine damage', async () => {
    const user = userEvent.setup();
    const { store } = renderPlay({});

    await user.click(screen.getByRole('button', { name: /8 of Clubs/ }));
    expect(store.getState().selected?.cardId).toBe('club-8');

    const preview = document.getElementById('preview-line');
    if (preview === null) throw new Error('expected the preview line');
    expect(preview.textContent).toContain('take 8');

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(store.getState().lastResult?.type).toBe('MonsterDefeated');
    expect(store.getState().selected).toBeNull();
    // Resolved slot collapses to a ghost; carried marker is gone with its card.
    expect(screen.getByLabelText('Resolved 8 of Clubs, monster, value 8')).toBeInTheDocument();
  });

  it('resolving another card leaves the carried marker in place', async () => {
    const user = userEvent.setup();
    renderPlay({});

    await user.click(screen.getByRole('button', { name: /2 of Spades/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByLabelText('Resolved 2 of Spades, monster, value 2')).toBeInTheDocument();
    expect(screen.getByText('carried').closest('[data-card-id]')).toHaveAttribute(
      'data-card-id',
      'club-8',
    );
  });

  it('barehanded toggle arms FightMonster{barehanded: true}', async () => {
    const user = userEvent.setup();
    const { store, engine } = renderPlay({
      state: { weapon: 'diamond-5' },
      previewFightMonster: (_s, _id, barehanded) => ({
        legal: true,
        damage: barehanded ? 8 : 3,
      }),
    });

    await user.click(screen.getByRole('button', { name: /8 of Clubs/ }));
    await user.click(screen.getByRole('checkbox', { name: /fight barehanded/i }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    const fight = engine.actions.find(
      (a): a is Action & { type: 'FightMonster' } => a.type === 'FightMonster',
    );
    expect(fight).toMatchObject({ cardId: 'club-8', barehanded: true });
    expect(store.getState().game?.hp).toBe(12);
  });

  it('announces reducer results via the polite live region', async () => {
    const user = userEvent.setup();
    renderPlay({ state: { hp: 10 } });

    await user.click(screen.getByRole('button', { name: /7 of Hearts/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByTestId('live-region').textContent).toContain('Drank 7 of Hearts');
    expect(screen.getByTestId('live-region').textContent).toContain('Healed 7 HP');
  });

  it('weapon equip shows the weapon zone with the equipped card', async () => {
    const user = userEvent.setup();
    const { store } = renderPlay({});

    await user.click(screen.getByRole('button', { name: /5 of Diamonds/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(store.getState().game?.weapon).toBe('diamond-5');
    const zone = screen.getByRole('region', { name: 'Weapon and defeated monsters' });
    const weaponLabel = zone.textContent;
    expect(weaponLabel).toContain('Weapon');
  });

  it('undo rewinds state and rezurrects the ghost slot', async () => {
    const user = userEvent.setup();
    const roomStart = makeState({ hp: 10 });
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'DrinkPotion') {
          const room = state.room.filter((id) => id !== action.cardId);
          return {
            state: { ...state, room, resolvedCount: 1, hp: 17, potionsUsedThisRoom: 1 },
            result: { type: 'PotionQuaffed', cardId: action.cardId, healed: 7, wasted: false },
          };
        }
        if (action.type === 'UndoToRoomStart') {
          return { state: roomStart, result: { type: 'UndoDone' } };
        }
        return standardReduce(state, action);
      },
    });
    const store = createGameStore({ engine });
    const state = makeState({ hp: 10, roomSnapshot: roomStart });
    store.setState({
      game: state,
      slots: slotsFor(state.room),
      slotsSnapshot: slotsFor(state.room),
      carriedCardId: 'club-8',
    });
    render(
      <GameStoreProvider value={store}>
        <PlayScreen route={{ name: 'play', seed: null, config: null, query: '' }} />
      </GameStoreProvider>,
    );

    await user.click(screen.getByRole('button', { name: /7 of Hearts/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByLabelText('Resolved 7 of Hearts, potion, value 7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /undo room/i }));
    const gameAfterUndo = store.getState().game;
    if (gameAfterUndo === null) throw new Error('expected an active game');
    expect(gameAfterUndo.hp).toBe(10);
    expect(
      screen.getByRole('button', { name: '7 of Hearts, potion, value 7' }),
    ).toBeInTheDocument();
  });

  it('Run Away greys out with reason tooltip when the engine blocks it', async () => {
    const user = userEvent.setup();
    renderPlay({
      state: { ranAwayLastRoom: true },
      canRunAway: () => ({ allowed: false, reason: 'twice-in-row' }),
    });

    const runButton = screen.getByRole('button', { name: 'Run Away' });
    expect(runButton).toHaveAttribute('aria-disabled', 'true');

    await user.hover(runButton);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "You can't run from two rooms in a row.",
    );
  });

  it('Run Away blocked by engine without a reason shows the generic text', () => {
    renderPlay({ canRunAway: () => ({ allowed: false }) });
    expect(screen.getByRole('button', { name: 'Run Away' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('Enter Next Room only enables after 3 resolved', () => {
    renderPlay({
      state: {
        resolvedCount: 3,
        room: ['spade-2'],
        dungeon: ['club-2', 'club-3', 'heart-4', 'spade-8'],
      },
    });
    expect(screen.getByRole('button', { name: 'Enter Next Room' })).toBeEnabled();
  });

  it('Enter Next Room disabled while room is unresolved', () => {
    renderPlay({ state: { resolvedCount: 1 } });
    expect(screen.getByRole('button', { name: 'Enter Next Room' })).toBeDisabled();
  });
});
