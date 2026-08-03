# Scoundrel — Design

Date: 2026-08-02
Status: approved

A browser implementation of Scoundrel, the single-player roguelike card game. `docs/rules.md`
is the source of truth for gameplay; this document resolves everything that document leaves
underspecified and defines the software design.

## Goals

- Play a complete, rules-faithful game of Scoundrel in the browser.
- Make the rules legible on screen. The difficulty should come from decisions, not from
  remembering a weapon's kill threshold or doing arithmetic in your head.
- Keep the rules engine independent of React, deterministic, and testable without mocks.

## Out of scope

No undo, no rule variants, no sound, no accounts, no server, no native app, no multiplayer.

## Decisions

| Area | Decision |
| --- | --- |
| Platform | Browser web app |
| Stack | React + TypeScript + Vite; engine is plain TypeScript |
| Architecture | Pure reducer engine over immutable snapshots |
| Visual style | Dark Dungeon — near-black table, parchment cards, gold and ember accents, old-style serif |
| Layout | Focused — top HUD strip, full-width room, weapon stack below, run log as bottom drawer |
| Combat interaction | Every legal action always visible on the card with real numbers; one click commits; illegal actions struck through with the reason |
| Features | Core loop, run log, resume on refresh, high score, animations, visible and shareable seed |
| Testing | Engine unit tests plus invariant property tests, plus component tests |

## Rule interpretations

`docs/rules.md` is ambiguous in ten places. These resolutions follow the official Scoundrel
rules and are authoritative for implementation. Each gets a named test.

1. **When you may run.** Only before resolving any card in the current room, and not if you
   ran from the previous room.
2. **Room refill.** Resolve three of four; the fourth carries over. The next deal adds three
   cards, so a room is always four cards while the deck permits.
3. **End of deck.** When the deck cannot refill the room to four, the resulting short room
   must be resolved in full. Winning requires both deck and room empty.
4. **Barehanded by choice.** Always available, even when the equipped weapon could legally be
   used. It is a real strategic option because it preserves the weapon's higher threshold.
5. **Resolving a Diamond.** Equipping is the only way to resolve it. Equipping discards the
   previous weapon together with its entire kill stack, resetting the threshold.
6. **Weapon threshold.** A weapon with no kills may be used on any monster. After killing a
   monster of value N it may only be used on monsters of value strictly less than N.
7. **One potion per room.** The flag resets on every deal. A second heart resolved in the same
   room is still a legal play, but heals nothing and is discarded. A heart carried into the
   next room can heal there.
8. **Run card order.** The four cards go to the bottom of the deck preserving their displayed
   left-to-right order, so runs stay deterministic under a fixed seed.
9. **Overkill.** Health is clamped to the range 0–20. Reaching 0 is a loss; excess damage is
   not recorded.
10. **Death score.** `0 −` the sum of the values of all monsters remaining in the deck plus all
    unresolved monsters in the current room.

## Deck composition

From a standard 52-card deck, remove the red face cards (J, Q, K of hearts and diamonds) and
both red aces, leaving 44 cards:

| Suit | Ranks | Count | Role |
| --- | --- | --- | --- |
| Clubs | 2–10, J, Q, K, A | 13 | Monster |
| Spades | 2–10, J, Q, K, A | 13 | Monster |
| Diamonds | 2–10 | 9 | Weapon |
| Hearts | 2–10 | 9 | Potion |

Values: number cards at face value, J 11, Q 12, K 13, A 14. Total monster value across both
black suits is 208, which is a useful anchor for scoring tests.

## Architecture

Three layers with strictly one-directional dependencies. `engine/` imports nothing from the
rest of the app. `storage/` and `ui/` depend on `engine/`; never the reverse.

