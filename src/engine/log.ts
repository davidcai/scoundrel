import type { Card } from "./cards";

export type LogEntry =
  | { readonly kind: "deal"; readonly roomNumber: number; readonly cards: readonly Card[] }
  | {
      readonly kind: "fight";
      readonly monster: Card;
      readonly weapon: Card | null;
      readonly damage: number;
      readonly healthAfter: number;
    }
  | { readonly kind: "equip"; readonly weapon: Card; readonly discarded: Card | null }
  | {
      readonly kind: "potion";
      readonly card: Card;
      readonly healed: number;
      readonly blocked: boolean;
      readonly healthAfter: number;
    }
  | { readonly kind: "run"; readonly roomNumber: number }
  | { readonly kind: "gameOver"; readonly outcome: "won" | "lost"; readonly score: number };
