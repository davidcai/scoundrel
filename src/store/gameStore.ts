import { create } from 'zustand';
import type { Action, CardId, GameConfig, GameState, Result } from '../engine';
import { cardLabel, createInitialState, reducer } from '../engine';
import { loadRun, loadSettings, saveRun } from './persistence';
import { buildRunRecord, loadStats, recordRun, saveStats } from './stats';

function describeResult(result: Result): string {
  switch (result.type) {
    case 'MonsterDefeated': {
      const via = result.usedWeaponId ? ' with ' + cardLabel(result.usedWeaponId) : ' barehanded';
      return 'Defeated monster' + via + ', took ' + result.damage + ' damage.';
    }
    case 'WeaponEquipped':
      return 'Equipped ' + cardLabel(result.cardId) + '.';
    case 'PotionQuaffed':
      return result.wasted ? 'Potion wasted (one per room).' : 'Healed ' + result.healed + ' HP.';
    case 'RanAway':
      return 'Ran away; a new room was dealt.';
    case 'RunAwayBlocked':
      return result.reason === 'twice-in-row'
        ? 'Cannot run from two rooms in a row.'
        : 'Not enough cards left to run away.';
    case 'RoomDealt':
      return 'New room dealt.';
    case 'UndoDone':
      return 'Room restored to its start.';
    case 'GameWon':
      return 'You won! Final score: ' + result.score + '.';
    case 'GameLost':
      return 'You lost. Final score: ' + result.score + '.';
    case 'InvalidAction':
      return 'That action is not allowed.';
  }
}

export interface GameStoreState {
  state: GameState | null;
  selectedCardId: CardId | null;
  /** Cards carried over from the previous room (UI hint; not engine truth). */
  carriedCardIds: CardId[];
  announcement: string;
  hydrate: () => void;
  startRun: (seed: string, config?: GameConfig) => void;
  select: (cardId: CardId | null) => void;
  fight: (cardId: CardId, barehanded: boolean) => void;
  drink: (cardId: CardId) => void;
  equip: (cardId: CardId) => void;
  runAway: () => void;
  undo: () => void;
  enterNextRoom: () => void;
  returnToTitle: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  function apply(action: Action): void {
    const current = get().state;
    if (!current) return;
    const { state, result } = reducer(current, action);
    set({
      state,
      selectedCardId: null,
      announcement: describeResult(result),
      carriedCardIds: result.type === 'RoomDealt' ? (result.carriedFrom ?? []) : get().carriedCardIds,
    });
    if (state.phase === 'playing') {
      saveRun({ state, terminalOutcome: null, statsWritten: false });
    } else {
      persistTerminal(state, result);
    }
  }

  function persistTerminal(state: GameState, result: Result): void {
    const outcome = result.type === 'GameWon' ? 'won' : 'lost';
    const score = result.type === 'GameWon' || result.type === 'GameLost' ? result.score : 0;
    const existing = loadRun();
    let statsWritten = existing?.statsWritten ?? false;
    if (!statsWritten) {
      saveStats(recordRun(loadStats(), buildRunRecord(state, outcome, score)));
      statsWritten = true;
    }
    saveRun({ state, terminalOutcome: { outcome, score }, statsWritten });
  }

  return {
    state: null,
    selectedCardId: null,
    carriedCardIds: [],
    announcement: '',

    hydrate: () => {
      const run = loadRun();
      if (run) set({ state: run.state });
    },

    startRun: (seed, config) => {
      const cfg = config ?? loadSettings();
      const state = createInitialState(seed, cfg);
      saveRun({ state, terminalOutcome: null, statsWritten: false });
      set({ state, selectedCardId: null, carriedCardIds: [], announcement: 'New run started.' });
    },

    select: (cardId) => set({ selectedCardId: cardId }),
    fight: (cardId, barehanded) => apply({ type: 'FightMonster', cardId, barehanded }),
    drink: (cardId) => apply({ type: 'DrinkPotion', cardId }),
    equip: (cardId) => apply({ type: 'EquipWeapon', cardId }),
    runAway: () => apply({ type: 'RunAway' }),
    undo: () => apply({ type: 'UndoToRoomStart' }),
    enterNextRoom: () => apply({ type: 'EnterNextRoom' }),

    returnToTitle: () => {
      set({ selectedCardId: null, announcement: '' });
    },
  };
});
