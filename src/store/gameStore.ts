/**
 * Zustand game store — the wiring layer between the pure engine and React.
 *
 * Canonical splits from the spec:
 *  - Selection lives HERE, never in GameState (Q45b). Snapshots and persisted
 *    run records therefore exclude ephemeral selection state (Q37).
 *  - All rule behavior goes through the injected EngineApi; the store never
 *    reimplements combat math.
 *  - Undo is the engine's single current-room snapshot (roomSnapshot inside
 *    GameState); the store mirrors a UI slot layout (for ghost slots) with the
 *    same snapshot discipline.
 *  - Terminal results write the stats record exactly once, guarded by the
 *    stats-written flag persisted in the run record (Q43).
 */
import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import type { Action, CardId, GameConfig, GameState, Result } from '../engine';
import { kindOfId } from '../ui/cards/cardMeta';
import {
  clearRunRecord,
  loadRun,
  saveRun,
  type RunOutcome,
  type SlotCard,
} from '../persistence/run';
import { recordRunPersisted } from '../persistence/stats';
import { defaultEngine, type EngineApi } from './engineApi';

export interface Selection {
  cardId: CardId;
  barehanded: boolean;
}

export interface GameStoreState {
  /** The injected engine (stable per store; consumed by preview/canRunAway). */
  engine: EngineApi;
  game: GameState | null;
  /** Room display slots (ghost slots keep identity), aligned with the deal. */
  slots: SlotCard[];
  slotsSnapshot: SlotCard[] | null;
  carriedCardId: CardId | null;
  selected: Selection | null;
  lastResult: Result | null;
  /** Bumped on every reducer result so identical announcements re-announce. */
  resultSeq: number;
  outcome: RunOutcome | null;
  statsWritten: boolean;

  newRun: (seed: string, config: GameConfig) => void;
  loadSavedRun: () => boolean;
  backToTitle: () => void;
  selectCard: (cardId: CardId) => void;
  setBarehanded: (barehanded: boolean) => void;
  cancelSelection: () => void;
  confirm: () => void;
  runAway: () => void;
  undo: () => void;
  enterNextRoom: () => void;
}

export interface GameDeps {
  engine?: EngineApi;
}

/** ~6-char base36 seed (Q16a). */
export function randomSeed(): string {
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}

function slotsFromCards(cards: readonly CardId[]): SlotCard[] {
  return cards.map((cardId) => ({ cardId, resolved: false }));
}

