import { create } from 'zustand';
import type {
  Card,
  GameState,
  Rank,
  RoomCard,
  WeaponState,
} from './types';
import {
  MAX_HEALTH,
  calculateHeal,
  calculateLoseScore,
  calculateWinScore,
  canWeaponFightMonster,
  cardsNeededToResolve,
  createShuffledDeck,
  getCardType,
  getRemainingMonstersFromDeck,
  resolveCombat,
} from './logic';

const ROOM_SIZE = 4;

function dealRoom(deck: Card[], carryOverCard: Card | null): {
  room: RoomCard[];
  remainingDeck: Card[];
} {
  const available = carryOverCard ? [carryOverCard, ...deck] : [...deck];
  const roomCards = available.splice(0, ROOM_SIZE);
  const room: RoomCard[] = roomCards.map((card) => ({
    card,
    status: 'unresolved' as const,
  }));
  return { room, remainingDeck: available };
}

function checkGameEnd(state: GameState): Partial<GameState> {
  const { deck, room, health, cardsResolvedThisRoom } = state;
  const needed = cardsNeededToResolve(room.length);

  if (health <= 0) {
    const monsters = [
      ...getRemainingMonstersFromDeck(deck),
      ...room
        .filter((rc) => rc.status === 'unresolved' && getCardType(rc.card) === 'monster')
        .map((rc) => rc.card),
    ];
    return {
      phase: 'lost',
      score: calculateLoseScore(monsters),
    };
  }

  if (deck.length === 0 && cardsResolvedThisRoom >= needed) {
    return {
      phase: 'won',
      score: calculateWinScore(health),
    };
  }

  return {};
}

interface GameStore extends GameState {
  startGame: () => void;
  fightMonster: (roomCardIndex: number, useWeapon: boolean) => void;
  usePotion: (roomCardIndex: number) => void;
  equipWeapon: (roomCardIndex: number) => void;
  runAway: () => void;
  reset: () => void;
}

