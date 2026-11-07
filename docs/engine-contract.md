# Rules-layer contract

The public interface is [src/engine/index.ts](../src/engine/index.ts). The engine has no React, DOM, storage, clock, or global-randomness dependency. The [rules](rules.md) and [PRD](prd.md) own gameplay and product decisions.

## Entry points

| Function | Contract |
| --- | --- |
| `createGame(seed, config?)` | Validate input, shuffle the 44-card deck, and deal the first room. Copy configuration so later caller changes cannot alter a run. |
| `transition(state, action)` | Return a new game state and a typed result. Invalid actions retain the original state and return a reason. Input state is never mutated. |
| `previewAction(state, action)` | Return exactly the result that confirming the same action against the same state produces, without changing the state. |
| `encodeReplay(seed, config?)` / `decodeReplay(fragment)` | Encode or validate the versioned starting-dungeon contract. These do not resume progress. |
| `getCard(id)` / `isCardId(value)` | Look up a typed card or validate an unknown identifier against the exact artwork deck. |

`GameState` distinguishes playing, won, and lost runs. Playing runs include the full `roomStart` snapshot. Finished runs include score and reason, with no usable undo snapshot. The per-action result remains available for feedback even when that action ends a run.

## Version 1 seeds and replay links

The fragment format is `#/play?v=1&seed=cinder&rules=001`.

- Seeds contain 1–32 ASCII letters, digits, underscores, or hyphens. Case is significant. Do not trim, lowercase, or coerce an invalid seed silently.
- `rules` contains three bits, in order: allow consecutive escapes, unlimited potions, weapon degradation. Default rules are `001`.
- Reject unsupported versions, missing, duplicate, or unknown parameters, and malformed seeds or rule bits. The store/UI must validate before replacing an active run.
- The UI will generate seeds for new randomized runs and extract fragments from full URLs. The pure engine requires an explicit validated seed.

The canonical starting deck orders clubs, spades, diamonds, then hearts. Each suit's ranks ascend from 2, with j, q, k, a after 10 for black suits. Hash the ASCII seed with 32-bit FNV-1a (offset 2166136261, multiplier 16777619). Use the hash as Mulberry32's initial state, then shuffle using descending Fisher–Yates. Cards are drawn from array index 0. The `cinder` deck fixture in [engine.test.ts](../src/engine/engine.test.ts) pins version 1's complete order. Preserve this contract or introduce a new replay version before changing it.

## Room and feedback boundaries

- Normal room entry retains the remaining card at index 0, fills from the draw pile, and starts a fresh snapshot. Escape appends all four cards to the draw pile in their current displayed order before dealing; there is no reshuffle.
- Room snapshots include card order and zones, health, potion usage, inherited escape restrictions, and all run highlights. Completed-room counts are rolled back by undo. Seed and rules remain fixed.
- Fighting barehanded discards the monster and leaves the weapon threshold unchanged. A weapon fight appends the monster to its kill stack, with the last entry defining the next threshold. A fatal fight does not increment monsters defeated or rooms cleared.
- A consumed potion is wasted whenever it restores zero health, including at full health. A full-health potion still consumes the default room allowance. Carried potions are unresolved and consume no allowance.
- Abandonment produces a final lost run using the current draw-pile loss score. Recording that outcome once, aggregates, streaks, history limits, persistence, and active-run replacement belong to the future store layer.

## Verification

Run `pnpm test`. Tests cover rule boundaries, all eight configurations, preview parity, invalid-action stability, replay validation, serialization/undo restoration, and conservation of all 44 cards through 256 complete seeded runs. Frozen inputs detect accidental mutations. No browser is needed.
