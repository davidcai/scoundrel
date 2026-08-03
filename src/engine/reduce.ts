import { IllegalActionError, type Action } from "./actions";
import type { Card } from "./cards";
import { isOffered, offersFor } from "./legality";
import { finalScore } from "./scoring";
import { ROOM_SIZE, MAX_HEALTH, createGame, type GameState } from "./state";

export function applyAction(state: GameState, action: Action): GameState {
  if (action.type === "NEW_GAME") return createGame(action.seed);

  if (!isOffered(state, action)) {
    throw new IllegalActionError(`Action not offered: ${JSON.stringify(action)}`);
  }

  // RUN deals its own room because it must set ranLastRoom. It bypasses settle
  // safely: it cannot change health and always leaves a full room, so neither
  // the loss nor the win condition is reachable from it.
  if (action.type === "RUN") return runAway(state);

  const card = state.room.find((c) => c.id === action.cardId);
  if (card === undefined) throw new IllegalActionError(`Card not in room: ${action.cardId}`);

  switch (action.type) {
    case "FIGHT":
      return settle(fight(state, card, action.useWeapon));
    case "DRINK":
      return settle(drink(state, card));
    case "EQUIP":
      return settle(equip(state, card));
  }
}

function fight(state: GameState, card: Card, useWeapon: boolean): GameState {
  const offer = offersFor(state, card).find(
    (candidate) => candidate.action.type === "FIGHT" && candidate.action.useWeapon === useWeapon,
  );
  if (offer === undefined || offer.effect.kind !== "damage") {
    throw new IllegalActionError(`No damage offer for ${card.id}`);
  }

  const damage = offer.effect.amount;
  const health = Math.max(0, state.health - damage);
  const { weapon } = state;
  const armed = useWeapon && weapon !== null;

  const next: GameState = armed
    ? {
        ...state,
        room: withoutCard(state.room, card),
        weapon: { card: weapon.card, kills: [...weapon.kills, card] },
        health,
      }
    : {
        ...state,
        room: withoutCard(state.room, card),
        discard: [...state.discard, card],
        health,
      };

  return appendLog(next, {
    kind: "fight",
    monster: card,
    weapon: armed ? weapon.card : null,
    damage,
    healthAfter: health,
  });
}

function drink(state: GameState, card: Card): GameState {
  const offer = offersFor(state, card)[0];
  if (offer === undefined || offer.effect.kind !== "heal") {
    throw new IllegalActionError(`No heal offer for ${card.id}`);
  }

  const { amount, blocked } = offer.effect;
  const health = Math.min(MAX_HEALTH, state.health + amount);

  return appendLog(
    {
      ...state,
      room: withoutCard(state.room, card),
      discard: [...state.discard, card],
      health,
      potionUsedThisRoom: true,
    },
    { kind: "potion", card, healed: amount, blocked, healthAfter: health },
  );
}

function equip(state: GameState, card: Card): GameState {
  const previous = state.weapon;
  const discard = previous === null
    ? state.discard
    : [...state.discard, previous.card, ...previous.kills];

  return appendLog(
    {
      ...state,
      room: withoutCard(state.room, card),
      discard,
      weapon: { card, kills: [] },
    },
    { kind: "equip", weapon: card, discarded: previous?.card ?? null },
  );
}

function runAway(state: GameState): GameState {
  const recycled = [...state.deck, ...state.room];
  const dealt = recycled.slice(0, ROOM_SIZE);
  const roomNumber = state.roomNumber + 1;

  const ran = appendLog(state, { kind: "run", roomNumber: state.roomNumber });

  return appendLog(
    {
      ...ran,
      deck: recycled.slice(ROOM_SIZE),
      room: dealt,
      potionUsedThisRoom: false,
      ranLastRoom: true,
      roomNumber,
    },
    { kind: "deal", roomNumber, cards: [...dealt] },
  );
}

/** Death, then deal, then win. Order matters: a fatal blow must not deal a new room. */
function settle(state: GameState): GameState {
  if (state.health <= 0) {
    return gameOver({ ...state, health: 0, status: "lost" }, "lost");
  }
  if (state.room.length === 1 && state.deck.length > 0) {
    return dealRoom(state);
  }
  if (state.room.length === 0 && state.deck.length === 0) {
    return gameOver({ ...state, status: "won" }, "won");
  }
  return state;
}

function dealRoom(state: GameState): GameState {
  const count = Math.min(ROOM_SIZE - state.room.length, state.deck.length);
  const dealt = state.deck.slice(0, count);
  const roomNumber = state.roomNumber + 1;
  return appendLog(
    {
      ...state,
      deck: state.deck.slice(count),
      room: [...state.room, ...dealt],
      potionUsedThisRoom: false,
      ranLastRoom: false,
      roomNumber,
    },
    { kind: "deal", roomNumber, cards: dealt },
  );
}

function gameOver(state: GameState, outcome: "won" | "lost"): GameState {
  return appendLog(state, { kind: "gameOver", outcome, score: finalScore(state) });
}

function withoutCard(room: readonly Card[], card: Card): readonly Card[] {
  return room.filter((candidate) => candidate.id !== card.id);
}

function appendLog(state: GameState, entry: GameState["log"][number]): GameState {
  return { ...state, log: [...state.log, entry] };
}