const initialState: GameState = {
  phase: 'start',
  deck: [],
  room: [],
  health: MAX_HEALTH,
  weapon: null,
  canRunAway: true,
  potionUsedThisRoom: false,
  carriedOverCardId: null,
  cardsResolvedThisRoom: 0,
  score: 0,
  log: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  startGame: () => {
    const deck = createShuffledDeck();
    const { room, remainingDeck } = dealRoom(deck, null);
    set({
      ...initialState,
      phase: 'playing',
      deck: remainingDeck,
      room,
      log: ['You enter the dungeon...'],
    });
  },

  fightMonster: (roomCardIndex: number, useWeapon: boolean) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const roomCard = state.room[roomCardIndex];
    if (!roomCard || roomCard.status !== 'unresolved') return;
    if (getCardType(roomCard.card) !== 'monster') return;

    const combat = resolveCombat(
      roomCard.card,
      useWeapon ? state.weapon : null,
    );

    const newHealth = state.health - combat.damage;

    let newWeapon: WeaponState | null = state.weapon;
    if (combat.usedWeapon && state.weapon) {
      newWeapon = {
        ...state.weapon,
        lastKilledValue: roomCard.card.rank as Rank,
        defeatedMonsters: [...state.weapon.defeatedMonsters, roomCard.card],
      };
    }

    const newRoom = state.room.map((rc, i) =>
      i === roomCardIndex ? { ...rc, status: 'resolved' as const } : rc,
    );

    const cardsResolvedThisRoom = state.cardsResolvedThisRoom + 1;
    const needed = cardsNeededToResolve(newRoom.length);

    let patch: Partial<GameState> = {
      health: newHealth,
      weapon: newWeapon,
      room: newRoom,
      cardsResolvedThisRoom,
      log: [
        ...state.log,
        combat.usedWeapon
          ? `Defeated ${roomCard.card.rank} monster with weapon (took ${combat.damage} damage)`
          : `Defeated ${roomCard.card.rank} monster barehanded (took ${combat.damage} damage)`,
      ],
    };

    const endCheck = checkGameEnd({
      ...state,
      ...patch,
    });
    patch = { ...patch, ...endCheck };

    if (
      !endCheck.phase &&
      cardsResolvedThisRoom >= needed &&
      state.deck.length > 0
    ) {
      const carryOverCard = newRoom.find((rc) => rc.status === 'unresolved');
      const { room: nextRoom, remainingDeck } = dealRoom(
        state.deck,
        carryOverCard ? carryOverCard.card : null,
      );

      patch = {
        ...patch,
        deck: remainingDeck,
        room: nextRoom,
        canRunAway: true,
        potionUsedThisRoom: false,
        carriedOverCardId: carryOverCard ? carryOverCard.card.id : null,
        cardsResolvedThisRoom: 0,
      };
    }

    set(patch);
  },

  usePotion: (roomCardIndex: number) => {
    const state = get();
    if (state.phase !== 'playing') return;
    if (state.potionUsedThisRoom) return;

    const roomCard = state.room[roomCardIndex];
    if (!roomCard || roomCard.status !== 'unresolved') return;
    if (getCardType(roomCard.card) !== 'potion') return;

    const healAmount = calculateHeal(roomCard.card, state.health);
    const newHealth = state.health + healAmount;

    const newRoom = state.room.map((rc, i) =>
      i === roomCardIndex ? { ...rc, status: 'resolved' as const } : rc,
    );

    const cardsResolvedThisRoom = state.cardsResolvedThisRoom + 1;
    const needed = cardsNeededToResolve(newRoom.length);

    let patch: Partial<GameState> = {
      health: newHealth,
      room: newRoom,
      potionUsedThisRoom: true,
      cardsResolvedThisRoom,
      log: [
        ...state.log,
        `Drank health potion (healed ${healAmount} HP)`,
      ],
    };

    const endCheck = checkGameEnd({
      ...state,
      ...patch,
    });
    patch = { ...patch, ...endCheck };

    if (
      !endCheck.phase &&
      cardsResolvedThisRoom >= needed &&
      state.deck.length > 0
    ) {
      const carryOverCard = newRoom.find((rc) => rc.status === 'unresolved');
      const { room: nextRoom, remainingDeck } = dealRoom(
        state.deck,
        carryOverCard ? carryOverCard.card : null,
      );

      patch = {
        ...patch,
        deck: remainingDeck,
        room: nextRoom,
        canRunAway: true,
        potionUsedThisRoom: false,
        carriedOverCardId: carryOverCard ? carryOverCard.card.id : null,
        cardsResolvedThisRoom: 0,
      };
    }

    set(patch);
  },

  equipWeapon: (roomCardIndex: number) => {
    const state = get();
    if (state.phase !== 'playing') return;

    const roomCard = state.room[roomCardIndex];
    if (!roomCard || roomCard.status !== 'unresolved') return;
    if (getCardType(roomCard.card) !== 'weapon') return;

    const newWeapon: WeaponState = {
      card: roomCard.card,
      lastKilledValue: null,
      defeatedMonsters: [],
    };

    const newRoom = state.room.map((rc, i) =>
      i === roomCardIndex ? { ...rc, status: 'resolved' as const } : rc,
    );

    const cardsResolvedThisRoom = state.cardsResolvedThisRoom + 1;
    const needed = cardsNeededToResolve(newRoom.length);

    let patch: Partial<GameState> = {
      weapon: newWeapon,
      room: newRoom,
      cardsResolvedThisRoom,
      log: state.weapon
        ? [
            ...state.log,
            `Switched weapon to ${roomCard.card.rank} (old weapon discarded)`,
          ]
        : [...state.log, `Equipped weapon: ${roomCard.card.rank}`],
    };

    const endCheck = checkGameEnd({
      ...state,
      ...patch,
    });
    patch = { ...patch, ...endCheck };

    if (
      !endCheck.phase &&
      cardsResolvedThisRoom >= needed &&
      state.deck.length > 0
    ) {
      const carryOverCard = newRoom.find((rc) => rc.status === 'unresolved');
      const { room: nextRoom, remainingDeck } = dealRoom(
        state.deck,
        carryOverCard ? carryOverCard.card : null,
      );

      patch = {
        ...patch,
        deck: remainingDeck,
        room: nextRoom,
        canRunAway: true,
        potionUsedThisRoom: false,
        carriedOverCardId: carryOverCard ? carryOverCard.card.id : null,
        cardsResolvedThisRoom: 0,
      };
    }

    set(patch);
  },

  runAway: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    if (!state.canRunAway) return;
    if (state.cardsResolvedThisRoom > 0) return;

    const roomCards = state.room.map((rc) => rc.card);
    const newDeck = [...state.deck, ...roomCards];
    const { room: nextRoom, remainingDeck } = dealRoom(newDeck, null);

    set({
      deck: remainingDeck,
      room: nextRoom,
      canRunAway: false,
      potionUsedThisRoom: false,
      carriedOverCardId: null,
      cardsResolvedThisRoom: 0,
      log: [...state.log, 'You fled the room!'],
    });
  },

  reset: () => {
    set(initialState);
  },
}));

export { canWeaponFightMonster, getCardType, MAX_HEALTH, ROOM_SIZE };