```
src/
  engine/            plain TS. no React, no I/O, no human-readable strings
    cards.ts         Suit, Card, cardValue(), buildDungeon(), roleOf()
    rng.ts           mulberry32 + seeded Fisher-Yates shuffle
    state.ts         GameState, createGame(seed)
    actions.ts       Action union, IllegalActionError
    legality.ts      offersFor(state, card), runOffer(state)
    reduce.ts        applyAction(state, action)
    scoring.ts       finalScore(state)
    log.ts           LogEntry union (data only)
    invariants.ts    assertInvariants(state)
    index.ts         public barrel; the only path ui/ and storage/ may import
  storage/
    persistence.ts   load/save run snapshot and stats, schema-versioned
  ui/
    App.tsx
    hooks/           useGame.ts, usePrevious.ts, useExitTransition.ts
    components/      Hud, Room, CardView, WeaponStack, LogDrawer, GameOverOverlay
    styles/          tokens.css plus one CSS Module per component
  main.tsx
```

**The engine emits no display strings.** `legality.ts` returns reason codes and numeric
effects; `log.ts` returns structured entries. All wording lives in the UI. This is what lets
rule tests assert on data rather than on copy.

## Domain model

```ts
type Suit = "clubs" | "spades" | "diamonds" | "hearts";
type Role = "monster" | "weapon" | "potion";

type Card = {
  readonly id: string;    // suit letter + rank, e.g. "S8", "C14", "D5". Stable and unique.
  readonly suit: Suit;
  readonly rank: number;  // 2..14
};

type GameState = {
  readonly seed: string;                  // six uppercase hex characters
  readonly deck: readonly Card[];         // index 0 is the top of the dungeon
  readonly room: readonly Card[];         // face up, length 0..4, display order
  readonly discard: readonly Card[];
  readonly weapon: { card: Card; kills: readonly Card[] } | null;  // kills oldest -> newest
  readonly health: number;                // clamped 0..20
  readonly potionUsedThisRoom: boolean;
  readonly ranLastRoom: boolean;
  readonly roomNumber: number;            // 1-based, increments on every deal
  readonly status: "playing" | "won" | "lost";
  readonly log: readonly LogEntry[];
};
```

`card.id` is stable and unique so it can serve as the React key, which is what makes
snapshot-diffed animations possible.

The weapon's threshold is `kills[kills.length - 1].rank`, or unlimited when `kills` is empty.
The UI renders the fan newest-first.

### Initial state

`createGame(seed)` builds the 44-card dungeon, shuffles it with the seeded RNG, then deals the
first room:

```
seed                 the validated six-hex-character seed
deck                 39 cards remaining after the deal
room                 the first 4 cards, display order
discard              []
weapon               null
health               20
potionUsedThisRoom   false
ranLastRoom          false
roomNumber           1
status               "playing"
log                  [ { kind: "deal", roomNumber: 1, cards: <the 4 dealt cards> } ]
```

## Room lifecycle

The lifecycle needs no "cards resolved this room" counter, because a deal always brings the
room to four and any resolution drops it below four. Therefore `room.length === 4` is exactly
the condition "nothing has been resolved in this room yet", which is also the run-away
precondition.

- **Deal** when `room.length === 1 && deck.length > 0`. Move `min(4 - room.length,
  deck.length)` cards from the front of the deck to the end of the room, so the carried card
  sits at index 0. Reset `potionUsedThisRoom`, set `ranLastRoom = false`, increment
  `roomNumber`.
- **Win** when `room.length === 0 && deck.length === 0`.

A short room can only arise when the deck is empty, so it never triggers a deal and rule 3
follows automatically. Running is impossible in a short room, which is correct: recycling
cards through an empty deck would return the same cards.

## Actions

```ts
type Action =
  | { type: "FIGHT"; cardId: string; useWeapon: boolean }
  | { type: "DRINK"; cardId: string }
  | { type: "EQUIP"; cardId: string }
  | { type: "RUN" }
  | { type: "NEW_GAME"; seed: string };
```

Dealing is deliberately not a player action; it happens inside the reducer.

