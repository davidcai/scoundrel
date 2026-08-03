import type { Card } from "./cards";

export type LogEntry =
  | { kind: "deal"; roomNumber: number; cards: readonly Card[] }
  | { kind: "fight"; monster: Card; weapon: Card | null; damage: number; healthAfter: number }
  | { kind: "equip"; weapon: Card; discarded: Card | null }
  | { kind: "potion"; card: Card; healed: number; blocked: boolean; healthAfter: number }
  | { kind: "run"; roomNumber: number }
  | { kind: "gameOver"; outcome: "won" | "lost"; score: number };
