export type Action =
  | { type: "FIGHT"; cardId: string; useWeapon: boolean }
  | { type: "DRINK"; cardId: string }
  | { type: "EQUIP"; cardId: string }
  | { type: "RUN" }
  // Required, not optional: the engine may not touch crypto, so the caller
  // supplies the seed. `useGame.newGame()` fills in a random one.
  | { type: "NEW_GAME"; seed: string };

/** Thrown when an action is dispatched that legality.ts does not currently offer. */
export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}
