import { create } from 'zustand';
import {
  createInitialState,
  finalScore,
  reducer,
  type CardId,
  type GameAction,
  type GameConfig,
  type GameState,
} from '../engine';
import { announce } from './announcements';
import { t } from '../i18n';
import { STORAGE_KEYS, load, migrateVersion, remove, save } from './persistence';
import { loadStats, recordRun, saveStats, type RunRecord } from './stats';

/** Persisted run: engine state + the idempotency flag guarding the stats write. */
export interface RunSave {
  state: GameState;
  statsWritten: boolean;
}

function isRunSave(value: unknown): value is RunSave {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.state === 'object' && v.state !== null && typeof v.statsWritten === 'boolean';
}

function readRunSave(raw: unknown): RunSave | null {
  return isRunSave(raw) ? raw : null;
}

export function loadRunSave(): RunSave | null {
  return load<RunSave>(STORAGE_KEYS.run, migrateVersion(1, readRunSave));
}

function persistRun(state: GameState, statsWritten: boolean): void {
  save<RunSave>(STORAGE_KEYS.run, { state, statsWritten });
}

export function clearRunSave(): void {
  remove(STORAGE_KEYS.run);
}

export interface Announcement {
  message: string;
  /** Monotonic id so the live region re-announces identical messages. */
  id: number;
}

interface GameStore {
  game: GameState | null;
  /** Transient UI state — intentionally NOT engine truth. */
  selectedCardId: CardId | null;
  announcement: Announcement | null;
  statsWritten: boolean;
  startRun: (seed: string, config: GameConfig) => void;
  act: (action: GameAction) => void;
  selectCard: (cardId: CardId | null) => void;
  /** Abandon an in-progress run (explicit user choice). */
  abandonRun: () => void;
  /** Leave a finished run: the terminal outcome was already recorded. */
  finishRun: () => void;
  hydrate: () => void;
  /** Test/reset helper: return the store to its pristine state. */
  reset: () => void;
}

let announcementSeq = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedCardId: null,
  announcement: null,
  statsWritten: false,

  startRun: (seed, config) => {
    const fresh = createInitialState(seed, config, Date.now());
    const { state, result } = reducer(fresh, { type: 'DealRoom' });
    persistRun(state, false);
    set({
      game: state,
      selectedCardId: null,
      statsWritten: false,
      announcement: {
        message: `${t('announceRunStarted', { seed: state.seed })} ${announce(result, state)}`,
        id: ++announcementSeq,
      },
    });
  },

  act: (action) => {
    const game = get().game;
    if (game === null) return;
    const { state, result } = reducer(game, action);
    let statsWritten = get().statsWritten;

    if (
      (result.type === 'GameWon' || result.type === 'GameLost') &&
      !statsWritten &&
      state.phase !== 'playing'
    ) {
      const record: RunRecord = {
        seed: state.seed,
        config: state.config,
        outcome: state.phase === 'won' ? 'won' : 'lost',
        score: finalScore(state),
        date: Date.now(),
        roomsCleared: state.runHighlights.roomsExplored,
      };
      saveStats(recordRun(loadStats(), record));
      statsWritten = true;
    }

    persistRun(state, statsWritten);
    set({
      game: state,
      statsWritten,
      // Resolving or fleeing a card invalidates the old selection.
      selectedCardId: action.type === 'UndoToRoomStart' ? null : get().selectedCardId,
      announcement: { message: announce(result, state), id: ++announcementSeq },
    });
  },

  selectCard: (cardId) => set({ selectedCardId: cardId }),

  abandonRun: () => {
    clearRunSave();
    set({ game: null, selectedCardId: null, announcement: null, statsWritten: false });
  },

  finishRun: () => {
    clearRunSave();
    set({ game: null, selectedCardId: null, announcement: null, statsWritten: false });
  },

  hydrate: () => {
    // Only restore from storage when nothing is in memory: when a seeded URL
    // starts (or restarts) a run on page load, startRun has already populated
    // the store and announced the room — hydrate must not clobber that.
    if (get().game !== null) return;
    const saved = loadRunSave();
    if (saved !== null) {
      set({
        game: saved.state,
        statsWritten: saved.statsWritten,
        selectedCardId: null,
        announcement: null,
      });
    }
  },

  reset: () => {
    set({ game: null, selectedCardId: null, announcement: null, statsWritten: false });
  },
}));