`NEW_GAME` carries a required seed. The engine may not touch `crypto`, so the caller supplies
one; the UI's `newGame()` generates a random seed when the player does not choose one.

## Legality

`legality.ts` is the single source of truth for what is playable, and the UI renders directly
from it, so the two cannot drift.

```ts
type ReasonCode = "NO_WEAPON" | "WEAPON_THRESHOLD" | "RAN_LAST_ROOM" | "ROOM_IN_PROGRESS";

type Effect =
  | { kind: "damage"; amount: number }
  | { kind: "heal"; amount: number; blocked: boolean }
  | { kind: "equip"; discards: Card | null }
  | { kind: "run" };

type Offer = {
  readonly action: Action;
  readonly enabled: boolean;
  readonly reason?: ReasonCode;   // present only when enabled is false
  readonly effect: Effect;
  readonly threshold?: number;    // context for wording, e.g. "only kills below 10"
};

function offersFor(state: GameState, card: Card): readonly Offer[];
function runOffer(state: GameState): Offer;
function isOffered(state: GameState, action: Action): boolean;   // backs the reducer guard
```

Offers by role:

- **Monster** — two offers.
  - Fight with weapon. Enabled when a weapon is equipped and either it has no kills or
    `card.rank < threshold`. Damage is `max(0, card.rank - weapon.card.rank)`. Disabled reason
    is `NO_WEAPON` or `WEAPON_THRESHOLD`.
  - Fight barehanded. Always enabled. Damage is `card.rank`.
- **Potion** — one offer, always enabled. `blocked` is `potionUsedThisRoom`; `amount` is
  `blocked ? 0 : min(card.rank, 20 - health)`.
- **Weapon** — one offer, always enabled. `discards` is the currently equipped weapon.

`runOffer` is enabled when `status === "playing" && room.length === 4 && !ranLastRoom`, with
reason `ROOM_IN_PROGRESS` or `RAN_LAST_ROOM`.

Three consequences that would otherwise become silent bugs:

- **A second heart in the same room is legal, not blocked.** It must be, or a room holding two
  hearts would deadlock — the three-card requirement would be unreachable. It resolves,
  discards, and heals nothing.
- **Drinking at full health still consumes the potion slot.** `blocked` is false and `amount`
  is 0. This differs from the blocked case and the UI must word the two differently: "already
  at full health" versus "already drank this room". It is sometimes the correct play, because
  resolving a heart can be safer than fighting.
- **Weapon damage floors at 0, but the kill still counts.** Killing an 8♠ with a 9♦ costs no
  health, yet the 8♠ still joins the stack and lowers the threshold to "below 8". That trade
  is the core of the game.

## Reducer

`applyAction(state, action): GameState`, pure and total over legal input.

An action that is not currently offered throws `IllegalActionError`. The UI cannot construct
one because it renders only from offers, so a throw indicates a genuine bug; tests assert on
it and a React error boundary is the production backstop. `NEW_GAME` is accepted in any
status; every other action requires `status === "playing"`.

`DRINK` always sets `potionUsedThisRoom = true`, including when the offer was blocked, in
which case the flag was already true and the assignment is a no-op.

Each action applies its effect, appends a `LogEntry`, then runs `settle` in this order:

1. `health <= 0` → clamp to 0, `status = "lost"`, append the game-over entry.
2. else `room.length === 1 && deck.length > 0` → deal.
3. else `room.length === 0 && deck.length === 0` → `status = "won"`, append the game-over entry.

`RUN` bypasses `settle` entirely and deals its own room, because it must set
`ranLastRoom = true`: append the four room cards to the end of the deck in display order, take
four fresh cards, reset `potionUsedThisRoom`, increment `roomNumber`. Bypassing is safe because
`RUN` cannot change health and always leaves the room at four cards, so neither the loss nor
the win condition can be reached by it.

Card destinations, which is where conservation of all 44 cards is enforced:

