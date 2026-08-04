import {
  roleOf, weaponThreshold,
  type Card, type GameState, type LogEntry, type Offer, type Role, type Suit,
} from "../engine";

const RANK_LABELS: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

const RANK_WORDS: Record<number, string> = {
  2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight",
  9: "Nine", 10: "Ten", 11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: "\u2663", diamonds: "\u2666", hearts: "\u2665", spades: "\u2660",
};

const SUIT_WORDS: Record<Suit, string> = {
  clubs: "Clubs", diamonds: "Diamonds", hearts: "Hearts", spades: "Spades",
};

const ROLE_WORDS: Record<Role, string> = {
  monster: "monster", weapon: "weapon", potion: "potion",
};

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function cardShort(card: Card): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export function cardName(card: Card): string {
  const rank = RANK_WORDS[card.rank] ?? String(card.rank);
  return `${rank} of ${SUIT_WORDS[card.suit]}, ${ROLE_WORDS[roleOf(card)]}`;
}

export function offerLabel(offer: Offer, state: GameState): string {
  switch (offer.action.type) {
    case "FIGHT": {
      if (!offer.action.useWeapon) {
        return `Barehanded — ${damageOf(offer)} dmg`;
      }
      const equipped = state.weapon;
      if (equipped === null) return "Use weapon";
      return offer.enabled
        ? `Use ${cardShort(equipped.card)} — ${damageOf(offer)} dmg`
        : `Use ${cardShort(equipped.card)}`;
    }
    case "DRINK": {
      if (offer.effect.kind !== "heal") return "Drink";
      if (offer.effect.blocked) return "Discard";
      if (offer.effect.amount === 0) return "Drink — no effect";
      return `Drink — +${offer.effect.amount} health`;
    }
    case "EQUIP": {
      const discards = offer.effect.kind === "equip" ? offer.effect.discards : null;
      return discards === null ? "Equip" : `Equip — discards ${cardShort(discards)}`;
    }
    case "RUN":
      return "Run away";
    case "NEW_GAME":
      return "New game";
  }
}

export function offerReason(offer: Offer, state: GameState): string | null {
  if (offer.enabled || offer.reason === undefined) return null;
  switch (offer.reason) {
    case "NO_WEAPON":
      return "No weapon equipped";
    case "WEAPON_THRESHOLD": {
      const threshold = offer.threshold ?? weaponThreshold(state.weapon);
      const equipped = state.weapon;
      return equipped === null
        ? "Weapon cannot kill this monster"
        : `${cardShort(equipped.card)} only kills below ${threshold}`;
    }
    case "RAN_LAST_ROOM":
      return "You ran from the last room";
    case "ROOM_IN_PROGRESS":
      return "Only before you resolve a card";
  }
}

/** A caveat for an offer that is legal but will not do what a player might assume. */
export function offerNote(offer: Offer): string | null {
  if (!offer.enabled || offer.effect.kind !== "heal") return null;
  if (offer.effect.blocked) return "Already drank this room";
  if (offer.effect.amount === 0) return "Already at full health";
  return null;
}

export function logLine(entry: LogEntry): string {
  switch (entry.kind) {
    case "deal":
      return `Room ${entry.roomNumber} — dealt ${entry.cards.map(cardShort).join(" ")}`;
    case "fight": {
      const attacker = entry.weapon === null ? "Barehanded" : cardShort(entry.weapon);
      return `${attacker} vs ${cardShort(entry.monster)} — ${entry.damage} damage, ${entry.healthAfter} health`;
    }
    case "equip":
      return entry.discarded === null
        ? `Equipped ${cardShort(entry.weapon)}`
        : `Equipped ${cardShort(entry.weapon)}, discarding ${cardShort(entry.discarded)}`;
    case "potion":
      if (entry.blocked) return `Discarded ${cardShort(entry.card)} — already drank this room`;
      if (entry.healed === 0) return `Drank ${cardShort(entry.card)} — no effect at full health`;
      return `Drank ${cardShort(entry.card)} — +${entry.healed} health, ${entry.healthAfter} total`;
    case "run":
      return `Ran from room ${entry.roomNumber}`;
    case "gameOver":
      return entry.outcome === "won"
        ? `Escaped the dungeon — score ${entry.score}`
        : `Died in the dungeon — score ${entry.score}`;
  }
}

export function outcomeHeadline(state: GameState): string {
  return state.status === "won" ? "You escaped the dungeon" : "You died in the dungeon";
}

function damageOf(offer: Offer): number {
  return offer.effect.kind === "damage" ? offer.effect.amount : 0;
}