export function createGameStore(deps: GameDeps = {}): StoreApi<GameStoreState> {
  const engine: EngineApi = deps.engine ?? defaultEngine;

  return createStore<GameStoreState>()((set, get) => {
    const persist = () => {
      const { game, slots, slotsSnapshot, carriedCardId, statsWritten, outcome } = get();
      if (game === null) return;
      saveRun({ state: game, slots, slotsSnapshot, carriedCardId, statsWritten, outcome });
    };

    /** Central reduce pipeline: every engine action flows through here. */
    const applyResult = (state: GameState, result: Result) => {
      const isTerminal = result.type === 'GameWon' || result.type === 'GameLost';
      const patch: Partial<GameStoreState> = {
        game: state,
        lastResult: result,
        resultSeq: get().resultSeq + 1,
        // Keep the selection visible when the engine rejects the action.
        selected: result.type === 'InvalidAction' ? get().selected : null,
      };

      switch (result.type) {
        case 'RoomDealt': {
          patch.slots = slotsFromCards(result.cards);
          patch.slotsSnapshot = slotsFromCards(result.cards);
          patch.carriedCardId = result.carriedFrom ?? null;
          break;
        }
        case 'RanAway': {
          patch.slots = slotsFromCards(result.newCards);
          patch.slotsSnapshot = slotsFromCards(result.newCards);
          patch.carriedCardId = null;
          break;
        }
        case 'MonsterDefeated':
        case 'PotionQuaffed':
        case 'WeaponEquipped': {
          patch.slots = get().slots.map((slot) =>
            slot.cardId === result.cardId ? { ...slot, resolved: true } : slot,
          );
          break;
        }
        case 'UndoDone': {
          const snapshot = get().slotsSnapshot;
          patch.slots = snapshot !== null ? [...snapshot] : get().slots;
          patch.selected = null;
          break;
        }
        default:
          break;
      }

      if (isTerminal) {
        const outcome: RunOutcome = {
          phase: result.type === 'GameWon' ? 'won' : 'lost',
          score: result.score,
        };
        let statsWritten = get().statsWritten;
        if (!statsWritten) {
          recordRunPersisted({
            seed: result.seed,
            config: result.config,
            outcome: outcome.phase,
            score: result.score,
            date: Date.now(),
            roomsCleared: state.runHighlights.roomsExplored,
          });
          statsWritten = true;
        }
        patch.outcome = outcome;
        patch.statsWritten = statsWritten;
        patch.selected = null;
      }

      set(patch);
      persist();
    };

    const dispatch = (action: Action) => {
      const { game } = get();
      if (game === null) return;
      const { state, result } = engine.reduce(game, action);
      applyResult(state, result);
    };

    return {
      engine,
      game: null,
      slots: [],
      slotsSnapshot: null,
      carriedCardId: null,
      selected: null,
      lastResult: null,
      resultSeq: 0,
      outcome: null,
      statsWritten: false,

      newRun: (seed, config) => {
        set({
          game: null,
          slots: [],
          slotsSnapshot: null,
          carriedCardId: null,
          selected: null,
          lastResult: null,
          outcome: null,
          statsWritten: false,
        });
        const initial = engine.createInitialState(seed, config);
        if (initial.room.length > 0) {
          // Engine dealt the first room inside createInitialState.
          const slots = slotsFromCards(initial.room);
          set({ game: initial, slots, slotsSnapshot: slots });
          persist();
          return;
        }
        set({ game: initial });
        // Contract: StartNewRun deals the first room and returns RoomDealt.
        dispatch({ type: 'StartNewRun', seed, config });
      },

      loadSavedRun: () => {
        const rec = loadRun();
        if (rec === null) return false;
        set({
          game: rec.state,
          slots: rec.slots,
          slotsSnapshot: rec.slotsSnapshot,
          carriedCardId: rec.carriedCardId,
          selected: null,
          lastResult: null,
          outcome: rec.outcome,
          statsWritten: rec.statsWritten,
        });
        return true;
      },

      backToTitle: () => {
        clearRunRecord();
        set({
          game: null,
          slots: [],
          slotsSnapshot: null,
          carriedCardId: null,
          selected: null,
          lastResult: null,
          outcome: null,
          statsWritten: false,
        });
      },

      selectCard: (cardId) => {
        const { game } = get();
        if (game === null || game.phase !== 'playing') return;
        if (!game.room.includes(cardId)) return;
        const { selected } = get();
        if (selected !== null && selected.cardId === cardId) {
          // Second click/Enter commits (style guide §5.3).
          get().confirm();
          return;
        }
        set({ selected: { cardId, barehanded: false } });
      },

      setBarehanded: (barehanded) => {
        const { selected } = get();
        if (selected === null) return;
        set({ selected: { ...selected, barehanded } });
      },

      cancelSelection: () => set({ selected: null }),

      confirm: () => {
        const { game, selected } = get();
        if (game === null || selected === null) return;
        const kind = kindOfId(selected.cardId);
        if (kind === 'monster') {
          dispatch({
            type: 'FightMonster',
            cardId: selected.cardId,
            barehanded: selected.barehanded,
          });
        } else if (kind === 'potion') {
          dispatch({ type: 'DrinkPotion', cardId: selected.cardId });
        } else {
          dispatch({ type: 'EquipWeapon', cardId: selected.cardId });
        }
      },

      runAway: () => dispatch({ type: 'RunAway' }),
      undo: () => dispatch({ type: 'UndoToRoomStart' }),
      enterNextRoom: () => dispatch({ type: 'EnterNextRoom' }),
    };
  });
}

/** App-wide default store (real engine via the frozen contract import). */
export const gameStore: StoreApi<GameStoreState> = createGameStore();

const GameStoreContext = createContext<StoreApi<GameStoreState> | null>(null);

export const GameStoreProvider = GameStoreContext.Provider;

/** The store for this tree: the provider's store in tests, the singleton in prod. */
export function useGameStoreApi(): StoreApi<GameStoreState> {
  return useContext(GameStoreContext) ?? gameStore;
}

export function useGame<T>(selector: (state: GameStoreState) => T): T {
  const store = useGameStoreApi();
  return useStore(store, selector);
}