| Event | Destination |
| --- | --- |
| Monster killed with a weapon | `weapon.kills`, appended |
| Monster killed barehanded | `discard` |
| Potion resolved, whether it healed or not | `discard` |
| Weapon replaced by `EQUIP` | old weapon card and all its kills → `discard` |
| Room recycled by `RUN` | end of `deck`, display order preserved |

## Log

```ts
type LogEntry =
  | { kind: "deal"; roomNumber: number; cards: readonly Card[] }
  | { kind: "fight"; monster: Card; weapon: Card | null; damage: number; healthAfter: number }
  | { kind: "equip"; weapon: Card; discarded: Card | null }
  | { kind: "potion"; card: Card; healed: number; blocked: boolean; healthAfter: number }
  | { kind: "run"; roomNumber: number }
  | { kind: "gameOver"; outcome: "won" | "lost"; score: number };
```

Structured data only. The UI formats entries for display.

## Scoring

```
finalScore(state) =
  status === "won"  ->  health
  status === "lost" ->  -(sum of ranks of clubs and spades in deck and room)
  otherwise         ->  throw
```

Dying on the dungeon's final card therefore scores exactly 0, distinguishable from a win only
by `status`. The UI must present outcome and score together, never the score alone.

## Seed and URL

The seed is six uppercase hex characters, validated against `/^[0-9A-F]{6}$/`. It is parsed
with `parseInt(seed, 16)` and used directly as the `mulberry32` state, which drives a
Fisher-Yates shuffle. A random seed comes from `crypto.getRandomValues`.

Every new game writes its seed into the URL with `history.replaceState`, so sharing a dungeon
is copying the address bar. Load resolution, in order:

1. URL seed present and equal to the saved run's seed → resume the saved run. This is the
   ordinary refresh case.
2. URL seed present and different → start that dungeon fresh, discarding any run in progress.
   This is the deliberate "someone sent me a link" case.
3. No URL seed → resume the saved run if there is one, otherwise generate a random seed.

A malformed seed is ignored in favour of a random one.

## Persistence

```ts
const SCHEMA = 1;
localStorage["scoundrel.run"]   // { schema: number; state: GameState; statsRecorded: boolean }
localStorage["scoundrel.stats"] // { schema: number; best: number | null; played: number; won: number }
```

The run snapshot is written on every state change. A schema mismatch discards rather than
migrates; a run is disposable and migration code is not worth carrying.

**A loaded snapshot is untrusted input.** Hydration parses it, runs `assertInvariants`, and
discards anything that fails. The same function backs the property tests, so hand-edited or
truncated saves cannot produce an impossible game state.

Every localStorage access is wrapped, so private browsing or an exhausted quota degrades to
in-memory play rather than crashing.

Stats are recorded when a game reaches a terminal status, and exactly once: increment `played`,
increment `won` on a win, and set `best = max(best, score)` so a −40 loss can never displace a
+12 win. `best` starts as `null` and displays as `—`.

The `statsRecorded` flag on the run snapshot is what makes "exactly once" hold across reloads.
Without it, refreshing a finished game would re-count the result on every load, because the
hydrated state already carries a terminal status and there is no transition to observe. The
flag lives on the snapshot wrapper rather than in `GameState`, keeping the engine free of
persistence concerns.

## UI

```
App
├─ Hud             health bar and value, deck count, room number, best, seed, [Run away]
├─ Room            up to four slots, full width, largest cards
│  └─ CardView     face plus one button per offer
├─ WeaponStack     equipped diamond, kills fanned newest-first, "kills below N"
├─ LogDrawer       collapsed shows the newest entry; expanded scrolls the full list
└─ GameOverOverlay outcome, score, seed, [New game] [Replay this seed]
```

`useGame()` wraps `useReducer(applyAction)` with hydration and persistence, exposing
`{ state, dispatch, offers }`. `usePrevious(state)` retains the prior snapshot for diffing.

