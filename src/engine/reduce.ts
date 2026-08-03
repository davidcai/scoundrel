import { IllegalActionError, type Action } from "./actions";
import type { Card } from "./cards";
import { isOffered, offersFor } from "./legality";
import { finalScore } from "./scoring";
import { ROOM_SIZE, createGame, type GameState } from "./state";

export function applyAction(state: GameState, action: Action): GameState {
  if (action.type === "NEW_GAME") return createGame(action.seed);

  if (!isOffered(state, action)) {
    throw new IllegalActionError(`Action not offered: ${JSON.stringify(action)}`);
  }

  if (action.type === "RUN") {
    throw new IllegalActionError("RUN not implemented until Task 9");
  }

  const card = state.room.find((c) => c.id === action.cardId);
  if (card === undefined) throw new IllegalActionError(`Card not in room: ${action.cardId}`);

  switch (action.type) {
    case "FIGHT":
      return settle(fight(state, card, action.useWeapon));
    case "DRINK":
    case "EQUIP":
      throw new IllegalActionError(`${action.type} not implemented until Task 8`);
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