`CardView` contains no rule logic. It receives offers and renders a real `<button>` per offer,
with disabled ones struck through and annotated from the reason code. Using real buttons gives
keyboard operation and screen-reader labels for free.

Accessibility: every action is a focusable button; card faces carry accessible names such as
"Eight of Spades, monster"; the newest log entry and each damage event are announced through
an `aria-live="polite"` region.

## Animations

**The governing rule: state changes are never gated on animation completion.** Animations are
decoration reacting to already-committed state. Nothing queues, nothing waits, input is never
blocked. The worst case for a rapid clicker is a truncated animation, never a wrong state or a
stuck UI. This constraint removes the entire class of interrupted-transition bugs.

| Animation | Trigger | Mechanism | Duration |
| --- | --- | --- | --- |
| Deal | Card mounts in the room | CSS keyframes, drop in from above, 60 ms stagger | 260 ms |
| Card exit | Card leaves the room, stack, or weapon slot | `useExitTransition` adds `exiting`, then unmounts | 200 ms |
| Health change | `prev.health !== state.health` | CSS `transition: width` on the bar | 400 ms |
| Damage number | Damage taken | Floating red `−N` rising and fading | 700 ms |
| Stage shake | Damage ≥ 8 | CSS keyframes on the stage | 260 ms |
| Stack growth | Kill card mounts on the fan | CSS keyframes | 260 ms |
| Run sweep | `RUN` | Exit on all four, then deal | 200 ms + 260 ms |

`useExitTransition(items, keyFn, durationMs)` is the only animation machinery: it retains
departed items briefly with an `exiting` class so React's immediate unmount does not skip the
transition. Roughly 25 lines, one purpose, and the sole reason `card.id` must be stable.
Everything else is pure CSS.

`@media (prefers-reduced-motion: reduce)` sets every duration to zero. This is an
accessibility requirement and it also makes component tests deterministic.

## Error handling

Exactly three error surfaces:

1. `IllegalActionError` → React error boundary showing the seed and log so the failure is
   reportable and the dungeon recoverable.
2. Storage failure → silent degradation to in-memory play.
3. Malformed seed → fall back to a random seed.

There is nothing else. No network, no async, and no free-text input beyond the seed.

## Testing

Vitest, React Testing Library, jsdom. The engine is built test-first.

Engine:

1. **Deck construction** — exactly 44 cards; 13 clubs, 13 spades, 9 diamonds, 9 hearts; no red
   face cards; no red aces; all ids unique.
2. **Ten named rule tests**, one per interpretation above, named after the rule.
3. **Determinism** — the same seed yields an identical deck, and the same seed plus the same
   action list yields an identical final state.
4. **Invariant property test** over seeded random legal action sequences, asserting after every
   step: all 44 card ids present exactly once across deck, room, discard, and weapon stack;
   `0 <= health <= 20`; `room.length <= 4`; weapon kills strictly descending in rank; `status`
   consistent with deck, room, and health.
5. **Terminal states** — a scripted seeded win and a scripted seeded loss, with asserted
   scores, plus the final-card death scoring 0.
6. **Illegal actions throw** `IllegalActionError`.

UI:

- `CardView` renders exactly the offers legality reports, with reasons on disabled ones.
- Clicking an offer dispatches the matching action.
- The run button is disabled with the correct reason mid-room and after a run.
- `LogDrawer` collapses to the newest entry and expands to the full list.
- Persistence round-trips: save, reload, resume an identical state; a corrupt payload yields a
  fresh game with no crash; reloading a finished game does not double-count stats.
- Reduced motion renders without timers.

## Toolchain

No toolchain exists yet. The work includes scaffolding Vite, React, TypeScript in strict mode,
and Vitest, with scripts for `dev`, `build`, `preview`, `test`, `test:watch`, and `typecheck`.
`AGENTS.md` currently states that no package.json or runnable scripts exist and must be
updated once they do.
