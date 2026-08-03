# Scoundrel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a rules-faithful, browser-playable Scoundrel with a deterministic, React-free rules engine.

**Architecture:** Three layers with one-directional dependencies. `src/engine/` is plain TypeScript — pure functions over immutable `GameState` snapshots, no React, no browser globals, no human-readable strings. `src/storage/` adapts localStorage and the URL. `src/ui/` renders React from snapshots and owns all wording. Every rules decision is reachable only through `legality.ts`, and the UI renders directly from its output so the two cannot drift.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest, jsdom, Testing Library. CSS Modules plus custom properties. No state library, no animation library, no runtime dependencies beyond React.

**Spec:** `docs/design/2026-08-02-scoundrel-game-design.md`. Read it before starting. The ten numbered rule interpretations in it are authoritative; tasks reference them by number.

## Global Constraints

Every task's requirements implicitly include this section.

- **TypeScript strict mode.** `strict: true`, plus `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true`. No `any`, no non-null `!` assertions in `src/engine/`.
- **Engine purity.** Nothing in `src/engine/` may import React, touch `window`/`document`/`localStorage`, call `Math.random`, `Date.now`, or `crypto`, use `async`, or mutate its inputs. All randomness arrives as an injected `Rng`.
- **Engine emits no display strings.** Reason codes and structured log entries only. Every user-visible string lives in `src/ui/format.ts`.
- **Deck is exactly 44 cards:** clubs 2–10/J/Q/K/A (13), spades 2–10/J/Q/K/A (13), diamonds 2–10 (9), hearts 2–10 (9). Ranks are numeric 2–14 where J=11, Q=12, K=13, A=14.
- **Health is clamped to 0–20** at every write. `MAX_HEALTH = 20`, `ROOM_SIZE = 4`.
- **Reason codes are exactly** `"NO_WEAPON" | "WEAPON_THRESHOLD" | "RAN_LAST_ROOM" | "ROOM_IN_PROGRESS"`. No others.
- **Seed format is exactly** `/^[0-9A-F]{6}$/` (six uppercase hex characters).
- **Persistence:** `SCHEMA = 1`; localStorage keys are exactly `"scoundrel.run"` and `"scoundrel.stats"`. Every access wrapped in try/catch and degrading to in-memory.
- **Animations never gate state changes.** No `setTimeout` between a click and a `dispatch`. Animations react to committed state only.
- **`@media (prefers-reduced-motion: reduce)` sets every animation and transition duration to `0s`.**
- **Animation durations:** deal 260 ms with 60 ms stagger, exit 200 ms, health bar 400 ms, damage float 700 ms, stage shake 260 ms (only when damage ≥ 8).
- **Dark Dungeon palette** — define once in `src/ui/styles/tokens.css` and never hardcode a colour elsewhere:

  ```
  --table: #14100c        --table-edge: #2c2318    --panel: #100d09
  --panel-raised: #1c160f --panel-border: #33291b
  --card-face-top: #f4e9d2  --card-face-bottom: #e6d6b4
  --card-edge: #8b6f47    --card-shadow: #0c0906
  --ink: #2a2018          --ink-red: #a62b1f
  --gold: #e8c774         --gold-dim: #6b5423
  --ember: #b8452f        --ember-bright: #e0846b  --ember-edge: #6b3524
  --leaf: #8fbf7a         --text: #c8b48c          --text-dim: #7d6a4a
  --serif: "Iowan Old Style", "Palatino Linotype", Georgia, serif
  ```

- **Commit after every task**, using the message given in the task's final step.

## File Structure

| File | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Toolchain |
| `src/engine/cards.ts` | `Suit`, `Role`, `Card`, `makeCard`, `roleOf`, `buildDungeon` |
| `src/engine/rng.ts` | `Rng`, `mulberry32`, `shuffle`, seed normalise/generate/parse |
| `src/engine/log.ts` | `LogEntry` union — data only |
| `src/engine/actions.ts` | `Action` union, `IllegalActionError` |
| `src/engine/state.ts` | `GameState`, `Weapon`, `createGame`, `weaponThreshold`, `MAX_HEALTH`, `ROOM_SIZE` |
| `src/engine/legality.ts` | `Offer`, `Effect`, `ReasonCode`, `offersFor`, `runOffer`, `isOffered` |
| `src/engine/reduce.ts` | `applyAction` and the private `settle`/`dealRoom` helpers |
| `src/engine/scoring.ts` | `finalScore`, `remainingMonsterValue` |
| `src/engine/invariants.ts` | `assertInvariants`, `validateState`, `InvariantError` |
| `src/engine/index.ts` | Public barrel — the only path `storage/` and `ui/` may import |
| `src/storage/persistence.ts` | `loadRun`/`saveRun`/`loadStats`/`saveStats`/`recordResult` |
| `src/storage/seedUrl.ts` | `readSeedFromUrl`, `writeSeedToUrl` |
| `src/storage/resolveStart.ts` | `resolveStart` — pure three-rule load resolution |
| `src/ui/format.ts` | Every user-visible string |
| `src/ui/hooks/useGame.ts` | Reducer + persistence + seed URL + stats wiring |
| `src/ui/hooks/useExitTransition.ts` | The only animation machinery |
| `src/ui/components/CardView.tsx` | A card face plus one button per offer |
| `src/ui/components/Room.tsx` | The four slots |
| `src/ui/components/WeaponStack.tsx` | Equipped weapon, kill fan, threshold readout |
| `src/ui/components/Hud.tsx` | Health, deck, room, best, seed, run button |
| `src/ui/components/LogDrawer.tsx` | Collapsed newest entry / expanded list |
| `src/ui/components/GameOverOverlay.tsx` | Outcome, score, new game, replay seed |
| `src/ui/components/ErrorBoundary.tsx` | Backstop for `IllegalActionError` |
| `src/ui/styles/tokens.css`, `global.css` | Palette and base styles |
| `src/ui/App.tsx` | Layout composition |
| `src/main.tsx` | Mount |

Tests are colocated as `*.test.ts` / `*.test.tsx` beside the file under test.

---

### Task 1: Toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/vite-env.d.ts`, `src/test-setup.ts`, `src/smoke.test.ts`
- Modify: `AGENTS.md`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm test` and `npm run typecheck`. `npm run dev` and `npm run build` only
  become usable at Task 14, when `src/main.tsx` first exists.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "scoundrel",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

There is deliberately no `types` array. Every test in this plan imports `describe`/`it`/`expect`
explicitly from `vitest`, so `"vitest/globals"` would be inert. `"@testing-library/jest-dom"` would
be worse than inert: it resolves to a file augmenting the *Jest* namespace and pulls in a
`/// <reference types="jest" />` that nothing satisfies. The Vitest matcher augmentation arrives
through the `test-setup.ts` import instead.

`vite.config.ts` is in `include` deliberately. Left out, `npm run typecheck` silently skips it
and a typo in the Vitest config would never be caught.

- [ ] **Step 3: Create `vite.config.ts`**

Import `defineConfig` from `vitest/config`, not from `vite`. Vite's own `defineConfig` does not
type the `test` key, so with `vite.config.ts` in `include` the build fails `TS2769`.

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

`globals` stays off. Tests import from `vitest` explicitly — that is the convention for this
codebase, and it keeps test files honest about their dependencies.

- [ ] **Step 4: Create `src/test-setup.ts`, `src/vite-env.d.ts`, and `index.html`**

`src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scoundrel</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the smoke test**

`src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("has a live DOM, not just a defined global", () => {
    expect(document.createElement("div")).toBeInstanceOf(HTMLElement);
  });

  // Locks in setupFiles: this matcher only exists if test-setup.ts ran.
  it("has jest-dom matchers from setupFiles", () => {
    expect(document.createElement("div")).toBeEmptyDOMElement();
  });
});
```

The third test is the only committed proof that `setupFiles` is wired up. Without it, a broken
`setupFiles` path would stay silent until some later task's first matcher call.

- [ ] **Step 6: Install and verify**

```bash
npm install
npm test
npm run typecheck
```

Expected: `npm test` PASSES all three smoke tests. `npm run typecheck` exits 0.

`main.tsx` does not exist yet, so `npm run build` fails and `npm run dev` serves a blank page
with a console error — both expected until Task 14. If `npm install` resolves a major version that breaks `npm test`, pin the offending package down one major and note it in the commit body.

- [ ] **Step 7: Add the TypeScript build artifact to `.gitignore`**

`tsc -b` writes `tsbuildinfo` even under `--noEmit`. Append to `.gitignore`:

```
*.tsbuildinfo
```

- [ ] **Step 8: Update `AGENTS.md`**

Replace the entire `## Commands` section with:

```markdown
## Commands

- `npm run dev` — Vite dev server
- `npm test` — run all tests once
- `npm run test:watch` — watch mode
- `npm run typecheck` — TypeScript, no emit
- `npm run build` — typecheck then production build

`npm run dev` and `npm run build` do not work yet; both need `src/main.tsx`, which a later task adds.

Run `npm test` and `npm run typecheck` before considering any change complete.
```

Then append to `## Project structure`:

```markdown
- `docs/design/` — approved design specs
- `docs/plans/` — implementation plans
- `src/engine/` — pure rules engine (no React, no browser APIs, no display strings)
- `src/storage/` — localStorage and URL adapters
- `src/ui/` — React presentation layer, owns all user-visible strings
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src AGENTS.md .gitignore
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest"
```

---

### Task 2: Cards and deck construction

**Files:**
- Create: `src/engine/cards.ts`, `src/engine/cards.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type Suit = "clubs" | "spades" | "diamonds" | "hearts";
  export type Role = "monster" | "weapon" | "potion";
  export type Card = { readonly id: string; readonly suit: Suit; readonly rank: number };
  export function makeCard(suit: Suit, rank: number): Card;
  export function roleOf(card: Card): Role;
  export function buildDungeon(): Card[];
  ```

- [ ] **Step 1: Write the failing test**

`src/engine/cards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDungeon, makeCard, roleOf, type Suit } from "./cards";

describe("makeCard", () => {
  it("builds a stable id from suit letter and rank", () => {
    expect(makeCard("spades", 8).id).toBe("S8");
    expect(makeCard("clubs", 14).id).toBe("C14");
    expect(makeCard("diamonds", 5).id).toBe("D5");
    expect(makeCard("hearts", 10).id).toBe("H10");
  });
});

describe("roleOf", () => {
  it("maps suits to roles", () => {
    expect(roleOf(makeCard("clubs", 7))).toBe("monster");
    expect(roleOf(makeCard("spades", 7))).toBe("monster");
    expect(roleOf(makeCard("diamonds", 7))).toBe("weapon");
    expect(roleOf(makeCard("hearts", 7))).toBe("potion");
  });
});

describe("buildDungeon", () => {
  const deck = buildDungeon();
  const countOf = (suit: Suit) => deck.filter((c) => c.suit === suit).length;

  it("has exactly 44 cards", () => {
    expect(deck).toHaveLength(44);
  });

  it("has 13 clubs, 13 spades, 9 diamonds, 9 hearts", () => {
    expect(countOf("clubs")).toBe(13);
    expect(countOf("spades")).toBe(13);
    expect(countOf("diamonds")).toBe(9);
    expect(countOf("hearts")).toBe(9);
  });

  it("excludes red face cards and red aces", () => {
    const red = deck.filter((c) => c.suit === "diamonds" || c.suit === "hearts");
    expect(red.every((c) => c.rank >= 2 && c.rank <= 10)).toBe(true);
  });

  it("includes black ranks 2 through 14", () => {
    const clubRanks = deck.filter((c) => c.suit === "clubs").map((c) => c.rank).sort((a, b) => a - b);
    expect(clubRanks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("has unique ids", () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(44);
  });

  it("totals 208 monster value", () => {
    const monsterValue = deck.filter((c) => roleOf(c) === "monster").reduce((sum, c) => sum + c.rank, 0);
    expect(monsterValue).toBe(208);
  });

  it("returns a fresh array each call", () => {
    expect(buildDungeon()).not.toBe(buildDungeon());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/cards.test.ts`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 3: Write the implementation**

`src/engine/cards.ts`:

```ts
export type Suit = "clubs" | "spades" | "diamonds" | "hearts";
export type Role = "monster" | "weapon" | "potion";

export type Card = {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: number;
};

// Private and immutable (compile-time readonly, not Object.freeze). Every card id
// is derived from this table, so a mutation
// would corrupt every id in the game — and ids are React keys and action payloads.
const SUIT_LETTER = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
} as const satisfies Record<Suit, string>;

const ROLE_BY_SUIT = {
  clubs: "monster",
  spades: "monster",
  diamonds: "weapon",
  hearts: "potion",
} as const satisfies Record<Suit, Role>;

export function makeCard(suit: Suit, rank: number): Card {
  return { id: `${SUIT_LETTER[suit]}${rank}`, suit, rank };
}

export function roleOf(card: Card): Role {
  return ROLE_BY_SUIT[card.suit];
}

/** The 44-card Scoundrel dungeon in a fixed, unshuffled order. */
export function buildDungeon(): Card[] {
  const cards: Card[] = [];
  for (const suit of ["clubs", "spades"] as const) {
    for (let rank = 2; rank <= 14; rank += 1) cards.push(makeCard(suit, rank));
  }
  for (const suit of ["diamonds", "hearts"] as const) {
    for (let rank = 2; rank <= 10; rank += 1) cards.push(makeCard(suit, rank));
  }
  return cards;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/cards.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cards.ts src/engine/cards.test.ts
git commit -m "feat(engine): card model and 44-card dungeon construction"
```

---

### Task 3: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`, `src/engine/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type Rng = () => number;                            // [0, 1)
  export const SEED_PATTERN: RegExp;                         // /^[0-9A-F]{6}$/
  export function normalizeSeed(raw: string): string | null;  // uppercased, or null if invalid
  export function seedToInt(seed: string): number;            // parseInt(seed, 16)
  export function mulberry32(seedInt: number): Rng;
  export function shuffle<T>(items: readonly T[], rng: Rng): T[];
  ```

`randomSeed` is deliberately **not** here — it needs `crypto`, which the engine may not touch. It lives in `src/storage/seedUrl.ts` (Task 10).

- [ ] **Step 1: Write the failing test**

`src/engine/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mulberry32, normalizeSeed, seedToInt, shuffle } from "./rng";

describe("normalizeSeed", () => {
  it("uppercases valid six-hex seeds", () => {
    expect(normalizeSeed("4f2a9c")).toBe("4F2A9C");
    expect(normalizeSeed("000000")).toBe("000000");
    expect(normalizeSeed("FFFFFF")).toBe("FFFFFF");
  });

  it("rejects anything else", () => {
    for (const bad of ["", "4F2A9", "4F2A9C0", "GGGGGG", "4F 2A9C", "-4F2A9", "4F2A9Z"]) {
      expect(normalizeSeed(bad)).toBeNull();
    }
  });
});

describe("seedToInt", () => {
  it("parses hex", () => {
    expect(seedToInt("000000")).toBe(0);
    expect(seedToInt("FFFFFF")).toBe(16777215);
    expect(seedToInt("4F2A9C")).toBe(0x4f2a9c);
  });
});

describe("mulberry32", () => {
  it("produces values in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  // Kills the non-advancing mutant. A generator returning one constant forever
  // satisfies every other assertion here: the range check accepts a constant,
  // the cross-instance check compares [x,x,x] to [x,x,x], and the cross-seed
  // check only compares first draws. Downstream that mutant yields a deck in
  // near-build order — a visibly unshuffled dungeon with a green suite.
  it("advances its state, so successive draws from one instance differ", () => {
    const rng = mulberry32(999);
    expect(new Set([rng(), rng(), rng()]).size).toBe(3);
  });

  it("is deterministic for a given seed", () => {
    const a = mulberry32(999);
    const b = mulberry32(999);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  // Localizes a constant change to this file. Task 4 pins the whole
  // seed -> dungeon contract, but that test cannot say WHICH layer moved:
  // PRNG constants, buildDungeon's order, and shuffle's bounds all fail it
  // identically. This one fingers the PRNG specifically.
  //
  // These constants are a compatibility contract. Seeds appear in shared URLs
  // and inside saved games, so changing them silently remaps every existing
  // run. If this fails and you did not intend that, do not update the value.
  it("emits a pinned first draw for a known seed", () => {
    expect(mulberry32(seedToInt("4F2A9C"))()).toBe(0.07600133842788637);
  });
});

describe("shuffle", () => {
  const source = Array.from({ length: 44 }, (_, i) => i);

  it("does not mutate the input", () => {
    const input = [...source];
    shuffle(input, mulberry32(7));
    expect(input).toEqual(source);
  });

  it("preserves every element exactly once", () => {
    const out = shuffle(source, mulberry32(7));
    expect([...out].sort((a, b) => a - b)).toEqual(source);
  });

  it("is deterministic for a given seed", () => {
    expect(shuffle(source, mulberry32(42))).toEqual(shuffle(source, mulberry32(42)));
  });

  it("actually reorders", () => {
    expect(shuffle(source, mulberry32(42))).not.toEqual(source);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 3: Write the implementation**

`src/engine/rng.ts`:

```ts
export type Rng = () => number;

export const SEED_PATTERN = /^[0-9A-F]{6}$/;

export function normalizeSeed(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return SEED_PATTERN.test(upper) ? upper : null;
}

export function seedToInt(seed: string): number {
  return Number.parseInt(seed, 16);
}

/**
 * Small, fast, well-distributed 32-bit PRNG.
 *
 * The constants below are a compatibility contract, not an implementation
 * detail: seeds are published in shared URLs and stored inside saved games,
 * so altering them remaps every existing run to a different dungeon. The
 * pinned-first-draw test in rng.test.ts guards this.
 */
export function mulberry32(seedInt: number): Rng {
  let state = seedInt >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts
git commit -m "feat(engine): seeded PRNG, seed validation, and shuffle"
```

---

### Task 4: State, actions, log, and `createGame`

**Files:**
- Create: `src/engine/log.ts`, `src/engine/actions.ts`, `src/engine/state.ts`, `src/engine/state.test.ts`

**Interfaces:**
- Consumes: `Card`, `buildDungeon` (Task 2); `mulberry32`, `seedToInt`, `shuffle`, `normalizeSeed` (Task 3).
- Produces:
  ```ts
  // log.ts
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

  // actions.ts
  export type Action =
    | { type: "FIGHT"; cardId: string; useWeapon: boolean }
    | { type: "DRINK"; cardId: string }
    | { type: "EQUIP"; cardId: string }
    | { type: "RUN" }
    | { type: "NEW_GAME"; seed: string };
  export class IllegalActionError extends Error {}

  // state.ts
  export const MAX_HEALTH = 20;
  export const ROOM_SIZE = 4;
  export type GameStatus = "playing" | "won" | "lost";
  export type Weapon = { readonly card: Card; readonly kills: readonly Card[] };
  export type GameState = { /* full shape below */ };
  export function createGame(seed: string): GameState;
  export function weaponThreshold(weapon: Weapon | null): number | null;
  ```

- [ ] **Step 1: Write the failing test**

`src/engine/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { MAX_HEALTH, ROOM_SIZE, createGame, weaponThreshold } from "./state";

describe("rule constants", () => {
  // Pinned to the rulebook, not to themselves. Every other assertion compares
  // these constants to values derived from them, so a wrong value here would
  // rebalance the whole game with a green suite.
  it("match docs/rules.md", () => {
    expect(MAX_HEALTH).toBe(20);
    expect(ROOM_SIZE).toBe(4);
  });
});

describe("createGame", () => {
  const state = createGame("4F2A9C");

  it("records the seed", () => {
    expect(state.seed).toBe("4F2A9C");
  });

  it("deals a room of four and leaves 40 in the deck", () => {
    expect(state.room).toHaveLength(4);
    expect(state.deck).toHaveLength(40);
  });

  it("starts at full health with nothing equipped or discarded", () => {
    expect(state.health).toBe(MAX_HEALTH);
    expect(state.weapon).toBeNull();
    expect(state.discard).toEqual([]);
  });

  it("starts flags clear, on room 1, playing", () => {
    expect(state.potionUsedThisRoom).toBe(false);
    expect(state.ranLastRoom).toBe(false);
    expect(state.roomNumber).toBe(1);
    expect(state.status).toBe("playing");
  });

  it("seeds the log with the first deal", () => {
    expect(state.log).toEqual([{ kind: "deal", roomNumber: 1, cards: state.room }]);
  });

  it("copies the dealt cards into the log rather than aliasing the room", () => {
    const entry = state.log[0];
    if (entry === undefined || entry.kind !== "deal") throw new Error("expected a deal entry");
    expect(entry.cards).not.toBe(state.room);
    expect(entry.cards).toEqual(state.room);
  });

  it("accounts for all 44 cards", () => {
    expect(new Set([...state.deck, ...state.room].map((c) => c.id)).size).toBe(44);
  });

  it("is deterministic for a seed", () => {
    expect(createGame("4F2A9C")).toEqual(createGame("4F2A9C"));
  });

  it("differs across seeds", () => {
    expect(createGame("000001").room.map((c) => c.id)).not.toEqual(
      createGame("000002").room.map((c) => c.id),
    );
  });

  it("throws on an invalid seed", () => {
    expect(() => createGame("nope")).toThrow(/seed/i);
  });

  // Storing the raw seed instead of the normalized one passes every other test,
  // because they all pass canonical seeds. The failure mode is silent and nasty:
  // the lowercase form goes into the URL and the saved game, then SEED_PATTERN
  // (uppercase-only) rejects it on load — a run that saves but will not reload.
  it("stores the normalized seed, not the raw input", () => {
    expect(createGame("4f2a9c").seed).toBe("4F2A9C");
  });
});

describe("seed contract (golden)", () => {
  // Pins the whole seed -> dungeon mapping: the PRNG constants, the shuffle
  // algorithm, buildDungeon's base order, and the deal. A seed is public — it
  // appears in the URL and inside saved games — so changing any of those
  // silently invalidates every shared link and every stored run, and no other
  // test in this codebase would notice.
  //
  // If this fails and you did not intend to change the mapping, do NOT update
  // the expected values. Find what moved.
  it("maps seed 4F2A9C to an exact dungeon", () => {
    const state = createGame("4F2A9C");

    expect(state.room.map((card) => card.id)).toEqual(["H10", "S6", "D10", "H9"]);

    expect(state.deck.map((card) => card.id)).toEqual([
      "S12", "S2", "D7", "C9", "S5", "S9", "S7", "C8", "H4", "H3",
      "D4", "C4", "C13", "C7", "C14", "D9", "D2", "C11", "S4", "H2",
      "H6", "S8", "H5", "D5", "C2", "H7", "C12", "D6", "H8", "S13",
      "C6", "D3", "S10", "D8", "C3", "S3", "C10", "S11", "S14", "C5",
    ]);
  });
});

describe("weaponThreshold", () => {
  it("is null with no weapon", () => {
    expect(weaponThreshold(null)).toBeNull();
  });

  it("is null for a weapon with no kills, meaning unlimited", () => {
    expect(weaponThreshold({ card: makeCard("diamonds", 9), kills: [] })).toBeNull();
  });

  it("is the rank of the most recent kill", () => {
    const kills = [makeCard("spades", 12), makeCard("clubs", 10)];
    expect(weaponThreshold({ card: makeCard("diamonds", 9), kills })).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 3: Write `log.ts` and `actions.ts`**

`src/engine/log.ts`:

```ts
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
```

`src/engine/actions.ts`:

```ts
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
```

- [ ] **Step 4: Write `state.ts`**

```ts
import { buildDungeon, type Card } from "./cards";
import type { LogEntry } from "./log";
import { mulberry32, normalizeSeed, seedToInt, shuffle } from "./rng";

export const MAX_HEALTH = 20;
export const ROOM_SIZE = 4;

export type GameStatus = "playing" | "won" | "lost";

export type Weapon = {
  readonly card: Card;
  /** Defeated monsters, oldest first. The last element sets the threshold. */
  readonly kills: readonly Card[];
};

export type GameState = {
  readonly seed: string;
  readonly deck: readonly Card[];
  readonly room: readonly Card[];
  readonly discard: readonly Card[];
  readonly weapon: Weapon | null;
  readonly health: number;
  readonly potionUsedThisRoom: boolean;
  readonly ranLastRoom: boolean;
  readonly roomNumber: number;
  readonly status: GameStatus;
  readonly log: readonly LogEntry[];
};

/**
 * The highest monster value this weapon may still be used on is
 * strictly below the returned threshold. Null means no limit.
 */
export function weaponThreshold(weapon: Weapon | null): number | null {
  if (weapon === null) return null;
  // `.at(-1)` needs no type assertion, so the compiler stays the guarantor of
  // the empty case rather than a hand-written length guard.
  const lastKill = weapon.kills.at(-1);
  return lastKill === undefined ? null : lastKill.rank;
}

export function createGame(seed: string): GameState {
  const normalized = normalizeSeed(seed);
  if (normalized === null) throw new Error(`Invalid seed: ${JSON.stringify(seed)}`);

  const shuffled = shuffle(buildDungeon(), mulberry32(seedToInt(normalized)));
  const room = shuffled.slice(0, ROOM_SIZE);

  return {
    seed: normalized,
    deck: shuffled.slice(ROOM_SIZE),
    room,
    discard: [],
    weapon: null,
    health: MAX_HEALTH,
    potionUsedThisRoom: false,
    ranLastRoom: false,
    roomNumber: 1,
    status: "playing",
    // Copied, not aliased: `readonly` is compile-time only, so sharing the
    // array would let a future in-place room mutation silently rewrite history.
    log: [{ kind: "deal", roomNumber: 1, cards: [...room] }],
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/state.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/log.ts src/engine/actions.ts src/engine/state.ts src/engine/state.test.ts
git commit -m "feat(engine): game state, action and log types, createGame"
```

---

### Task 5: Legality

This is the single source of truth for what is playable. Rule interpretations 4, 6, and 7 live here.

**Files:**
- Create: `src/engine/legality.ts`, `src/engine/legality.test.ts`

**Interfaces:**
- Consumes: `Card`, `roleOf` (Task 2); `Action` (Task 4); `GameState`, `Weapon`, `MAX_HEALTH`, `ROOM_SIZE`, `weaponThreshold` (Task 4).
- Produces:
  ```ts
  export type ReasonCode = "NO_WEAPON" | "WEAPON_THRESHOLD" | "RAN_LAST_ROOM" | "ROOM_IN_PROGRESS";
  export type Effect =
    | { kind: "damage"; amount: number }
    | { kind: "heal"; amount: number; blocked: boolean }
    | { kind: "equip"; discards: Card | null }
    | { kind: "run" };
  export type Offer = {
    readonly action: Action;
    readonly enabled: boolean;
    readonly reason?: ReasonCode;
    readonly effect: Effect;
    readonly threshold?: number;
  };
  export function offersFor(state: GameState, card: Card): readonly Offer[];
  export function runOffer(state: GameState): Offer;
  export function isOffered(state: GameState, action: Action): boolean;
  ```

Ordering contract the UI depends on: for a monster, `offersFor` returns the weapon offer at index 0 and the barehanded offer at index 1, always both, regardless of enablement.

- [ ] **Step 1: Write the failing test**

`src/engine/legality.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { createGame, type GameState, type Weapon } from "./state";
import { isOffered, offersFor, runOffer } from "./legality";

const base = createGame("4F2A9C");
const withState = (patch: Partial<GameState>): GameState => ({ ...base, ...patch });
const weaponWith = (rank: number, killRanks: number[]): Weapon => ({
  card: makeCard("diamonds", rank),
  kills: killRanks.map((r) => makeCard("spades", r)),
});

describe("offersFor a monster", () => {
  const monster = makeCard("clubs", 8);

  it("always returns weapon offer then barehanded offer", () => {
    const offers = offersFor(withState({ weapon: null }), monster);
    expect(offers).toHaveLength(2);
    expect(offers[0]?.action).toEqual({ type: "FIGHT", cardId: "C8", useWeapon: true });
    expect(offers[1]?.action).toEqual({ type: "FIGHT", cardId: "C8", useWeapon: false });
  });

  it("disables the weapon offer with NO_WEAPON when unarmed", () => {
    const [weaponOffer] = offersFor(withState({ weapon: null }), monster);
    expect(weaponOffer?.enabled).toBe(false);
    expect(weaponOffer?.reason).toBe("NO_WEAPON");
  });

  it("enables a fresh weapon against any monster (rule 6)", () => {
    const state = withState({ weapon: weaponWith(5, []) });
    const [weaponOffer] = offersFor(state, makeCard("clubs", 14));
    expect(weaponOffer?.enabled).toBe(true);
    expect(weaponOffer?.effect).toEqual({ kind: "damage", amount: 9 });
  });

  it("disables the weapon offer at or above the threshold (rule 6)", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    const atThreshold = offersFor(state, makeCard("clubs", 10))[0];
    const above = offersFor(state, makeCard("clubs", 13))[0];
    const below = offersFor(state, makeCard("clubs", 9))[0];
    expect(atThreshold?.enabled).toBe(false);
    expect(atThreshold?.reason).toBe("WEAPON_THRESHOLD");
    expect(above?.enabled).toBe(false);
    expect(below?.enabled).toBe(true);
  });

  it("exposes the threshold for wording", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    expect(offersFor(state, makeCard("clubs", 13))[0]?.threshold).toBe(10);
  });

  it("floors weapon damage at zero but still offers the fight", () => {
    const state = withState({ weapon: weaponWith(9, []) });
    const [weaponOffer] = offersFor(state, makeCard("spades", 8));
    expect(weaponOffer?.enabled).toBe(true);
    expect(weaponOffer?.effect).toEqual({ kind: "damage", amount: 0 });
  });

  it("always enables barehanded at full monster value (rule 4)", () => {
    const state = withState({ weapon: weaponWith(10, []) });
    const bare = offersFor(state, makeCard("clubs", 3))[1];
    expect(bare?.enabled).toBe(true);
    expect(bare?.effect).toEqual({ kind: "damage", amount: 3 });
  });
});

describe("offersFor a potion", () => {
  const potion = makeCard("hearts", 7);

  it("offers a single always-enabled drink", () => {
    const offers = offersFor(withState({ health: 10 }), potion);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.action).toEqual({ type: "DRINK", cardId: "H7" });
    expect(offers[0]?.enabled).toBe(true);
  });

  it("heals the card value capped by missing health", () => {
    expect(offersFor(withState({ health: 10 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 7,
      blocked: false,
    });
    expect(offersFor(withState({ health: 15 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 5,
      blocked: false,
    });
  });

  it("heals zero at full health but is not blocked", () => {
    expect(offersFor(withState({ health: 20 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 0,
      blocked: false,
    });
  });

  it("stays enabled but blocked after a potion this room (rule 7)", () => {
    const offer = offersFor(withState({ health: 10, potionUsedThisRoom: true }), potion)[0];
    expect(offer?.enabled).toBe(true);
    expect(offer?.effect).toEqual({ kind: "heal", amount: 0, blocked: true });
  });
});

describe("offersFor a weapon card", () => {
  it("offers a single always-enabled equip naming what it discards (rule 5)", () => {
    const current = weaponWith(4, [6]);
    const offers = offersFor(withState({ weapon: current }), makeCard("diamonds", 9));
    expect(offers).toHaveLength(1);
    expect(offers[0]?.action).toEqual({ type: "EQUIP", cardId: "D9" });
    expect(offers[0]?.enabled).toBe(true);
    expect(offers[0]?.effect).toEqual({ kind: "equip", discards: current.card });
  });

  it("discards nothing when unarmed", () => {
    const offers = offersFor(withState({ weapon: null }), makeCard("diamonds", 9));
    expect(offers[0]?.effect).toEqual({ kind: "equip", discards: null });
  });
});

describe("runOffer", () => {
  it("is enabled on an untouched four-card room (rule 1)", () => {
    const offer = runOffer(base);
    expect(offer.enabled).toBe(true);
    expect(offer.action).toEqual({ type: "RUN" });
    expect(offer.effect).toEqual({ kind: "run" });
  });

  it("is disabled once a card has been resolved (rule 1)", () => {
    const offer = runOffer(withState({ room: base.room.slice(1) }));
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toBe("ROOM_IN_PROGRESS");
  });

  it("is disabled after running from the previous room (rule 1)", () => {
    const offer = runOffer(withState({ ranLastRoom: true }));
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toBe("RAN_LAST_ROOM");
  });

  it("is disabled once the game is over", () => {
    expect(runOffer(withState({ status: "lost" })).enabled).toBe(false);
  });
});

describe("isOffered", () => {
  it("accepts an offered action", () => {
    const card = base.room[0];
    if (card === undefined) throw new Error("fixture");
    const offer = offersFor(base, card)[0];
    if (offer === undefined) throw new Error("fixture");
    expect(isOffered(base, offer.action)).toBe(offer.enabled);
  });

  it("rejects an action for a card not in the room", () => {
    expect(isOffered(base, { type: "DRINK", cardId: "H2" })).toBe(
      base.room.some((c) => c.id === "H2"),
    );
    expect(isOffered(base, { type: "FIGHT", cardId: "NOPE", useWeapon: false })).toBe(false);
  });

  it("rejects a mismatched action for a card in the room", () => {
    const monster = base.room.find((c) => c.suit === "clubs" || c.suit === "spades");
    if (monster === undefined) throw new Error("fixture: seed 4F2A9C has no monster in room 1");
    expect(isOffered(base, { type: "DRINK", cardId: monster.id })).toBe(false);
  });

  it("always accepts NEW_GAME", () => {
    expect(isOffered(withState({ status: "lost" }), { type: "NEW_GAME" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/legality.test.ts`
Expected: FAIL — cannot resolve `./legality`.

- [ ] **Step 3: Write the implementation**

`src/engine/legality.ts`:

```ts
import type { Action } from "./actions";
import { roleOf, type Card } from "./cards";
import { MAX_HEALTH, ROOM_SIZE, weaponThreshold, type GameState } from "./state";

export type ReasonCode = "NO_WEAPON" | "WEAPON_THRESHOLD" | "RAN_LAST_ROOM" | "ROOM_IN_PROGRESS";

export type Effect =
  | { kind: "damage"; amount: number }
  | { kind: "heal"; amount: number; blocked: boolean }
  | { kind: "equip"; discards: Card | null }
  | { kind: "run" };

export type Offer = {
  readonly action: Action;
  readonly enabled: boolean;
  readonly reason?: ReasonCode;
  readonly effect: Effect;
  readonly threshold?: number;
};

/**
 * Offers for one face-up card. Monsters always yield exactly two offers,
 * weapon-first then barehanded, whether or not the weapon offer is enabled.
 */
export function offersFor(state: GameState, card: Card): readonly Offer[] {
  switch (roleOf(card)) {
    case "monster":
      return [monsterWeaponOffer(state, card), monsterBarehandedOffer(card)];
    case "potion":
      return [potionOffer(state, card)];
    case "weapon":
      return [equipOffer(state, card)];
  }
}

function monsterWeaponOffer(state: GameState, card: Card): Offer {
  const action: Action = { type: "FIGHT", cardId: card.id, useWeapon: true };
  const { weapon } = state;

  if (weapon === null) {
    return { action, enabled: false, reason: "NO_WEAPON", effect: { kind: "damage", amount: card.rank } };
  }

  const threshold = weaponThreshold(weapon);
  const damage = Math.max(0, card.rank - weapon.card.rank);

  if (threshold !== null && card.rank >= threshold) {
    return {
      action,
      enabled: false,
      reason: "WEAPON_THRESHOLD",
      effect: { kind: "damage", amount: damage },
      threshold,
    };
  }

  return threshold === null
    ? { action, enabled: true, effect: { kind: "damage", amount: damage } }
    : { action, enabled: true, effect: { kind: "damage", amount: damage }, threshold };
}

function monsterBarehandedOffer(card: Card): Offer {
  return {
    action: { type: "FIGHT", cardId: card.id, useWeapon: false },
    enabled: true,
    effect: { kind: "damage", amount: card.rank },
  };
}

function potionOffer(state: GameState, card: Card): Offer {
  const blocked = state.potionUsedThisRoom;
  const amount = blocked ? 0 : Math.min(card.rank, MAX_HEALTH - state.health);
  return {
    action: { type: "DRINK", cardId: card.id },
    enabled: true,
    effect: { kind: "heal", amount, blocked },
  };
}

function equipOffer(state: GameState, card: Card): Offer {
  return {
    action: { type: "EQUIP", cardId: card.id },
    enabled: true,
    effect: { kind: "equip", discards: state.weapon?.card ?? null },
  };
}

export function runOffer(state: GameState): Offer {
  const action: Action = { type: "RUN" };
  const effect: Effect = { kind: "run" };

  if (state.status !== "playing") {
    return { action, enabled: false, reason: "ROOM_IN_PROGRESS", effect };
  }
  if (state.ranLastRoom) {
    return { action, enabled: false, reason: "RAN_LAST_ROOM", effect };
  }
  if (state.room.length !== ROOM_SIZE) {
    return { action, enabled: false, reason: "ROOM_IN_PROGRESS", effect };
  }
  return { action, enabled: true, effect };
}

/** True when `action` is currently offered and enabled. Backs the reducer guard. */
export function isOffered(state: GameState, action: Action): boolean {
  if (action.type === "NEW_GAME") return true;
  if (state.status !== "playing") return false;
  if (action.type === "RUN") return runOffer(state).enabled;

  const card = state.room.find((c) => c.id === action.cardId);
  if (card === undefined) return false;

  return offersFor(state, card).some(
    (offer) => offer.enabled && sameAction(offer.action, action),
  );
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "FIGHT" && b.type === "FIGHT") {
    return a.cardId === b.cardId && a.useWeapon === b.useWeapon;
  }
  if ((a.type === "DRINK" || a.type === "EQUIP") && (b.type === "DRINK" || b.type === "EQUIP")) {
    return a.cardId === b.cardId;
  }
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/legality.test.ts`
Expected: PASS, 20 tests. If the `isOffered` "mismatched action" test throws its fixture error, seed `4F2A9C` happens to deal no monster in room 1 — replace the seed in that one test with `000001` and re-check.

- [ ] **Step 5: Commit**

```bash
git add src/engine/legality.ts src/engine/legality.test.ts
git commit -m "feat(engine): legality offers for every card and the run action"
```

---

### Task 6: Scoring and shared test fixtures

Rule interpretation 10 is proved here. This task also creates the state fixtures every later
engine task builds on.

**Files:**
- Create: `src/engine/test-fixtures.ts`, `src/engine/scoring.ts`, `src/engine/scoring.test.ts`
- Modify: `src/engine/legality.test.ts` (switch onto the shared fixtures)

**Interfaces:**
- Consumes: `Card`, `Suit`, `makeCard`, `roleOf`, `buildDungeon` (Task 2); `GameState`, `Weapon` (Task 4).
- Produces:
  ```ts
  export function remainingMonsterValue(state: GameState): number;
  export function finalScore(state: GameState): number;
  // test-fixtures.ts (test-only, never imported by src/ui or src/storage)
  export const c: (suit: Suit, rank: number) => Card;
  export function stateWith(patch: Partial<GameState>): GameState;
  export function weaponOf(rank: number, killRanks?: number[]): Weapon;
  ```

Scoring comes before the reducer because `reduce.ts` needs `finalScore` for its game-over log
entry. Every test here builds states by hand, so nothing depends on `applyAction`.

- [ ] **Step 1: Create the shared test fixtures**

`src/engine/test-fixtures.ts`:

```ts
import { makeCard, type Card, type Suit } from "./cards";
import type { GameState, Weapon } from "./state";

/** Shorthand card builder for tests. */
export const c = (suit: Suit, rank: number): Card => makeCard(suit, rank);

/** A minimal playing state. Override only what a test cares about. */
export function stateWith(patch: Partial<GameState>): GameState {
  return {
    seed: "000001",
    deck: [],
    room: [],
    discard: [],
    weapon: null,
    health: 20,
    potionUsedThisRoom: false,
    ranLastRoom: false,
    roomNumber: 1,
    status: "playing",
    log: [],
    ...patch,
  };
}

/** A diamond of `rank` that has already killed the given spade ranks, oldest first. */
export function weaponOf(rank: number, killRanks: number[] = []): Weapon {
  return { card: makeCard("diamonds", rank), kills: killRanks.map((r) => makeCard("spades", r)) };
}
```

- [ ] **Step 2: Write the failing test**

`src/engine/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDungeon } from "./cards";
import { finalScore, remainingMonsterValue } from "./scoring";
import { c, stateWith } from "./test-fixtures";

describe("remainingMonsterValue", () => {
  it("counts monsters in the deck and the room, ignoring hearts and diamonds", () => {
    const state = stateWith({
      deck: [c("clubs", 14), c("hearts", 9), c("diamonds", 8)],
      room: [c("spades", 13), c("hearts", 2)],
    });
    expect(remainingMonsterValue(state)).toBe(27);
  });

  it("is 208 for a whole unplayed dungeon", () => {
    expect(remainingMonsterValue(stateWith({ deck: buildDungeon() }))).toBe(208);
  });

  it("ignores the discard pile and the weapon stack", () => {
    const state = stateWith({
      deck: [c("clubs", 5)],
      discard: [c("clubs", 14)],
      weapon: { card: c("diamonds", 9), kills: [c("spades", 13)] },
    });
    expect(remainingMonsterValue(state)).toBe(5);
  });

  it("is 0 when nothing is left", () => {
    expect(remainingMonsterValue(stateWith({}))).toBe(0);
  });
});

describe("finalScore", () => {
  it("is the remaining health on a win", () => {
    expect(finalScore(stateWith({ status: "won", health: 14 }))).toBe(14);
  });

  it("is the negated remaining monster value on a loss (rule 10)", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [c("clubs", 14), c("clubs", 13)],
      room: [c("spades", 12), c("hearts", 5)],
    });
    expect(finalScore(state)).toBe(-39);
  });

  it("excludes the monster that killed you, since it was resolved into the discard", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [c("spades", 3)],
      room: [c("clubs", 5)],
      discard: [c("clubs", 14)],
    });
    expect(finalScore(state)).toBe(-8);
  });

  it("is 0 when you die on the dungeon's final card", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [],
      room: [],
      discard: [c("clubs", 14)],
    });
    expect(finalScore(state)).toBe(0);
  });

  it("throws while the game is still in progress", () => {
    expect(() => finalScore(stateWith({ status: "playing" }))).toThrow(/in progress/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/engine/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 4: Write the implementation**

`src/engine/scoring.ts`:

```ts
import { roleOf, type Card } from "./cards";
import type { GameState } from "./state";

/** Monster value still unresolved: the deck plus the face-up room, nothing else. */
export function remainingMonsterValue(state: GameState): number {
  return [...state.deck, ...state.room]
    .filter((card: Card) => roleOf(card) === "monster")
    .reduce((sum, card) => sum + card.rank, 0);
}

export function finalScore(state: GameState): number {
  if (state.status === "won") return state.health;
  if (state.status === "lost") return -remainingMonsterValue(state);
  throw new Error("finalScore called on a game still in progress");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/engine/scoring.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Move `legality.test.ts` onto the shared fixtures**

In `src/engine/legality.test.ts`, delete the local `base`, `withState`, and `weaponWith` helpers and the `createGame` import. Replace with:

```ts
import { c, stateWith, weaponOf } from "./test-fixtures";

const base = stateWith({ room: [c("clubs", 8), c("hearts", 7), c("diamonds", 5), c("spades", 13)] });
const withState = (patch: Parameters<typeof stateWith>[0]) => ({ ...base, ...patch });
const weaponWith = weaponOf;
```

The three `isOffered` tests that referenced seed `4F2A9C` fixtures now use this deterministic room, so delete their `throw new Error("fixture")` guards and address the cards directly: `C8` is the monster, `H7` the potion, `D5` the weapon.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: PASS. All engine tests green, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/engine/test-fixtures.ts src/engine/scoring.ts src/engine/scoring.test.ts src/engine/legality.test.ts
git commit -m "feat(engine): scoring and shared state fixtures

Scoring lands before the reducer because reduce.ts needs finalScore for its
game-over log entry. All scoring tests build states by hand, so this task
does not depend on applyAction."
```

---

### Task 7: Reducer — fight, settle, deal

Rule interpretations 2, 3, 4, 6, and 9 are proved here.

**Files:**
- Create: `src/engine/reduce.ts`, `src/engine/reduce.test.ts`

**Interfaces:**
- Consumes: `Card`, `makeCard` (Task 2); `Action`, `IllegalActionError` (Task 4); `GameState`, `Weapon`, `MAX_HEALTH`, `ROOM_SIZE`, `createGame` (Task 4); `offersFor`, `isOffered` (Task 5); `finalScore` (Task 6); `c`, `stateWith`, `weaponOf` from `test-fixtures` (Task 6).
- Produces:
  ```ts
  export function applyAction(state: GameState, action: Action): GameState;
  ```

`applyAction` throws `IllegalActionError` for anything `isOffered` rejects. `RUN` and `NEW_GAME` are not implemented in this task; their switch arms throw a clearly labelled `IllegalActionError` that Tasks 8 and 9 replace.

- [ ] **Step 1: Write the failing test**

`src/engine/reduce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { IllegalActionError } from "./actions";
import { applyAction } from "./reduce";
import { c, stateWith, weaponOf } from "./test-fixtures";

describe("fight barehanded", () => {
  it("takes the monster's full value and discards it", () => {
    const monster = c("clubs", 8);
    const next = applyAction(
      stateWith({ room: [monster, c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 20 }),
      { type: "FIGHT", cardId: "C8", useWeapon: false },
    );
    expect(next.health).toBe(12);
    expect(next.room.map((x) => x.id)).toEqual(["H2", "H3", "H4"]);
    expect(next.discard).toEqual([monster]);
    expect(next.weapon).toBeNull();
  });

  it("is allowed while holding a legal weapon, leaving the weapon untouched (rule 4)", () => {
    const armed = weaponOf(10);
    const next = applyAction(
      stateWith({ room: [c("clubs", 3), c("hearts", 2), c("hearts", 3), c("hearts", 4)], weapon: armed }),
      { type: "FIGHT", cardId: "C3", useWeapon: false },
    );
    expect(next.weapon).toEqual(armed);
    expect(next.health).toBe(17);
  });

  it("logs the fight", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)] }),
      { type: "FIGHT", cardId: "C8", useWeapon: false },
    );
    expect(next.log).toContainEqual({
      kind: "fight", monster: c("clubs", 8), weapon: null, damage: 8, healthAfter: 12,
    });
  });
});

describe("fight with a weapon", () => {
  it("takes only the difference and stacks the monster on the weapon", () => {
    const next = applyAction(
      stateWith({
        room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
        weapon: weaponOf(5),
      }),
      { type: "FIGHT", cardId: "C8", useWeapon: true },
    );
    expect(next.health).toBe(17);
    expect(next.weapon?.kills.map((x) => x.id)).toEqual(["C8"]);
    expect(next.discard).toEqual([]);
  });

  it("floors damage at zero but still lowers the threshold (rule 6)", () => {
    const next = applyAction(
      stateWith({
        room: [c("spades", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
        weapon: weaponOf(9),
      }),
      { type: "FIGHT", cardId: "S8", useWeapon: true },
    );
    expect(next.health).toBe(20);
    expect(next.weapon?.kills.map((x) => x.rank)).toEqual([8]);
  });

  it("refuses a monster at or above the threshold (rule 6)", () => {
    const state = stateWith({
      room: [c("clubs", 10), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
      weapon: weaponOf(9, [10]),
    });
    expect(() => applyAction(state, { type: "FIGHT", cardId: "C10", useWeapon: true })).toThrow(
      IllegalActionError,
    );
  });

  it("refuses a weapon fight when unarmed", () => {
    const state = stateWith({ room: [c("clubs", 4), c("hearts", 2), c("hearts", 3), c("hearts", 4)] });
    expect(() => applyAction(state, { type: "FIGHT", cardId: "C4", useWeapon: true })).toThrow(
      IllegalActionError,
    );
  });
});

describe("death (rule 9)", () => {
  it("clamps health to zero and ends the game", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.health).toBe(0);
    expect(next.status).toBe("lost");
  });

  it("logs game over", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.log.at(-1)).toMatchObject({ kind: "gameOver", outcome: "lost" });
  });

  it("rejects any further action", () => {
    const dead = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(() => applyAction(dead, { type: "DRINK", cardId: "H2" })).toThrow(IllegalActionError);
  });

  it("does not deal a new room on death", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2)], deck: [c("clubs", 2), c("clubs", 3)], health: 1 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.room.map((x) => x.id)).toEqual(["H2"]);
    expect(next.deck).toHaveLength(2);
  });
});

describe("room refill (rule 2)", () => {
  it("deals three new cards when one card is left, keeping the carried card first", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6), c("spades", 7), c("spades", 8)],
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });

    expect(next.room.map((x) => x.id)).toEqual(["H9", "S5", "S6", "S7"]);
    expect(next.deck.map((x) => x.id)).toEqual(["S8"]);
    expect(next.roomNumber).toBe(2);
  });

  it("resets the potion flag and clears ranLastRoom on the deal", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6), c("spades", 7)],
      potionUsedThisRoom: true,
      ranLastRoom: true,
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.ranLastRoom).toBe(false);
  });

  it("logs only the newly dealt cards", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6)],
    });
    const next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.log.at(-1)).toEqual({ kind: "deal", roomNumber: 2, cards: [c("spades", 5), c("spades", 6)] });
  });
});

describe("short final room and winning (rule 3)", () => {
  it("deals fewer than three when the deck runs short", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6)],
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });
    expect(next.room.map((x) => x.id)).toEqual(["H9", "S5", "S6"]);
    expect(next.deck).toEqual([]);
  });

  it("requires every card of a short room to be resolved, then wins", () => {
    let next = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4)], deck: [] });
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.status).toBe("playing");
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    expect(next.status).toBe("playing");
    expect(next.room).toHaveLength(1);
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });
    expect(next.status).toBe("won");
    expect(next.room).toEqual([]);
  });

  it("logs game over on the win with the remaining health as score", () => {
    let next = stateWith({ room: [c("clubs", 2)], deck: [], health: 14 });
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.log.at(-1)).toEqual({ kind: "gameOver", outcome: "won", score: 12 });
  });
});

describe("guards", () => {
  it("rejects an action for a card that is not in the room", () => {
    expect(() =>
      applyAction(stateWith({ room: [c("clubs", 2)] }), { type: "FIGHT", cardId: "C9", useWeapon: false }),
    ).toThrow(IllegalActionError);
  });

  it("never mutates the input state", () => {
    const state = stateWith({ room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)] });
    const snapshot = structuredClone(state);
    applyAction(state, { type: "FIGHT", cardId: "C8", useWeapon: false });
    expect(state).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/reduce.test.ts`
Expected: FAIL — cannot resolve `./reduce`.

- [ ] **Step 3: Write `reduce.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/reduce.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. All engine tests green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/reduce.ts src/engine/reduce.test.ts
git commit -m "feat(engine): reducer with fight, settle, deal, and win/loss detection"
```

---

### Task 8: Reducer — drink and equip

Rule interpretations 5 and 7 are proved here.

**Files:**
- Modify: `src/engine/reduce.ts`
- Create: `src/engine/reduce-items.test.ts`

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: no new exports. `applyAction` now handles `DRINK` and `EQUIP`.

- [ ] **Step 1: Write the failing test**

`src/engine/reduce-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyAction } from "./reduce";
import { c, stateWith, weaponOf } from "./test-fixtures";

const room = (...ids: ReturnType<typeof c>[]) => ids;

describe("drink", () => {
  it("heals the card value and discards the card", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 10 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.health).toBe(17);
    expect(next.discard).toEqual([c("hearts", 7)]);
    expect(next.room.map((x) => x.id)).toEqual(["C2", "C3", "C4"]);
  });

  it("caps healing at 20", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 15 }),
      { type: "DRINK", cardId: "H9" },
    );
    expect(next.health).toBe(20);
  });

  it("sets the potion flag", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 10 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.potionUsedThisRoom).toBe(true);
  });

  it("consumes the potion slot even at full health", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 20 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.health).toBe(20);
    expect(next.potionUsedThisRoom).toBe(true);
    expect(next.log.at(-1)).toEqual({
      kind: "potion", card: c("hearts", 7), healed: 0, blocked: false, healthAfter: 20,
    });
  });

  it("resolves a second potion in the same room without healing (rule 7)", () => {
    const state = stateWith({
      room: room(c("hearts", 7), c("hearts", 8), c("clubs", 2), c("clubs", 3)),
      health: 5,
    });
    const afterFirst = applyAction(state, { type: "DRINK", cardId: "H7" });
    expect(afterFirst.health).toBe(12);

    const afterSecond = applyAction(afterFirst, { type: "DRINK", cardId: "H8" });
    expect(afterSecond.health).toBe(12);
    expect(afterSecond.discard.map((x) => x.id)).toEqual(["H7", "H8"]);
    expect(afterSecond.log.at(-1)).toEqual({
      kind: "potion", card: c("hearts", 8), healed: 0, blocked: true, healthAfter: 12,
    });
  });

  it("lets a carried potion heal in the next room (rule 7)", () => {
    const state = stateWith({
      room: room(c("hearts", 7), c("hearts", 8), c("clubs", 2), c("clubs", 3)),
      deck: [c("clubs", 5), c("clubs", 6), c("clubs", 7)],
      health: 5,
    });
    let next = applyAction(state, { type: "DRINK", cardId: "H7" });   // heals to 12
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });  // 10
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });  // 7, deals room 2
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.room[0]?.id).toBe("H8");

    next = applyAction(next, { type: "DRINK", cardId: "H8" });
    expect(next.health).toBe(15);
  });
});

describe("equip", () => {
  it("equips a fresh weapon with no kills", () => {
    const next = applyAction(
      stateWith({ room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)) }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.weapon).toEqual({ card: c("diamonds", 9), kills: [] });
    expect(next.room.map((x) => x.id)).toEqual(["C2", "C3", "C4"]);
    expect(next.discard).toEqual([]);
  });

  it("discards the old weapon and its whole kill stack (rule 5)", () => {
    const old = weaponOf(4, [11, 7]);
    const next = applyAction(
      stateWith({ room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)), weapon: old }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.weapon).toEqual({ card: c("diamonds", 9), kills: [] });
    expect(next.discard.map((x) => x.id)).toEqual(["D4", "S11", "S7"]);
  });

  it("resets the threshold so the new weapon can kill anything", () => {
    let next = applyAction(
      stateWith({
        room: room(c("diamonds", 9), c("clubs", 13), c("clubs", 3), c("clubs", 4)),
        weapon: weaponOf(4, [2]),
      }),
      { type: "EQUIP", cardId: "D9" },
    );
    next = applyAction(next, { type: "FIGHT", cardId: "C13", useWeapon: true });
    expect(next.health).toBe(16);
    expect(next.weapon?.kills.map((x) => x.id)).toEqual(["C13"]);
  });

  it("logs what was discarded", () => {
    const next = applyAction(
      stateWith({
        room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)),
        weapon: weaponOf(4),
      }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.log.at(-1)).toEqual({
      kind: "equip", weapon: c("diamonds", 9), discarded: c("diamonds", 4),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/reduce-items.test.ts`
Expected: FAIL — "DRINK not implemented until Task 8".

- [ ] **Step 3: Replace the stub arms in `reduce.ts`**

Change the switch to:

```ts
  switch (action.type) {
    case "FIGHT":
      return settle(fight(state, card, action.useWeapon));
    case "DRINK":
      return settle(drink(state, card));
    case "EQUIP":
      return settle(equip(state, card));
  }
```

Add these two functions below `fight`, and add `MAX_HEALTH` to the `./state` import at the top of the file — `drink` is the first consumer of it:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/reduce-items.test.ts && npm test`
Expected: PASS, 10 new tests, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/reduce.ts src/engine/reduce-items.test.ts
git commit -m "feat(engine): drink and equip, with per-room potion limit and weapon replacement"
```

---

### Task 9: Reducer — run away and new game

Rule interpretations 1 and 8 are proved here.

**Files:**
- Modify: `src/engine/reduce.ts`
- Create: `src/engine/reduce-run.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 7 and 8.
- Produces: no new exports. `applyAction` now handles all five action types.

- [ ] **Step 1: Write the failing test**

`src/engine/reduce-run.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { IllegalActionError } from "./actions";
import { applyAction } from "./reduce";
import { c, stateWith } from "./test-fixtures";

const fullRoom = [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)];
const deckOf6 = [c("spades", 6), c("spades", 7), c("spades", 8), c("spades", 9), c("spades", 10), c("spades", 11)];

describe("run away", () => {
  it("sends all four cards to the bottom in display order (rule 8)", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(next.room.map((x) => x.id)).toEqual(["S6", "S7", "S8", "S9"]);
    expect(next.deck.map((x) => x.id)).toEqual(["S10", "S11", "C2", "C3", "C4", "C5"]);
  });

  it("marks the room as run from and resets the potion flag", () => {
    const next = applyAction(
      stateWith({ room: fullRoom, deck: deckOf6, potionUsedThisRoom: true }),
      { type: "RUN" },
    );
    expect(next.ranLastRoom).toBe(true);
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.roomNumber).toBe(2);
  });

  it("logs the run and the replacement deal", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(next.log.slice(-2)).toEqual([
      { kind: "run", roomNumber: 1 },
      { kind: "deal", roomNumber: 2, cards: [c("spades", 6), c("spades", 7), c("spades", 8), c("spades", 9)] },
    ]);
  });

  it("refuses two runs in a row (rule 1)", () => {
    const afterRun = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(() => applyAction(afterRun, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("allows running again after a room is resolved normally (rule 1)", () => {
    let next = applyAction(
      stateWith({ room: fullRoom, deck: [...deckOf6, c("spades", 12), c("spades", 13)] }),
      { type: "RUN" },
    );
    expect(next.ranLastRoom).toBe(true);
    for (const id of ["S6", "S7", "S8"]) {
      next = applyAction(next, { type: "FIGHT", cardId: id, useWeapon: false });
    }
    expect(next.ranLastRoom).toBe(false);
    expect(() => applyAction(next, { type: "RUN" })).not.toThrow();
  });

  it("refuses once a card has been resolved this room (rule 1)", () => {
    const started = applyAction(
      stateWith({ room: fullRoom, deck: deckOf6 }),
      { type: "FIGHT", cardId: "C2", useWeapon: false },
    );
    expect(started.room).toHaveLength(3);
    expect(() => applyAction(started, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("refuses in a short final room", () => {
    const state = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4)], deck: [] });
    expect(() => applyAction(state, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("never changes health or ends the game", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6, health: 7 }), { type: "RUN" });
    expect(next.health).toBe(7);
    expect(next.status).toBe("playing");
  });
});

describe("new game", () => {
  it("starts a fresh dungeon from the given seed", () => {
    const next = applyAction(stateWith({ room: fullRoom, health: 3 }), {
      type: "NEW_GAME",
      seed: "4F2A9C",
    });
    expect(next.seed).toBe("4F2A9C");
    expect(next.health).toBe(20);
    expect(next.room).toHaveLength(4);
    expect(next.deck).toHaveLength(40);
    expect(next.status).toBe("playing");
  });

  it("works from a finished game", () => {
    const dead = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 2 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(dead.status).toBe("lost");
    expect(applyAction(dead, { type: "NEW_GAME", seed: "000123" }).status).toBe("playing");
  });

  it("rejects an invalid seed", () => {
    expect(() => applyAction(stateWith({}), { type: "NEW_GAME", seed: "zzz" })).toThrow(/seed/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/reduce-run.test.ts`
Expected: FAIL — "RUN not implemented until Task 9".

- [ ] **Step 3: Replace the RUN stub in `reduce.ts`**

Replace:

```ts
  if (action.type === "RUN") {
    throw new IllegalActionError("RUN not implemented until Task 9");
  }
```

with:

```ts
  // RUN deals its own room because it must set ranLastRoom. It bypasses settle
  // safely: it cannot change health and always leaves a full room, so neither
  // the loss nor the win condition is reachable from it.
  if (action.type === "RUN") return runAway(state);
```

Add below `equip`:

```ts
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
    { kind: "deal", roomNumber, cards: dealt },
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/reduce-run.test.ts && npm test`
Expected: PASS, 11 new tests, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/reduce.ts src/engine/reduce-run.test.ts
git commit -m "feat(engine): run away and new game, completing the reducer"
```

---

### Task 10: Invariants, state validation, and the public barrel

This is the task that catches the bugs the per-rule tests miss, and it completes the engine.

**Files:**
- Create: `src/engine/invariants.ts`, `src/engine/invariants.test.ts`, `src/engine/index.ts`

**Interfaces:**
- Consumes: everything in `src/engine/`.
- Produces:
  ```ts
  export class InvariantError extends Error {}
  export function assertInvariants(state: GameState): void;   // throws InvariantError
  export function validateState(candidate: unknown): GameState | null;  // shape + invariants
  ```
  and `src/engine/index.ts`, re-exporting every public type and function.

- [ ] **Step 1: Write the failing test**

`src/engine/invariants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Action } from "./actions";
import { buildDungeon } from "./cards";
import { assertInvariants, InvariantError, validateState } from "./invariants";
import { offersFor, runOffer } from "./legality";
import { applyAction } from "./reduce";
import { createGame, type GameState } from "./state";
import { c, stateWith, weaponOf } from "./test-fixtures";

describe("assertInvariants", () => {
  it("accepts a fresh game", () => {
    expect(() => assertInvariants(createGame("4F2A9C"))).not.toThrow();
  });

  it("rejects a missing card", () => {
    const state = createGame("4F2A9C");
    expect(() => assertInvariants({ ...state, deck: state.deck.slice(1) })).toThrow(InvariantError);
  });

  it("rejects a duplicated card", () => {
    const state = createGame("4F2A9C");
    const first = state.deck[0];
    if (first === undefined) throw new Error("fixture");
    expect(() => assertInvariants({ ...state, discard: [first] })).toThrow(InvariantError);
  });

  it("rejects health outside 0..20", () => {
    const state = createGame("4F2A9C");
    expect(() => assertInvariants({ ...state, health: 21 })).toThrow(InvariantError);
    expect(() => assertInvariants({ ...state, health: -1 })).toThrow(InvariantError);
  });

  it("rejects an oversized room", () => {
    const state = createGame("4F2A9C");
    const extra = state.deck[0];
    if (extra === undefined) throw new Error("fixture");
    expect(() =>
      assertInvariants({ ...state, room: [...state.room, extra], deck: state.deck.slice(1) }),
    ).toThrow(InvariantError);
  });

  it("rejects a weapon kill stack that is not strictly descending", () => {
    const deck = buildDungeon().filter((x) => !["D9", "S4", "S8"].includes(x.id));
    expect(() =>
      assertInvariants(stateWith({ deck, weapon: { card: c("diamonds", 9), kills: [c("spades", 4), c("spades", 8)] } })),
    ).toThrow(InvariantError);
  });

  it("rejects a live game with an empty room and an empty deck", () => {
    expect(() => assertInvariants(stateWith({ deck: [], room: [], discard: buildDungeon() }))).toThrow(
      InvariantError,
    );
  });
});

describe("invariants hold across random legal play", () => {
  /** Deterministic pseudo-random pick so any failure reproduces exactly. */
  function pick<T>(items: readonly T[], roll: number): T {
    const item = items[roll % items.length];
    if (item === undefined) throw new Error("pick from empty list");
    return item;
  }

  function legalActions(state: GameState): Action[] {
    const actions: Action[] = state.room.flatMap((card) =>
      offersFor(state, card).filter((o) => o.enabled).map((o) => o.action),
    );
    const run = runOffer(state);
    if (run.enabled) actions.push(run.action);
    return actions;
  }

  for (const seedInt of [1, 2, 3, 17, 99, 1234, 65535, 16777215]) {
    const seed = seedInt.toString(16).toUpperCase().padStart(6, "0");

    it(`holds for every step of seed ${seed}`, () => {
      let state = createGame(seed);
      assertInvariants(state);

      let roll = seedInt;
      let steps = 0;
      while (state.status === "playing" && steps < 500) {
        const actions = legalActions(state);
        expect(actions.length).toBeGreaterThan(0);   // never deadlocks
        roll = (roll * 1103515245 + 12345) >>> 0;
        state = applyAction(state, pick(actions, roll));
        assertInvariants(state);
        steps += 1;
      }

      expect(state.status).not.toBe("playing");
      expect(steps).toBeLessThan(500);
    });
  }
});

describe("validateState", () => {
  it("accepts a round-tripped game", () => {
    const state = createGame("4F2A9C");
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects non-objects, wrong shapes, and invariant violations", () => {
    const state = createGame("4F2A9C");
    expect(validateState(null)).toBeNull();
    expect(validateState("nope")).toBeNull();
    expect(validateState({})).toBeNull();
    expect(validateState({ ...state, health: "twenty" })).toBeNull();
    expect(validateState({ ...state, status: "bogus" })).toBeNull();
    expect(validateState({ ...state, seed: "nope" })).toBeNull();
    expect(validateState({ ...state, deck: state.deck.slice(1) })).toBeNull();
    expect(validateState({ ...state, room: [{ id: "S8" }] })).toBeNull();
  });

  it("accepts a state with an equipped weapon", () => {
    const deck = buildDungeon().filter((x) => !["D9", "S11"].includes(x.id));
    const state = stateWith({ deck, weapon: weaponOf(9, [11]) });
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/invariants.test.ts`
Expected: FAIL — cannot resolve `./invariants`.

- [ ] **Step 3: Write the implementation**

`src/engine/invariants.ts`:

```ts
import { buildDungeon, roleOf, type Card, type Suit } from "./cards";
import { normalizeSeed } from "./rng";
import { MAX_HEALTH, ROOM_SIZE, type GameState, type GameStatus } from "./state";

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

const DECK_SIZE = buildDungeon().length;
const VALID_IDS = new Set(buildDungeon().map((card) => card.id));

function fail(message: string): never {
  throw new InvariantError(message);
}

/** Throws InvariantError if `state` is not a reachable Scoundrel position. */
export function assertInvariants(state: GameState): void {
  const all: Card[] = [
    ...state.deck,
    ...state.room,
    ...state.discard,
    ...(state.weapon === null ? [] : [state.weapon.card, ...state.weapon.kills]),
  ];

  if (all.length !== DECK_SIZE) fail(`Expected ${DECK_SIZE} cards, found ${all.length}`);

  const ids = new Set(all.map((card) => card.id));
  if (ids.size !== DECK_SIZE) fail("Duplicate card ids");
  for (const id of ids) if (!VALID_IDS.has(id)) fail(`Unknown card id: ${id}`);

  if (state.health < 0 || state.health > MAX_HEALTH) fail(`Health out of range: ${state.health}`);
  if (state.room.length > ROOM_SIZE) fail(`Room too large: ${state.room.length}`);
  if (state.roomNumber < 1) fail(`Room number out of range: ${state.roomNumber}`);
  if (normalizeSeed(state.seed) === null) fail(`Invalid seed: ${state.seed}`);

  if (state.weapon !== null) {
    if (roleOf(state.weapon.card) !== "weapon") fail("Equipped card is not a diamond");
    let previous = Number.POSITIVE_INFINITY;
    for (const kill of state.weapon.kills) {
      if (roleOf(kill) !== "monster") fail("Weapon stack holds a non-monster");
      if (kill.rank >= previous) fail("Weapon kills are not strictly descending");
      previous = kill.rank;
    }
  }

  if (state.status === "playing") {
    if (state.health === 0) fail("Playing at zero health");
    if (state.room.length === 0 && state.deck.length === 0) fail("Playing with nothing left");
  }
  if (state.status === "lost" && state.health !== 0) fail("Lost with health remaining");
  if (state.status === "won" && (state.room.length > 0 || state.deck.length > 0)) {
    fail("Won with cards remaining");
  }
}

const SUITS: readonly Suit[] = ["clubs", "spades", "diamonds", "hearts"];
const STATUSES: readonly GameStatus[] = ["playing", "won", "lost"];

function isCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card["id"] === "string" &&
    typeof card["rank"] === "number" &&
    typeof card["suit"] === "string" &&
    SUITS.includes(card["suit"] as Suit) &&
    VALID_IDS.has(card["id"])
  );
}

function isCardArray(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard);
}

/**
 * Validates untrusted input (a localStorage payload) into a GameState.
 * Returns null rather than throwing, because a bad save is expected, not exceptional.
 */
export function validateState(candidate: unknown): GameState | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const raw = candidate as Record<string, unknown>;

  if (typeof raw["seed"] !== "string") return null;
  if (typeof raw["health"] !== "number" || !Number.isInteger(raw["health"])) return null;
  if (typeof raw["potionUsedThisRoom"] !== "boolean") return null;
  if (typeof raw["ranLastRoom"] !== "boolean") return null;
  if (typeof raw["roomNumber"] !== "number" || !Number.isInteger(raw["roomNumber"])) return null;
  if (typeof raw["status"] !== "string" || !STATUSES.includes(raw["status"] as GameStatus)) return null;
  if (!isCardArray(raw["deck"]) || !isCardArray(raw["room"]) || !isCardArray(raw["discard"])) return null;
  if (!Array.isArray(raw["log"])) return null;

  const weaponRaw = raw["weapon"];
  if (weaponRaw !== null) {
    if (typeof weaponRaw !== "object" || weaponRaw === null) return null;
    const weapon = weaponRaw as Record<string, unknown>;
    if (!isCard(weapon["card"]) || !isCardArray(weapon["kills"])) return null;
  }

  const state = candidate as GameState;
  try {
    assertInvariants(state);
  } catch {
    return null;
  }
  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/invariants.test.ts`
Expected: PASS, 12 tests. The eight property tests each play a full random game asserting invariants after every step.

If a property test fails, the seed in the test name reproduces it exactly. Do not weaken the invariant — fix the reducer.

- [ ] **Step 5: Write the public barrel**

`src/engine/index.ts` — only what `storage/` and `ui/` actually consume. `mulberry32`, `seedToInt`, `shuffle`, and `SUIT_LETTER` are deliberately absent: they are engine internals, and engine tests import them by relative path.

```ts
export { buildDungeon, makeCard, roleOf } from "./cards";
export type { Card, Role, Suit } from "./cards";

export { IllegalActionError } from "./actions";
export type { Action } from "./actions";

export type { LogEntry } from "./log";

export { normalizeSeed, SEED_PATTERN } from "./rng";

export { createGame, MAX_HEALTH, ROOM_SIZE, weaponThreshold } from "./state";
export type { GameState, GameStatus, Weapon } from "./state";

export { isOffered, offersFor, runOffer } from "./legality";
export type { Effect, Offer, ReasonCode } from "./legality";

export { applyAction } from "./reduce";
export { finalScore, remainingMonsterValue } from "./scoring";
export { assertInvariants, InvariantError, validateState } from "./invariants";
```

- [ ] **Step 6: Verify the whole engine**

Run: `npm test && npm run typecheck`
Expected: PASS, everything green, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/engine/invariants.ts src/engine/invariants.test.ts src/engine/index.ts
git commit -m "feat(engine): invariants, untrusted-state validation, and public barrel

The property test plays eight full games of random legal moves, asserting
after every step that all 44 cards exist exactly once, health stays in
range, and the weapon stack descends strictly. It also asserts a legal
move always exists, which is what proves a two-heart room cannot deadlock."
```

---

### Task 11: Persistence

**Files:**
- Create: `src/storage/persistence.ts`, `src/storage/persistence.test.ts`

**Interfaces:**
- Consumes: `GameState`, `validateState`, `createGame` from `../engine` (Task 10).
- Produces:
  ```ts
  export const SCHEMA = 1;
  export type SavedRun = { schema: number; state: GameState; statsRecorded: boolean };
  export type Stats = { schema: number; best: number | null; played: number; won: number };
  export const EMPTY_STATS: Stats;
  export function loadRun(): SavedRun | null;
  export function saveRun(run: SavedRun): void;
  export function loadStats(): Stats;
  export function saveStats(stats: Stats): void;
  export function recordResult(stats: Stats, outcome: "won" | "lost", score: number): Stats;
  ```

Every read returns a safe fallback rather than throwing. Every write is best-effort.

- [ ] **Step 1: Write the failing test**

`src/storage/persistence.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../engine";
import {
  EMPTY_STATS, SCHEMA, loadRun, loadStats, recordResult, saveRun, saveStats,
} from "./persistence";

const RUN_KEY = "scoundrel.run";
const STATS_KEY = "scoundrel.stats";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("run round trip", () => {
  it("returns null when nothing is stored", () => {
    expect(loadRun()).toBeNull();
  });

  it("saves and restores a run exactly", () => {
    const state = createGame("4F2A9C");
    saveRun({ schema: SCHEMA, state, statsRecorded: false });
    expect(loadRun()).toEqual({ schema: SCHEMA, state, statsRecorded: false });
  });

  it("preserves the statsRecorded flag", () => {
    saveRun({ schema: SCHEMA, state: createGame("000001"), statsRecorded: true });
    expect(loadRun()?.statsRecorded).toBe(true);
  });
});

describe("run rejection", () => {
  it("rejects unparseable JSON", () => {
    window.localStorage.setItem(RUN_KEY, "{not json");
    expect(loadRun()).toBeNull();
  });

  it("rejects a schema mismatch instead of migrating", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: 99, state, statsRecorded: false }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a missing statsRecorded flag", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: SCHEMA, state }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a state that violates the invariants", () => {
    const state = createGame("4F2A9C");
    const tampered = { ...state, deck: state.deck.slice(3) };
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: SCHEMA, state: tampered, statsRecorded: false }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a hand-edited health value", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(
      RUN_KEY,
      JSON.stringify({ schema: SCHEMA, state: { ...state, health: 999 }, statsRecorded: false }),
    );
    expect(loadRun()).toBeNull();
  });
});

describe("stats", () => {
  it("returns empty stats when nothing is stored", () => {
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("saves and restores stats", () => {
    const stats = { schema: SCHEMA, best: 12, played: 4, won: 1 };
    saveStats(stats);
    expect(loadStats()).toEqual(stats);
  });

  it("falls back to empty on corrupt or mismatched payloads", () => {
    window.localStorage.setItem(STATS_KEY, "garbage");
    expect(loadStats()).toEqual(EMPTY_STATS);

    window.localStorage.setItem(STATS_KEY, JSON.stringify({ schema: 99, best: 5, played: 1, won: 1 }));
    expect(loadStats()).toEqual(EMPTY_STATS);

    window.localStorage.setItem(STATS_KEY, JSON.stringify({ schema: SCHEMA, best: "high", played: 1, won: 1 }));
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("accepts a null best", () => {
    saveStats({ schema: SCHEMA, best: null, played: 3, won: 0 });
    expect(loadStats()).toEqual({ schema: SCHEMA, best: null, played: 3, won: 0 });
  });
});

describe("recordResult", () => {
  it("records the first result whatever it is", () => {
    expect(recordResult(EMPTY_STATS, "lost", -40)).toEqual({ schema: SCHEMA, best: -40, played: 1, won: 0 });
  });

  it("counts wins separately from plays", () => {
    const after = recordResult(recordResult(EMPTY_STATS, "lost", -40), "won", 12);
    expect(after).toEqual({ schema: SCHEMA, best: 12, played: 2, won: 1 });
  });

  it("never lets a loss displace a better score", () => {
    const withWin = { schema: SCHEMA, best: 12, played: 1, won: 1 };
    expect(recordResult(withWin, "lost", -40).best).toBe(12);
  });

  it("takes the higher of two wins", () => {
    const withWin = { schema: SCHEMA, best: 12, played: 1, won: 1 };
    expect(recordResult(withWin, "won", 18).best).toBe(18);
    expect(recordResult(withWin, "won", 3).best).toBe(12);
  });

  it("is pure", () => {
    const stats = { schema: SCHEMA, best: 5, played: 1, won: 1 };
    recordResult(stats, "won", 20);
    expect(stats).toEqual({ schema: SCHEMA, best: 5, played: 1, won: 1 });
  });
});

describe("storage unavailable", () => {
  it("degrades instead of throwing on read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadRun()).toBeNull();
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("degrades instead of throwing on write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveRun({ schema: SCHEMA, state: createGame("000001"), statsRecorded: false })).not.toThrow();
    expect(() => saveStats(EMPTY_STATS)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/storage/persistence.test.ts`
Expected: FAIL — cannot resolve `./persistence`.

- [ ] **Step 3: Write the implementation**

`src/storage/persistence.ts`:

```ts
import { validateState, type GameState } from "../engine";

export const SCHEMA = 1;

const RUN_KEY = "scoundrel.run";
const STATS_KEY = "scoundrel.stats";

export type SavedRun = {
  schema: number;
  state: GameState;
  /** True once this run's terminal result has been counted into stats. */
  statsRecorded: boolean;
};

export type Stats = {
  schema: number;
  best: number | null;
  played: number;
  won: number;
};

export const EMPTY_STATS: Stats = { schema: SCHEMA, best: null, played: 0, won: 0 };

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or exhausted quota: degrade to in-memory play.
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function loadRun(): SavedRun | null {
  const raw = readRaw(RUN_KEY);
  if (raw === null) return null;

  const record = asRecord(parseJson(raw));
  if (record === null) return null;
  if (record["schema"] !== SCHEMA) return null;
  if (typeof record["statsRecorded"] !== "boolean") return null;

  const state = validateState(record["state"]);
  if (state === null) return null;

  return { schema: SCHEMA, state, statsRecorded: record["statsRecorded"] };
}

export function saveRun(run: SavedRun): void {
  writeRaw(RUN_KEY, JSON.stringify(run));
}

export function loadStats(): Stats {
  const raw = readRaw(STATS_KEY);
  if (raw === null) return EMPTY_STATS;

  const record = asRecord(parseJson(raw));
  if (record === null) return EMPTY_STATS;
  if (record["schema"] !== SCHEMA) return EMPTY_STATS;

  const best = record["best"];
  const played = record["played"];
  const won = record["won"];
  if (best !== null && typeof best !== "number") return EMPTY_STATS;
  if (typeof played !== "number" || typeof won !== "number") return EMPTY_STATS;

  return { schema: SCHEMA, best, played, won };
}

export function saveStats(stats: Stats): void {
  writeRaw(STATS_KEY, JSON.stringify(stats));
}

/** Pure. A loss can never displace a better score because null is the only empty state. */
export function recordResult(stats: Stats, outcome: "won" | "lost", score: number): Stats {
  return {
    schema: SCHEMA,
    best: stats.best === null ? score : Math.max(stats.best, score),
    played: stats.played + 1,
    won: stats.won + (outcome === "won" ? 1 : 0),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/storage/persistence.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/storage/persistence.ts src/storage/persistence.test.ts
git commit -m "feat(storage): schema-versioned run and stats persistence

Loaded snapshots are treated as untrusted input and run through
validateState, so a truncated or hand-edited save is discarded rather
than producing an impossible game."
```

---

### Task 12: Seed URL and start resolution

**Files:**
- Create: `src/storage/seedUrl.ts`, `src/storage/seedUrl.test.ts`, `src/storage/resolveStart.ts`, `src/storage/resolveStart.test.ts`

**Interfaces:**
- Consumes: `normalizeSeed`, `createGame` from `../engine`; `SavedRun`, `SCHEMA` (Task 11).
- Produces:
  ```ts
  // seedUrl.ts
  export function randomSeed(): string;
  export function readSeedFromUrl(search?: string): string | null;
  export function writeSeedToUrl(seed: string): void;

  // resolveStart.ts
  export type StartDecision = { kind: "resume"; run: SavedRun } | { kind: "fresh"; seed: string };
  export function resolveStart(urlSeed: string | null, saved: SavedRun | null, makeSeed: () => string): StartDecision;
  ```

`randomSeed` lives here rather than in the engine because it needs `crypto`, which engine purity forbids.

- [ ] **Step 1: Write the failing tests**

`src/storage/seedUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SEED_PATTERN } from "../engine";
import { randomSeed, readSeedFromUrl, writeSeedToUrl } from "./seedUrl";

describe("randomSeed", () => {
  it("produces a valid six-hex seed", () => {
    for (let i = 0; i < 200; i += 1) expect(randomSeed()).toMatch(SEED_PATTERN);
  });

  it("varies", () => {
    expect(new Set(Array.from({ length: 50 }, randomSeed)).size).toBeGreaterThan(1);
  });
});

describe("readSeedFromUrl", () => {
  it("reads and uppercases a valid seed", () => {
    expect(readSeedFromUrl("?seed=4f2a9c")).toBe("4F2A9C");
    expect(readSeedFromUrl("?other=1&seed=000001")).toBe("000001");
  });

  it("returns null when absent or malformed", () => {
    expect(readSeedFromUrl("")).toBeNull();
    expect(readSeedFromUrl("?other=1")).toBeNull();
    expect(readSeedFromUrl("?seed=")).toBeNull();
    expect(readSeedFromUrl("?seed=zzzzzz")).toBeNull();
    expect(readSeedFromUrl("?seed=4F2A9")).toBeNull();
    expect(readSeedFromUrl("?seed=4F2A9C0")).toBeNull();
  });
});

describe("writeSeedToUrl", () => {
  it("puts the seed in the query string without navigating", () => {
    writeSeedToUrl("4F2A9C");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("4F2A9C");
  });

  it("replaces an existing seed", () => {
    writeSeedToUrl("4F2A9C");
    writeSeedToUrl("000123");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("000123");
  });
});
```

`src/storage/resolveStart.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createGame } from "../engine";
import { SCHEMA, type SavedRun } from "./persistence";
import { resolveStart } from "./resolveStart";

const savedRun = (seed: string): SavedRun => ({
  schema: SCHEMA,
  state: createGame(seed),
  statsRecorded: false,
});

const never = () => {
  throw new Error("makeSeed should not have been called");
};

describe("resolveStart", () => {
  it("resumes when the URL seed matches the saved run (the refresh case)", () => {
    const saved = savedRun("4F2A9C");
    expect(resolveStart("4F2A9C", saved, never)).toEqual({ kind: "resume", run: saved });
  });

  it("starts fresh when the URL seed differs (the shared-link case)", () => {
    expect(resolveStart("000123", savedRun("4F2A9C"), never)).toEqual({ kind: "fresh", seed: "000123" });
  });

  it("starts fresh on a URL seed with no saved run", () => {
    expect(resolveStart("000123", null, never)).toEqual({ kind: "fresh", seed: "000123" });
  });

  it("resumes a saved run when the URL has no seed", () => {
    const saved = savedRun("4F2A9C");
    expect(resolveStart(null, saved, never)).toEqual({ kind: "resume", run: saved });
  });

  it("generates a seed when there is neither a URL seed nor a saved run", () => {
    expect(resolveStart(null, null, () => "ABCDEF")).toEqual({ kind: "fresh", seed: "ABCDEF" });
  });

  it("resumes a finished run rather than restarting it", () => {
    const saved: SavedRun = { schema: SCHEMA, state: { ...createGame("4F2A9C"), status: "won" }, statsRecorded: true };
    expect(resolveStart(null, saved, never)).toEqual({ kind: "resume", run: saved });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage/seedUrl.test.ts src/storage/resolveStart.test.ts`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Write `seedUrl.ts`**

```ts
import { normalizeSeed } from "../engine";

const SEED_SPACE = 0x1000000; // 24 bits, matching six hex characters

export function randomSeed(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const value = (buffer[0] ?? 0) % SEED_SPACE;
  return value.toString(16).toUpperCase().padStart(6, "0");
}

export function readSeedFromUrl(search: string = window.location.search): string | null {
  const raw = new URLSearchParams(search).get("seed");
  return raw === null ? null : normalizeSeed(raw);
}

/** Writes the seed into the address bar without navigating, so a dungeon is shareable. */
export function writeSeedToUrl(seed: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    window.history.replaceState(null, "", url);
  } catch {
    // Non-browser or restricted context: the seed is still visible in the HUD.
  }
}
```

- [ ] **Step 4: Write `resolveStart.ts`**

```ts
import type { SavedRun } from "./persistence";

export type StartDecision =
  | { kind: "resume"; run: SavedRun }
  | { kind: "fresh"; seed: string };

/**
 * The three load rules, in order:
 *   1. URL seed equal to the saved run's seed -> resume (plain refresh)
 *   2. URL seed different -> start that dungeon fresh (shared link)
 *   3. No URL seed -> resume if possible, otherwise generate
 */
export function resolveStart(
  urlSeed: string | null,
  saved: SavedRun | null,
  makeSeed: () => string,
): StartDecision {
  if (urlSeed !== null) {
    return saved !== null && saved.state.seed === urlSeed
      ? { kind: "resume", run: saved }
      : { kind: "fresh", seed: urlSeed };
  }
  return saved !== null ? { kind: "resume", run: saved } : { kind: "fresh", seed: makeSeed() };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/storage/ && npm test`
Expected: PASS, 14 new tests, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add src/storage/seedUrl.ts src/storage/seedUrl.test.ts src/storage/resolveStart.ts src/storage/resolveStart.test.ts
git commit -m "feat(storage): seed URL round trip and three-rule start resolution"
```

---

### Task 13: Formatting — every user-visible string

The engine emits only codes and structured data. This module is the single place any of it becomes English.

**Files:**
- Create: `src/ui/format.ts`, `src/ui/format.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit`, `GameState`, `LogEntry`, `Offer`, `roleOf`, `weaponThreshold` from `../engine`.
- Produces:
  ```ts
  export function rankLabel(rank: number): string;          // "8", "J", "Q", "K", "A"
  export function suitSymbol(suit: Suit): string;            // "♣" "♦" "♥" "♠"
  export function cardShort(card: Card): string;             // "8♠"
  export function cardName(card: Card): string;              // "Eight of Spades, monster"
  export function offerLabel(offer: Offer, state: GameState): string;
  export function offerReason(offer: Offer, state: GameState): string | null;
  export function offerNote(offer: Offer): string | null;
  export function logLine(entry: LogEntry): string;
  export function outcomeHeadline(state: GameState): string;
  ```

`offerReason` returns text only for disabled offers. `offerNote` returns text for enabled offers that need a caveat (a blocked potion, or drinking at full health). They are separate because one styles as an error and the other as a hint.

- [ ] **Step 1: Write the failing test**

`src/ui/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCard, offersFor, runOffer, type GameState } from "../engine";
import { c, stateWith, weaponOf } from "../engine/test-fixtures";
import {
  cardName, cardShort, logLine, offerLabel, offerNote, offerReason, outcomeHeadline, rankLabel,
} from "./format";

const monsterOffers = (state: GameState, rank: number) => offersFor(state, makeCard("clubs", rank));

describe("card wording", () => {
  it("labels ranks", () => {
    expect(rankLabel(2)).toBe("2");
    expect(rankLabel(10)).toBe("10");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(12)).toBe("Q");
    expect(rankLabel(13)).toBe("K");
    expect(rankLabel(14)).toBe("A");
  });

  it("renders a short card", () => {
    expect(cardShort(c("spades", 8))).toBe("8♠");
    expect(cardShort(c("diamonds", 14))).toBe("A♦");
  });

  it("renders an accessible name including the role", () => {
    expect(cardName(c("spades", 8))).toBe("Eight of Spades, monster");
    expect(cardName(c("hearts", 10))).toBe("Ten of Hearts, potion");
    expect(cardName(c("diamonds", 5))).toBe("Five of Diamonds, weapon");
    expect(cardName(c("clubs", 14))).toBe("Ace of Clubs, monster");
  });
});

describe("offerLabel", () => {
  it("names the weapon and the damage", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    expect(offerLabel(monsterOffers(state, 8)[0]!, state)).toBe("Use 9♦ — 0 dmg");
    expect(offerLabel(monsterOffers(state, 13)[0]!, state)).toBe("Use 9♦ — 4 dmg");
  });

  it("says Use weapon when unarmed", () => {
    const state = stateWith({});
    expect(offerLabel(monsterOffers(state, 8)[0]!, state)).toBe("Use weapon");
  });

  it("labels barehanded with full monster value", () => {
    const state = stateWith({});
    expect(offerLabel(monsterOffers(state, 8)[1]!, state)).toBe("Barehanded — 8 dmg");
  });

  it("labels drinking", () => {
    const healing = stateWith({ health: 10 });
    expect(offerLabel(offersFor(healing, c("hearts", 7))[0]!, healing)).toBe("Drink — +7 health");
  });

  it("labels a blocked potion as a discard", () => {
    const blocked = stateWith({ health: 10, potionUsedThisRoom: true });
    expect(offerLabel(offersFor(blocked, c("hearts", 7))[0]!, blocked)).toBe("Discard");
  });

  it("labels drinking at full health without promising healing", () => {
    const full = stateWith({ health: 20 });
    expect(offerLabel(offersFor(full, c("hearts", 7))[0]!, full)).toBe("Drink — no effect");
  });

  it("labels equipping, naming what it discards", () => {
    const armed = stateWith({ weapon: weaponOf(4) });
    expect(offerLabel(offersFor(armed, c("diamonds", 9))[0]!, armed)).toBe("Equip — discards 4♦");

    const unarmed = stateWith({});
    expect(offerLabel(offersFor(unarmed, c("diamonds", 9))[0]!, unarmed)).toBe("Equip");
  });

  it("labels running", () => {
    const state = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)] });
    expect(offerLabel(runOffer(state), state)).toBe("Run away");
  });
});

describe("offerReason", () => {
  it("is null for an enabled offer", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    expect(offerReason(monsterOffers(state, 8)[0]!, state)).toBeNull();
  });

  it("explains an unarmed weapon offer", () => {
    const state = stateWith({});
    expect(offerReason(monsterOffers(state, 8)[0]!, state)).toBe("No weapon equipped");
  });

  it("explains the threshold with the weapon and the number", () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    expect(offerReason(monsterOffers(state, 13)[0]!, state)).toBe("9♦ only kills below 10");
  });

  it("explains both run refusals", () => {
    const ran = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)], ranLastRoom: true });
    expect(offerReason(runOffer(ran), ran)).toBe("You ran from the last room");

    const started = stateWith({ room: [c("clubs", 2), c("clubs", 3)] });
    expect(offerReason(runOffer(started), started)).toBe("Only before you resolve a card");
  });
});

describe("offerNote", () => {
  it("is null when there is nothing to caveat", () => {
    const state = stateWith({ health: 10 });
    expect(offerNote(offersFor(state, c("hearts", 7))[0]!)).toBeNull();
  });

  it("flags a blocked potion", () => {
    const blocked = stateWith({ health: 10, potionUsedThisRoom: true });
    expect(offerNote(offersFor(blocked, c("hearts", 7))[0]!)).toBe("Already drank this room");
  });

  it("flags full health", () => {
    const full = stateWith({ health: 20 });
    expect(offerNote(offersFor(full, c("hearts", 7))[0]!)).toBe("Already at full health");
  });
});

describe("logLine", () => {
  it("renders every entry kind", () => {
    expect(logLine({ kind: "deal", roomNumber: 3, cards: [c("clubs", 2), c("hearts", 9)] })).toBe(
      "Room 3 — dealt 2♣ 9♥",
    );
    expect(
      logLine({ kind: "fight", monster: c("spades", 8), weapon: c("diamonds", 5), damage: 3, healthAfter: 17 }),
    ).toBe("5♦ vs 8♠ — 3 damage, 17 health");
    expect(logLine({ kind: "fight", monster: c("clubs", 9), weapon: null, damage: 9, healthAfter: 8 })).toBe(
      "Barehanded vs 9♣ — 9 damage, 8 health",
    );
    expect(logLine({ kind: "equip", weapon: c("diamonds", 9), discarded: c("diamonds", 4) })).toBe(
      "Equipped 9♦, discarding 4♦",
    );
    expect(logLine({ kind: "equip", weapon: c("diamonds", 9), discarded: null })).toBe("Equipped 9♦");
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 6, blocked: false, healthAfter: 14 })).toBe(
      "Drank 6♥ — +6 health, 14 total",
    );
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 0, blocked: true, healthAfter: 14 })).toBe(
      "Discarded 6♥ — already drank this room",
    );
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 0, blocked: false, healthAfter: 20 })).toBe(
      "Drank 6♥ — no effect at full health",
    );
    expect(logLine({ kind: "run", roomNumber: 4 })).toBe("Ran from room 4");
    expect(logLine({ kind: "gameOver", outcome: "won", score: 14 })).toBe("Escaped the dungeon — score 14");
    expect(logLine({ kind: "gameOver", outcome: "lost", score: -37 })).toBe("Died in the dungeon — score -37");
  });
});

describe("outcomeHeadline", () => {
  it("distinguishes a zero-score loss from a win", () => {
    expect(outcomeHeadline(stateWith({ status: "won", health: 1 }))).toBe("You escaped the dungeon");
    expect(outcomeHeadline(stateWith({ status: "lost", health: 0 }))).toBe("You died in the dungeon");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Write the implementation**

`src/ui/format.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/format.test.ts && npm test`
Expected: PASS, 18 new tests, whole suite green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/format.ts src/ui/format.test.ts
git commit -m "feat(ui): formatting layer holding every user-visible string"
```

---

### Task 14: Styles, error boundary, and app shell

First visible pixels. The palette and the animation durations are defined here once, and the reduced-motion override lives here so no later task has to remember it.

**Files:**
- Create: `src/ui/styles/tokens.css`, `src/ui/styles/global.css`, `src/ui/components/ErrorBoundary.tsx`, `src/ui/components/ErrorBoundary.test.tsx`, `src/ui/App.tsx`, `src/ui/App.module.css`, `src/main.tsx`

**Interfaces:**
- Consumes: nothing beyond React.
- Produces:
  ```ts
  export function ErrorBoundary(props: { children: ReactNode; fallback: (error: Error, reset: () => void) => ReactNode }): JSX.Element;
  export function App(): JSX.Element;
  ```
  CSS custom properties: every token in Global Constraints plus `--dur-deal`, `--dur-stagger`, `--dur-exit`, `--dur-health`, `--dur-float`, `--dur-shake`.

- [ ] **Step 1: Write `src/ui/styles/tokens.css`**

```css
:root {
  --table: #14100c;
  --table-edge: #2c2318;
  --panel: #100d09;
  --panel-raised: #1c160f;
  --panel-border: #33291b;

  --card-face-top: #f4e9d2;
  --card-face-bottom: #e6d6b4;
  --card-edge: #8b6f47;
  --card-shadow: #0c0906;

  --ink: #2a2018;
  --ink-red: #a62b1f;

  --gold: #e8c774;
  --gold-dim: #6b5423;
  --ember: #b8452f;
  --ember-bright: #e0846b;
  --ember-edge: #6b3524;
  --leaf: #8fbf7a;

  --text: #c8b48c;
  --text-dim: #7d6a4a;

  --serif: "Iowan Old Style", "Palatino Linotype", Georgia, serif;

  --dur-deal: 260ms;
  --dur-stagger: 60ms;
  --dur-exit: 200ms;
  --dur-health: 400ms;
  --dur-float: 700ms;
  --dur-shake: 260ms;
}

/* Accessibility requirement, and it also makes component tests deterministic. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-deal: 0s;
    --dur-stagger: 0s;
    --dur-exit: 0s;
    --dur-health: 0s;
    --dur-float: 0s;
    --dur-shake: 0s;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
  }
}
```

- [ ] **Step 2: Write `src/ui/styles/global.css`**

```css
@import "./tokens.css";

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--table);
  color: var(--text);
  font-family: var(--serif);
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
}

:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Write the failing error boundary test**

`src/ui/components/ErrorBoundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <p>all good</p>;
}

// React logs caught render errors; silence it so test output stays readable.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary fallback={() => <p>fallback</p>}>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("renders the fallback with the error when a child throws", () => {
    render(
      <ErrorBoundary fallback={(error) => <p>caught: {error.message}</p>}>
        <Boom explode={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("caught: kaboom")).toBeInTheDocument();
  });

  it("clears the error when reset is called", async () => {
    render(
      <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <Boom explode={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();

    render(
      <ErrorBoundary fallback={(_error, reset) => <button onClick={reset}>retry</button>}>
        <Boom explode={true} />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(screen.getAllByRole("button", { name: "retry" }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/ui/components/ErrorBoundary.test.tsx`
Expected: FAIL — cannot resolve `./ErrorBoundary`.

- [ ] **Step 5: Write `ErrorBoundary.tsx`**

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Scoundrel crashed", error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    return error === null ? this.props.children : this.props.fallback(error, this.reset);
  }
}
```

- [ ] **Step 6: Write the app shell**

`src/ui/App.module.css`:

```css
.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  max-width: 860px;
  margin: 0 auto;
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crash {
  border: 1px solid var(--ember-edge);
  background: var(--panel);
  border-radius: 6px;
  padding: 16px;
  color: var(--text);
}

.crash h2 {
  color: var(--ember-bright);
  margin: 0 0 8px;
}

.crash pre {
  font-size: 11px;
  color: var(--text-dim);
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
}
```

`src/ui/App.tsx` — a placeholder body that later tasks replace piece by piece:

```tsx
import styles from "./App.module.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className={styles.crash} role="alert">
            <h2>The dungeon collapsed</h2>
            <p>{error.message}</p>
            <button onClick={reset}>Try again</button>
          </div>
        )}
      >
        <div className={styles.stage}>
          <h1>Scoundrel</h1>
        </div>
      </ErrorBoundary>
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/styles/global.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Verify**

Run: `npx vitest run src/ui/components/ErrorBoundary.test.tsx && npm test && npm run typecheck`
Expected: PASS, 3 new tests, whole suite green, typecheck clean.

Run `npm run dev` and confirm a dark page with "Scoundrel" renders. This is the first time `npm run dev` works.

- [ ] **Step 8: Commit**

```bash
git add src/ui/styles src/ui/components/ErrorBoundary.tsx src/ui/components/ErrorBoundary.test.tsx src/ui/App.tsx src/ui/App.module.css src/main.tsx
git commit -m "feat(ui): dark dungeon tokens, reduced-motion override, error boundary, app shell"
```

---

### Task 15: The `useGame` hook

Wires the reducer to persistence, the seed URL, and stats. This is the only place those three meet.

**Files:**
- Create: `src/ui/hooks/useGame.ts`, `src/ui/hooks/useGame.test.tsx`

**Interfaces:**
- Consumes: `applyAction`, `createGame`, `finalScore`, `offersFor`, `runOffer` from `../../engine`; all of `../../storage/persistence`, `../../storage/seedUrl`, `../../storage/resolveStart`.
- Produces:
  ```ts
  export type UseGame = {
    state: GameState;
    stats: Stats;
    offersFor: (card: Card) => readonly Offer[];
    runOffer: Offer;
    dispatch: (action: Action) => void;
    newGame: (seed?: string) => void;
  };
  export function useGame(): UseGame;
  ```

- [ ] **Step 1: Write the failing test**

`src/ui/hooks/useGame.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createGame } from "../../engine";
import { SCHEMA, loadRun, loadStats, saveRun, saveStats } from "../../storage/persistence";
import { useGame } from "./useGame";

function Harness() {
  const game = useGame();
  const monster = game.state.room.find((c) => c.suit === "clubs" || c.suit === "spades");
  return (
    <div>
      <p data-testid="seed">{game.state.seed}</p>
      <p data-testid="health">{game.state.health}</p>
      <p data-testid="deck">{game.state.deck.length}</p>
      <p data-testid="status">{game.state.status}</p>
      <p data-testid="best">{String(game.stats.best)}</p>
      <p data-testid="played">{game.stats.played}</p>
      <p data-testid="run-enabled">{String(game.runOffer.enabled)}</p>
      {monster !== undefined && (
        <button
          onClick={() => game.dispatch({ type: "FIGHT", cardId: monster.id, useWeapon: false })}
        >
          fight
        </button>
      )}
      <button onClick={() => game.newGame("ABCDEF")}>new</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("useGame start resolution", () => {
  it("generates a seed and writes it to the URL when there is nothing to resume", () => {
    render(<Harness />);
    const seed = screen.getByTestId("seed").textContent ?? "";
    expect(seed).toMatch(/^[0-9A-F]{6}$/);
    expect(new URLSearchParams(window.location.search).get("seed")).toBe(seed);
  });

  it("resumes a saved run", () => {
    const state = { ...createGame("4F2A9C"), health: 11 };
    saveRun({ schema: SCHEMA, state, statsRecorded: false });
    render(<Harness />);
    expect(screen.getByTestId("seed")).toHaveTextContent("4F2A9C");
    expect(screen.getByTestId("health")).toHaveTextContent("11");
  });

  it("starts fresh when the URL seed differs from the saved run", () => {
    saveRun({ schema: SCHEMA, state: { ...createGame("4F2A9C"), health: 11 }, statsRecorded: false });
    window.history.replaceState(null, "", "/?seed=000123");
    render(<Harness />);
    expect(screen.getByTestId("seed")).toHaveTextContent("000123");
    expect(screen.getByTestId("health")).toHaveTextContent("20");
  });
});

describe("useGame dispatch and persistence", () => {
  it("applies an action and persists the result", async () => {
    render(<Harness />);
    const before = Number(screen.getByTestId("health").textContent);
    await userEvent.click(screen.getByRole("button", { name: "fight" }));
    const after = Number(screen.getByTestId("health").textContent);
    expect(after).toBeLessThanOrEqual(before);
    expect(loadRun()?.state.health).toBe(after);
  });

  it("disables running once a card is resolved", async () => {
    render(<Harness />);
    expect(screen.getByTestId("run-enabled")).toHaveTextContent("true");
    await userEvent.click(screen.getByRole("button", { name: "fight" }));
    expect(screen.getByTestId("run-enabled")).toHaveTextContent("false");
  });

  it("starts a new game on the given seed and rewrites the URL", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "new" }));
    expect(screen.getByTestId("seed")).toHaveTextContent("ABCDEF");
    expect(screen.getByTestId("deck")).toHaveTextContent("40");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("ABCDEF");
  });
});

describe("useGame stats", () => {
  it("records a finished run exactly once", () => {
    const won = { ...createGame("4F2A9C"), status: "won" as const, health: 9, deck: [], room: [], discard: [] };
    // A won state needs all 44 cards accounted for, so park them in discard.
    const full = { ...won, discard: createGame("4F2A9C").deck.concat(createGame("4F2A9C").room) };
    saveRun({ schema: SCHEMA, state: full, statsRecorded: false });

    const first = render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
    expect(screen.getByTestId("best")).toHaveTextContent("9");
    expect(loadRun()?.statsRecorded).toBe(true);
    first.unmount();

    render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
  });

  it("does not re-record on remount of an already-recorded run", () => {
    const base = createGame("4F2A9C");
    const full = {
      ...base, status: "won" as const, health: 9, deck: [], room: [],
      discard: base.deck.concat(base.room),
    };
    saveStats({ schema: SCHEMA, best: 9, played: 1, won: 1 });
    saveRun({ schema: SCHEMA, state: full, statsRecorded: true });

    render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
    expect(loadStats().played).toBe(1);
  });

  it("clears statsRecorded for a new game", async () => {
    render(<Harness />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "new" }));
    });
    expect(loadRun()?.statsRecorded).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/hooks/useGame.test.tsx`
Expected: FAIL — cannot resolve `./useGame`.

- [ ] **Step 3: Write `useGame.ts`**

```ts
import { useCallback, useEffect, useReducer, useState } from "react";
import {
  applyAction, createGame, finalScore,
  offersFor as engineOffersFor, runOffer as engineRunOffer,
  type Action, type Card, type GameState, type Offer,
} from "../../engine";
import {
  SCHEMA, loadRun, loadStats, recordResult, saveRun, saveStats, type Stats,
} from "../../storage/persistence";
import { resolveStart } from "../../storage/resolveStart";
import { randomSeed, readSeedFromUrl, writeSeedToUrl } from "../../storage/seedUrl";

export type UseGame = {
  state: GameState;
  stats: Stats;
  offersFor: (card: Card) => readonly Offer[];
  runOffer: Offer;
  dispatch: (action: Action) => void;
  newGame: (seed?: string) => void;
};

type Session = { state: GameState; statsRecorded: boolean };

type SessionAction = { kind: "game"; action: Action } | { kind: "statsRecorded" };

function initialSession(): Session {
  const decision = resolveStart(readSeedFromUrl(), loadRun(), randomSeed);
  return decision.kind === "resume"
    ? { state: decision.run.state, statsRecorded: decision.run.statsRecorded }
    : { state: createGame(decision.seed), statsRecorded: false };
}

function sessionReducer(session: Session, sessionAction: SessionAction): Session {
  if (sessionAction.kind === "statsRecorded") return { ...session, statsRecorded: true };

  const state = applyAction(session.state, sessionAction.action);
  return {
    state,
    statsRecorded: sessionAction.action.type === "NEW_GAME" ? false : session.statsRecorded,
  };
}

export function useGame(): UseGame {
  const [session, dispatchSession] = useReducer(sessionReducer, undefined, initialSession);
  const [stats, setStats] = useState<Stats>(loadStats);

  const { state, statsRecorded } = session;

  // Keep the address bar showing the current dungeon so it is shareable.
  useEffect(() => {
    writeSeedToUrl(state.seed);
  }, [state.seed]);

  // Persist on every change. The snapshot is small; no debounce is warranted.
  useEffect(() => {
    saveRun({ schema: SCHEMA, state, statsRecorded });
  }, [state, statsRecorded]);

  // Record a terminal result exactly once, across reloads.
  useEffect(() => {
    if (state.status === "playing" || statsRecorded) return;
    const updated = recordResult(stats, state.status, finalScore(state));
    setStats(updated);
    saveStats(updated);
    dispatchSession({ kind: "statsRecorded" });
  }, [state, statsRecorded, stats]);

  const dispatch = useCallback((action: Action) => {
    dispatchSession({ kind: "game", action });
  }, []);

  const newGame = useCallback((seed?: string) => {
    dispatchSession({ kind: "game", action: { type: "NEW_GAME", seed: seed ?? randomSeed() } });
  }, []);

  const offersFor = useCallback((card: Card) => engineOffersFor(state, card), [state]);

  return { state, stats, offersFor, runOffer: engineRunOffer(state), dispatch, newGame };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/hooks/useGame.test.tsx && npm test`
Expected: PASS, 9 new tests, whole suite green.

If the stats effect warns about an update depth, confirm the early return on `statsRecorded` is present — it is what terminates the cycle.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useGame.ts src/ui/hooks/useGame.test.tsx
git commit -m "feat(ui): useGame wiring reducer, persistence, seed URL, and once-only stats"
```

---

### Task 16: CardView

The rule-dense component. It holds no rule logic — it renders whatever `legality.ts` reports.

**Files:**
- Create: `src/ui/components/CardView.tsx`, `src/ui/components/CardView.module.css`, `src/ui/components/CardView.test.tsx`

**Interfaces:**
- Consumes: `Action`, `Card`, `GameState`, `Offer`, `roleOf` from `../../engine`; `cardName`, `cardShort`, `offerLabel`, `offerNote`, `offerReason`, `rankLabel`, `suitSymbol` from `../format`.
- Produces:
  ```ts
  export type CardViewProps = {
    card: Card;
    offers: readonly Offer[];
    state: GameState;
    onAction: (action: Action) => void;
    exiting?: boolean;
    dealIndex?: number;
  };
  export function CardView(props: CardViewProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

`src/ui/components/CardView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { offersFor } from "../../engine";
import { c, stateWith, weaponOf } from "../../engine/test-fixtures";
import { CardView } from "./CardView";

const show = (state: Parameters<typeof offersFor>[0], card: Parameters<typeof offersFor>[1]) => {
  const onAction = vi.fn();
  render(<CardView card={card} offers={offersFor(state, card)} state={state} onAction={onAction} />);
  return onAction;
};

describe("CardView faces", () => {
  it("shows the rank and suit", () => {
    show(stateWith({}), c("spades", 8));
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("\u2660")).toBeInTheDocument();
  });

  it("labels face ranks", () => {
    show(stateWith({}), c("clubs", 13));
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("carries an accessible name including the role", () => {
    show(stateWith({}), c("hearts", 10));
    expect(screen.getByRole("group", { name: "Ten of Hearts, potion" })).toBeInTheDocument();
  });
});

describe("CardView offers", () => {
  it("renders both monster offers as buttons", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    show(state, c("clubs", 8));
    expect(screen.getByRole("button", { name: /Use 9♦ — 0 dmg/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Barehanded — 8 dmg/ })).toBeEnabled();
  });

  it("disables the weapon offer and shows the reason", () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    show(state, c("clubs", 13));
    expect(screen.getByRole("button", { name: /Use 9♦/ })).toBeDisabled();
    expect(screen.getByText("9♦ only kills below 10")).toBeInTheDocument();
  });

  it("shows the unarmed reason", () => {
    show(stateWith({}), c("clubs", 8));
    expect(screen.getByRole("button", { name: /Use weapon/ })).toBeDisabled();
    expect(screen.getByText("No weapon equipped")).toBeInTheDocument();
  });

  it("renders a single potion offer with the heal amount", () => {
    show(stateWith({ health: 10 }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Drink — \+7 health/ })).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("tags every offer button with a stable test id for end-to-end selection", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    show(state, c("clubs", 8));
    expect(screen.getAllByTestId("offer")).toHaveLength(2);
  });

  it("keeps a blocked potion clickable and explains it", () => {
    show(stateWith({ health: 10, potionUsedThisRoom: true }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Discard/ })).toBeEnabled();
    expect(screen.getByText("Already drank this room")).toBeInTheDocument();
  });

  it("notes drinking at full health", () => {
    show(stateWith({ health: 20 }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Drink — no effect/ })).toBeEnabled();
    expect(screen.getByText("Already at full health")).toBeInTheDocument();
  });

  it("names what equipping discards", () => {
    show(stateWith({ weapon: weaponOf(4) }), c("diamonds", 9));
    expect(screen.getByRole("button", { name: /Equip — discards 4♦/ })).toBeEnabled();
  });
});

describe("CardView dispatch", () => {
  it("sends the exact action for the clicked offer", async () => {
    const state = stateWith({ weapon: weaponOf(9) });
    const onAction = show(state, c("clubs", 8));

    await userEvent.click(screen.getByRole("button", { name: /Use 9♦/ }));
    expect(onAction).toHaveBeenCalledWith({ type: "FIGHT", cardId: "C8", useWeapon: true });

    await userEvent.click(screen.getByRole("button", { name: /Barehanded/ }));
    expect(onAction).toHaveBeenCalledWith({ type: "FIGHT", cardId: "C8", useWeapon: false });
  });

  it("never dispatches from a disabled offer", async () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    const onAction = show(state, c("clubs", 13));
    await userEvent.click(screen.getByRole("button", { name: /Use 9♦/ }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("is keyboard operable", async () => {
    const onAction = show(stateWith({ health: 10 }), c("hearts", 7));
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith({ type: "DRINK", cardId: "H7" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/components/CardView.test.tsx`
Expected: FAIL — cannot resolve `./CardView`.

- [ ] **Step 3: Write `CardView.module.css`**

```css
.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 124px;
}

.card {
  width: 78px;
  height: 110px;
  border-radius: 7px;
  border: 1px solid var(--card-edge);
  background: linear-gradient(var(--card-face-top), var(--card-face-bottom));
  box-shadow: 0 3px 0 var(--card-shadow), inset 0 0 0 1px rgb(255 255 255 / 45%);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: deal var(--dur-deal) ease-out both;
  animation-delay: calc(var(--deal-index, 0) * var(--dur-stagger));
}

.red {
  color: var(--ink-red);
}

.rank {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.suit {
  font-size: 22px;
  line-height: 1.35;
}

.role {
  font-size: 8.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  opacity: 0.62;
  margin-top: 4px;
}

.offerGroup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.offer {
  width: 100%;
  padding: 5px 4px;
  border-radius: 3px;
  border: 1px solid var(--gold-dim);
  background: #241c11;
  color: var(--gold);
  font-size: 10.5px;
  line-height: 1.35;
}

.bare {
  border-color: var(--ember-edge);
  background: #241310;
  color: var(--ember-bright);
}

.offer:disabled {
  border-color: #2e2519;
  background: #171208;
  color: #5c5041;
  text-decoration: line-through;
}

.reason,
.note {
  font-size: 8.5px;
  line-height: 1.3;
  text-align: center;
  font-style: italic;
}

.reason {
  color: var(--ember-bright);
}

.note {
  color: var(--text-dim);
}

.exiting {
  animation: exit var(--dur-exit) ease-in both;
  pointer-events: none;
}

@keyframes deal {
  from {
    opacity: 0;
    transform: translateY(-38px) rotate(-4deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes exit {
  to {
    opacity: 0;
    transform: translateY(26px) scale(0.94);
  }
}
```

- [ ] **Step 4: Write `CardView.tsx`**

```tsx
import { roleOf, type Action, type Card, type GameState, type Offer } from "../../engine";
import { cardName, offerLabel, offerNote, offerReason, rankLabel, suitSymbol } from "../format";
import styles from "./CardView.module.css";

export type CardViewProps = {
  card: Card;
  offers: readonly Offer[];
  state: GameState;
  onAction: (action: Action) => void;
  exiting?: boolean;
  dealIndex?: number;
};

export function CardView({ card, offers, state, onAction, exiting = false, dealIndex = 0 }: CardViewProps) {
  const role = roleOf(card);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      role="group"
      aria-label={cardName(card)}
      className={`${styles.slot}${exiting ? ` ${styles.exiting}` : ""}`}
    >
      <div
        className={`${styles.card}${isRed ? ` ${styles.red}` : ""}`}
        style={{ ["--deal-index" as string]: String(dealIndex) }}
      >
        <span className={styles.rank}>{rankLabel(card.rank)}</span>
        <span className={styles.suit}>{suitSymbol(card.suit)}</span>
        <span className={styles.role}>{role}</span>
      </div>

      {offers.map((offer) => {
        const barehanded = offer.action.type === "FIGHT" && !offer.action.useWeapon;
        const reason = offerReason(offer, state);
        const note = offerNote(offer);
        return (
          <div key={offerKey(offer)} className={styles.offerGroup}>
            <button
              type="button"
              data-testid="offer"
              className={`${styles.offer}${barehanded ? ` ${styles.bare}` : ""}`}
              disabled={!offer.enabled}
              onClick={() => onAction(offer.action)}
            >
              {offerLabel(offer, state)}
            </button>
            {reason !== null && <span className={styles.reason}>{reason}</span>}
            {note !== null && <span className={styles.note}>{note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function offerKey(offer: Offer): string {
  return offer.action.type === "FIGHT"
    ? `FIGHT-${offer.action.useWeapon ? "weapon" : "bare"}`
    : offer.action.type;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/components/CardView.test.tsx && npm test`
Expected: PASS, 13 new tests, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/CardView.tsx src/ui/components/CardView.module.css src/ui/components/CardView.test.tsx
git commit -m "feat(ui): CardView rendering every legal action with damage and reasons"
```

---

### Task 17: Room and WeaponStack

**Files:**
- Create: `src/ui/components/Room.tsx`, `src/ui/components/Room.module.css`, `src/ui/components/Room.test.tsx`, `src/ui/components/WeaponStack.tsx`, `src/ui/components/WeaponStack.module.css`, `src/ui/components/WeaponStack.test.tsx`

**Interfaces:**
- Consumes: `CardView` (Task 16); `Action`, `Card`, `GameState`, `Offer`, `Weapon`, `weaponThreshold` from `../../engine`; `cardShort` from `../format`.
- Produces:
  ```ts
  export type RoomProps = {
    state: GameState;
    offersFor: (card: Card) => readonly Offer[];
    onAction: (action: Action) => void;
  };
  export function Room(props: RoomProps): JSX.Element;

  export function WeaponStack(props: { weapon: Weapon | null }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

`src/ui/components/Room.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { offersFor } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { Room } from "./Room";

const renderRoom = (state: Parameters<typeof offersFor>[0]) =>
  render(<Room state={state} offersFor={(card) => offersFor(state, card)} onAction={vi.fn()} />);

describe("Room", () => {
  it("renders every face-up card as a group", () => {
    renderRoom(stateWith({ room: [c("clubs", 8), c("hearts", 7), c("diamonds", 5), c("spades", 13)] }));
    expect(screen.getByRole("group", { name: "Eight of Clubs, monster" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Seven of Hearts, potion" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Five of Diamonds, weapon" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "King of Spades, monster" })).toBeInTheDocument();
  });

  it("renders a short final room without padding it out", () => {
    renderRoom(stateWith({ room: [c("clubs", 8), c("hearts", 7)] }));
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("is labelled with the room number", () => {
    renderRoom(stateWith({ room: [c("clubs", 8)], roomNumber: 7 }));
    expect(screen.getByRole("region", { name: "Room 7" })).toBeInTheDocument();
  });

  it("renders nothing when the room is empty", () => {
    renderRoom(stateWith({ room: [] }));
    expect(screen.queryAllByRole("group")).toHaveLength(0);
  });
});
```

`src/ui/components/WeaponStack.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { weaponOf } from "../../engine/test-fixtures";
import { WeaponStack } from "./WeaponStack";

describe("WeaponStack", () => {
  it("says nothing is equipped when unarmed", () => {
    render(<WeaponStack weapon={null} />);
    expect(screen.getByText("No weapon")).toBeInTheDocument();
  });

  it("shows a fresh weapon as killing anything", () => {
    render(<WeaponStack weapon={weaponOf(9)} />);
    expect(screen.getByRole("region", { name: /weapon/i })).toBeInTheDocument();
    expect(screen.getByText("9♦")).toBeInTheDocument();
    expect(screen.getByText("kills anything")).toBeInTheDocument();
  });

  it("states the threshold explicitly", () => {
    render(<WeaponStack weapon={weaponOf(9, [12, 10])} />);
    expect(screen.getByText("kills below 10")).toBeInTheDocument();
  });

  it("lists the kills newest first", () => {
    render(<WeaponStack weapon={weaponOf(9, [12, 10, 4])} />);
    const kills = screen.getAllByTestId("kill");
    expect(kills.map((node) => node.textContent)).toEqual(["4♠", "10♠", "12♠"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/components/Room.test.tsx src/ui/components/WeaponStack.test.tsx`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Write `Room.module.css` and `Room.tsx`**

`Room.module.css`:

```css
.room {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
  background: var(--panel);
  border: 1px solid var(--table-edge);
  border-radius: 5px;
  padding: 18px 12px;
  min-height: 190px;
  flex-wrap: wrap;
}
```

`Room.tsx`:

```tsx
import type { Action, Card, GameState, Offer } from "../../engine";
import { CardView } from "./CardView";
import styles from "./Room.module.css";

export type RoomProps = {
  state: GameState;
  offersFor: (card: Card) => readonly Offer[];
  onAction: (action: Action) => void;
};

export function Room({ state, offersFor, onAction }: RoomProps) {
  return (
    <section className={styles.room} aria-label={`Room ${state.roomNumber}`}>
      {state.room.map((card, index) => (
        <CardView
          key={card.id}
          card={card}
          offers={offersFor(card)}
          state={state}
          onAction={onAction}
          dealIndex={index}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Write `WeaponStack.module.css` and `WeaponStack.tsx`**

`WeaponStack.module.css`:

```css
.stack {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--table-edge);
  border-radius: 5px;
  padding: 11px 14px;
  min-height: 62px;
}

.label {
  font-size: 8.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.fan {
  display: flex;
}

.mini {
  width: 44px;
  height: 62px;
  border-radius: 4px;
  border: 1px solid var(--card-edge);
  background: linear-gradient(var(--card-face-top), var(--card-face-bottom));
  box-shadow: 0 2px 0 var(--card-shadow);
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: grow var(--dur-deal) ease-out both;
}

.red {
  color: var(--ink-red);
}

.fan .mini + .mini {
  margin-left: -22px;
}

.threshold {
  font-size: 11px;
  color: var(--text);
}

.threshold b {
  color: var(--gold);
}

.empty {
  font-size: 11px;
  color: var(--text-dim);
  font-style: italic;
}

@keyframes grow {
  from {
    opacity: 0;
    transform: translateY(-14px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

`WeaponStack.tsx`:

```tsx
import { weaponThreshold, type Weapon } from "../../engine";
import { cardShort } from "../format";
import styles from "./WeaponStack.module.css";

export function WeaponStack({ weapon }: { weapon: Weapon | null }) {
  if (weapon === null) {
    return (
      <section className={styles.stack} aria-label="Equipped weapon">
        <span className={styles.label}>Weapon</span>
        <span className={styles.empty}>No weapon</span>
      </section>
    );
  }

  const threshold = weaponThreshold(weapon);
  const newestFirst = [...weapon.kills].reverse();

  return (
    <section className={styles.stack} aria-label="Equipped weapon">
      <span className={styles.label}>Weapon</span>
      <span className={`${styles.mini} ${styles.red}`}>{cardShort(weapon.card)}</span>
      {newestFirst.length > 0 && (
        <span className={styles.fan}>
          {newestFirst.map((kill) => (
            <span key={kill.id} className={styles.mini} data-testid="kill">
              {cardShort(kill)}
            </span>
          ))}
        </span>
      )}
      <span className={styles.threshold}>
        {threshold === null ? "kills anything" : <>kills below <b>{threshold}</b></>}
      </span>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/ui/components/Room.test.tsx src/ui/components/WeaponStack.test.tsx && npm test`
Expected: PASS, 8 new tests, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/Room.tsx src/ui/components/Room.module.css src/ui/components/Room.test.tsx src/ui/components/WeaponStack.tsx src/ui/components/WeaponStack.module.css src/ui/components/WeaponStack.test.tsx
git commit -m "feat(ui): room layout and weapon stack with explicit kill threshold"
```

---

### Task 18: Hud

**Files:**
- Create: `src/ui/components/Hud.tsx`, `src/ui/components/Hud.module.css`, `src/ui/components/Hud.test.tsx`

**Interfaces:**
- Consumes: `Action`, `GameState`, `MAX_HEALTH`, `Offer` from `../../engine`; `Stats` from `../../storage/persistence`; `offerLabel`, `offerReason` from `../format`.
- Produces:
  ```ts
  export type HudProps = {
    state: GameState;
    stats: Stats;
    runOffer: Offer;
    onAction: (action: Action) => void;
  };
  export function Hud(props: HudProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

`src/ui/components/Hud.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { runOffer } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { EMPTY_STATS, SCHEMA, type Stats } from "../../storage/persistence";
import { Hud } from "./Hud";

const fullRoom = [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)];

const renderHud = (
  patch: Parameters<typeof stateWith>[0],
  stats: Stats = EMPTY_STATS,
) => {
  const state = stateWith({ room: fullRoom, ...patch });
  const onAction = vi.fn();
  render(<Hud state={state} stats={stats} runOffer={runOffer(state)} onAction={onAction} />);
  return onAction;
};

describe("Hud readouts", () => {
  it("shows health against the maximum", () => {
    renderHud({ health: 13 });
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByLabelText("Health 13 of 20")).toBeInTheDocument();
  });

  it("shows deck count, room number, and seed", () => {
    renderHud({ deck: [c("spades", 6), c("spades", 7)], roomNumber: 5, seed: "4F2A9C" });
    expect(screen.getByText(/Deck/)).toHaveTextContent("2");
    expect(screen.getByText(/Room/)).toHaveTextContent("5");
    expect(screen.getByText(/Seed/)).toHaveTextContent("4F2A9C");
  });

  it("shows an em dash when there is no best score", () => {
    renderHud({}, EMPTY_STATS);
    expect(screen.getByText(/Best/)).toHaveTextContent("—");
  });

  it("shows a best score once one exists, including a negative one", () => {
    renderHud({}, { schema: SCHEMA, best: 14, played: 3, won: 1 });
    expect(screen.getByText(/Best/)).toHaveTextContent("14");

    render(<Hud state={stateWith({ room: fullRoom })} stats={{ schema: SCHEMA, best: -37, played: 1, won: 0 }} runOffer={runOffer(stateWith({ room: fullRoom }))} onAction={vi.fn()} />);
    expect(screen.getAllByText(/Best/).at(-1)).toHaveTextContent("-37");
  });
});

describe("Hud run button", () => {
  it("is enabled on an untouched room and dispatches RUN", async () => {
    const onAction = renderHud({});
    const button = screen.getByRole("button", { name: /Run away/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onAction).toHaveBeenCalledWith({ type: "RUN" });
  });

  it("is disabled mid-room with the reason", () => {
    renderHud({ room: fullRoom.slice(1) });
    expect(screen.getByRole("button", { name: /Run away/ })).toBeDisabled();
    expect(screen.getByText("Only before you resolve a card")).toBeInTheDocument();
  });

  it("is disabled after running last room with the reason", () => {
    renderHud({ ranLastRoom: true });
    expect(screen.getByRole("button", { name: /Run away/ })).toBeDisabled();
    expect(screen.getByText("You ran from the last room")).toBeInTheDocument();
  });

  it("never dispatches when disabled", async () => {
    const onAction = renderHud({ ranLastRoom: true });
    await userEvent.click(screen.getByRole("button", { name: /Run away/ }));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("Hud damage feedback", () => {
  it("shows the damage from the most recent fight", () => {
    renderHud({
      health: 12,
      log: [{ kind: "fight", monster: c("clubs", 8), weapon: null, damage: 8, healthAfter: 12 }],
    });
    expect(screen.getByText("-8")).toBeInTheDocument();
  });

  it("shows nothing after a fight that dealt no damage", () => {
    renderHud({
      log: [{ kind: "fight", monster: c("clubs", 8), weapon: c("diamonds", 9), damage: 0, healthAfter: 20 }],
    });
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("shows nothing when the last entry is not a fight", () => {
    renderHud({ log: [{ kind: "run", roomNumber: 1 }] });
    expect(screen.queryByText(/^-\d+$/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/components/Hud.test.tsx`
Expected: FAIL — cannot resolve `./Hud`.

- [ ] **Step 3: Write `Hud.module.css`**

```css
.hud {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  background: var(--panel-raised);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 9px 13px;
  font-size: 11.5px;
}

.health {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.value {
  color: var(--gold);
  font-size: 17px;
  font-weight: 700;
}

.bar {
  width: 104px;
  height: 8px;
  border-radius: 99px;
  background: var(--table-edge);
  border: 1px solid #4a3a24;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--ember), var(--gold));
  transition: width var(--dur-health) ease-out;
}

.float {
  position: absolute;
  left: 22px;
  top: -2px;
  color: var(--ember-bright);
  font-weight: 700;
  pointer-events: none;
  animation: rise var(--dur-float) ease-out both;
}

.stat b {
  color: var(--gold);
}

.runWrap {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.run {
  font-size: 10.5px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border: 1px solid var(--gold-dim);
  background: #241c11;
  color: var(--gold);
  padding: 5px 11px;
  border-radius: 3px;
}

.run:disabled {
  border-color: #2e2519;
  background: #171208;
  color: #5c5041;
}

.reason {
  font-size: 8.5px;
  font-style: italic;
  color: var(--text-dim);
}

@keyframes rise {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-22px);
  }
}
```

- [ ] **Step 4: Write `Hud.tsx`**

```tsx
import { MAX_HEALTH, type Action, type GameState, type Offer } from "../../engine";
import type { Stats } from "../../storage/persistence";
import { offerLabel, offerReason } from "../format";
import styles from "./Hud.module.css";

export type HudProps = {
  state: GameState;
  stats: Stats;
  runOffer: Offer;
  onAction: (action: Action) => void;
};

export function Hud({ state, stats, runOffer, onAction }: HudProps) {
  const percent = (state.health / MAX_HEALTH) * 100;
  const reason = offerReason(runOffer, state);
  const damage = latestDamage(state);

  return (
    <header className={styles.hud}>
      <span className={styles.health} aria-label={`Health ${state.health} of ${MAX_HEALTH}`}>
        <span className={styles.value}>{state.health}</span>
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </span>
        {/*
          Keyed on log length so an identical repeat still restarts the animation.
          Derived from committed state, so nothing here can gate a dispatch.
        */}
        {damage !== null && (
          <span key={state.log.length} className={styles.float} aria-hidden="true">
            -{damage}
          </span>
        )}
      </span>

      <span className={styles.stat}>Deck <b>{state.deck.length}</b></span>
      <span className={styles.stat}>Room <b>{state.roomNumber}</b></span>
      <span className={styles.stat}>Best <b>{stats.best ?? "\u2014"}</b></span>
      <span className={styles.stat}>Seed <b>{state.seed}</b></span>

      <span className={styles.runWrap}>
        <button
          type="button"
          className={styles.run}
          disabled={!runOffer.enabled}
          onClick={() => onAction(runOffer.action)}
        >
          {offerLabel(runOffer, state)}
        </button>
        {reason !== null && <span className={styles.reason}>{reason}</span>}
      </span>
    </header>
  );
}

/** Damage from the most recent action, or null if it was not a damaging fight. */
function latestDamage(state: GameState): number | null {
  const entry = state.log.at(-1);
  if (entry === undefined || entry.kind !== "fight" || entry.damage === 0) return null;
  return entry.damage;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/components/Hud.test.tsx && npm test`
Expected: PASS, 10 new tests, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/Hud.tsx src/ui/components/Hud.module.css src/ui/components/Hud.test.tsx
git commit -m "feat(ui): HUD with health bar, run button reasons, and damage feedback"
```

---

### Task 19: LogDrawer

**Files:**
- Create: `src/ui/components/LogDrawer.tsx`, `src/ui/components/LogDrawer.module.css`, `src/ui/components/LogDrawer.test.tsx`

**Interfaces:**
- Consumes: `LogEntry` from `../../engine`; `logLine` from `../format`.
- Produces:
  ```ts
  export function LogDrawer(props: { log: readonly LogEntry[] }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

`src/ui/components/LogDrawer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../engine";
import { c } from "../../engine/test-fixtures";
import { LogDrawer } from "./LogDrawer";

const log: LogEntry[] = [
  { kind: "deal", roomNumber: 1, cards: [c("clubs", 2)] },
  { kind: "equip", weapon: c("diamonds", 9), discarded: null },
  { kind: "fight", monster: c("clubs", 8), weapon: c("diamonds", 9), damage: 0, healthAfter: 20 },
  { kind: "potion", card: c("hearts", 6), healed: 6, blocked: false, healthAfter: 20 },
];

describe("LogDrawer collapsed", () => {
  it("shows only the newest entry", () => {
    render(<LogDrawer log={log} />);
    expect(screen.getByText("Drank 6♥ — +6 health, 20 total")).toBeInTheDocument();
    expect(screen.queryByText("Equipped 9♦")).not.toBeInTheDocument();
  });

  it("announces the newest entry politely", () => {
    render(<LogDrawer log={log} />);
    const live = screen.getByTestId("log-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Drank 6♥ — +6 health, 20 total");
  });

  it("handles an empty log", () => {
    render(<LogDrawer log={[]} />);
    expect(screen.getByRole("button", { name: /run log/i })).toBeInTheDocument();
  });
});

describe("LogDrawer expanded", () => {
  it("shows every entry newest first once expanded", async () => {
    render(<LogDrawer log={log} />);
    await userEvent.click(screen.getByRole("button", { name: /run log/i }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Drank 6♥");
    expect(items[3]).toHaveTextContent("Room 1 — dealt 2♣");
  });

  it("collapses again on a second click", async () => {
    render(<LogDrawer log={log} />);
    const toggle = screen.getByRole("button", { name: /run log/i });
    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await userEvent.click(toggle);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("reports expansion state to assistive tech", async () => {
    render(<LogDrawer log={log} />);
    const toggle = screen.getByRole("button", { name: /run log/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/components/LogDrawer.test.tsx`
Expected: FAIL — cannot resolve `./LogDrawer`.

- [ ] **Step 3: Write `LogDrawer.module.css`**

```css
.drawer {
  background: var(--panel-raised);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  overflow: hidden;
}

.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 10.5px;
  padding: 8px 12px;
  text-align: left;
}

.newest {
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle {
  color: var(--text-dim);
  font-size: 8.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

.list {
  margin: 0;
  padding: 0 12px 10px;
  list-style: none;
  max-height: 210px;
  overflow-y: auto;
  font-size: 10.5px;
  line-height: 1.75;
  color: var(--text-dim);
}

.list li:first-child {
  color: var(--text);
}
```

- [ ] **Step 4: Write `LogDrawer.tsx`**

```tsx
import { useState } from "react";
import type { LogEntry } from "../../engine";
import { logLine } from "../format";
import styles from "./LogDrawer.module.css";

export function LogDrawer({ log }: { log: readonly LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const newest = log.at(-1);
  const newestFirst = [...log].reverse();

  return (
    <section className={styles.drawer}>
      <button
        type="button"
        className={styles.bar}
        aria-expanded={expanded}
        aria-label="Run log"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={styles.newest} data-testid="log-live" aria-live="polite">
          {newest === undefined ? "" : logLine(newest)}
        </span>
        <span className={styles.toggle}>Run log {expanded ? "\u2228" : "\u2227"}</span>
      </button>

      {expanded && (
        <ul className={styles.list}>
          {newestFirst.map((entry, index) => (
            <li key={`${log.length - index}-${entry.kind}`}>{logLine(entry)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/components/LogDrawer.test.tsx && npm test`
Expected: PASS, 7 new tests, whole suite green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/LogDrawer.tsx src/ui/components/LogDrawer.module.css src/ui/components/LogDrawer.test.tsx
git commit -m "feat(ui): collapsible run log drawer with polite announcements"
```

---

### Task 20: Game over overlay and full composition

At the end of this task the game is completely playable.

**Files:**
- Create: `src/ui/components/GameOverOverlay.tsx`, `src/ui/components/GameOverOverlay.module.css`, `src/ui/components/GameOverOverlay.test.tsx`, `src/ui/App.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/App.module.css`

**Interfaces:**
- Consumes: `finalScore`, `GameState` from `../../engine`; `outcomeHeadline` from `../format`; `Hud`, `Room`, `WeaponStack`, `LogDrawer`, `ErrorBoundary`; `useGame`.
- Produces:
  ```ts
  export function GameOverOverlay(props: {
    state: GameState;
    onNewGame: (seed?: string) => void;
  }): JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing tests**

`src/ui/components/GameOverOverlay.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildDungeon } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { GameOverOverlay } from "./GameOverOverlay";

const won = stateWith({ status: "won", health: 9, discard: buildDungeon() });
const lost = stateWith({
  status: "lost",
  health: 0,
  deck: buildDungeon().filter((card) => card.id !== "C14"),
  discard: [c("clubs", 14)],
});

describe("GameOverOverlay", () => {
  it("renders nothing while the game is in progress", () => {
    const { container } = render(
      <GameOverOverlay state={stateWith({ deck: buildDungeon() })} onNewGame={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a win with the score", () => {
    render(<GameOverOverlay state={won} onNewGame={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("You escaped the dungeon")).toBeInTheDocument();
    expect(screen.getByTestId("score")).toHaveTextContent("9");
  });

  it("announces a loss with the negative score", () => {
    render(<GameOverOverlay state={lost} onNewGame={vi.fn()} />);
    expect(screen.getByText("You died in the dungeon")).toBeInTheDocument();
    expect(screen.getByTestId("score")).toHaveTextContent("-194");
  });

  it("starts a new random game", async () => {
    const onNewGame = vi.fn();
    render(<GameOverOverlay state={won} onNewGame={onNewGame} />);
    await userEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(onNewGame).toHaveBeenCalledWith();
  });

  it("replays the same seed", async () => {
    const onNewGame = vi.fn();
    render(<GameOverOverlay state={won} onNewGame={onNewGame} />);
    await userEvent.click(screen.getByRole("button", { name: /Replay/ }));
    expect(onNewGame).toHaveBeenCalledWith(won.seed);
  });

  it("shows the seed so a run is reportable", () => {
    render(<GameOverOverlay state={won} onNewGame={vi.fn()} />);
    expect(screen.getByText(new RegExp(won.seed))).toBeInTheDocument();
  });
});
```

`src/ui/App.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/?seed=4F2A9C");
});

describe("App", () => {
  it("renders the HUD, a four-card room, the weapon slot, and the log", () => {
    render(<App />);
    expect(screen.getByLabelText(/^Health/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^Room/ })).getAllByRole("group")).toHaveLength(4);
    expect(screen.getByRole("region", { name: "Equipped weapon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run away" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run log/i })).toBeInTheDocument();
  });

  it("resolves a card and reflects it in the log", async () => {
    render(<App />);
    const before = screen.getByTestId("log-live").textContent;
    const firstOffer = screen.getAllByTestId("offer").find((b) => !b.hasAttribute("disabled"));
    if (firstOffer === undefined) throw new Error("no enabled offer button rendered");
    await userEvent.click(firstOffer);
    expect(screen.getByTestId("log-live").textContent).not.toBe(before);
  });

  it("plays a whole dungeon to a terminal state and shows the overlay", async () => {
    render(<App />);

    for (let step = 0; step < 200; step += 1) {
      const dialog = screen.queryByRole("dialog");
      if (dialog !== null) {
        expect(within(dialog).getByTestId("score")).toBeInTheDocument();
        return;
      }
      const offer = screen.getAllByTestId("offer").find((b) => !b.hasAttribute("disabled"));
      if (offer === undefined) throw new Error("no enabled offer: the game deadlocked");
      await userEvent.click(offer);
    }

    throw new Error("game did not finish within 200 actions");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/components/GameOverOverlay.test.tsx src/ui/App.test.tsx`
Expected: FAIL — cannot resolve `./GameOverOverlay`.

- [ ] **Step 3: Write `GameOverOverlay.module.css`**

```css
.scrim {
  position: fixed;
  inset: 0;
  background: rgb(8 6 4 / 78%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--card-edge);
  border-radius: 7px;
  padding: 24px 28px;
  text-align: center;
  max-width: 380px;
}

.headline {
  margin: 0 0 6px;
  color: var(--gold);
  font-size: 20px;
}

.score {
  font-size: 42px;
  font-weight: 700;
  color: var(--gold);
  line-height: 1.1;
}

.caption {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.seed {
  font-size: 10.5px;
  color: var(--text-dim);
  margin: 12px 0 16px;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.button {
  border: 1px solid var(--gold-dim);
  background: #241c11;
  color: var(--gold);
  padding: 7px 14px;
  border-radius: 3px;
  font-size: 11px;
}
```

- [ ] **Step 4: Write `GameOverOverlay.tsx`**

```tsx
import { finalScore, type GameState } from "../../engine";
import { outcomeHeadline } from "../format";
import styles from "./GameOverOverlay.module.css";

export function GameOverOverlay({
  state,
  onNewGame,
}: {
  state: GameState;
  onNewGame: (seed?: string) => void;
}) {
  if (state.status === "playing") return null;

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={outcomeHeadline(state)}>
      <div className={styles.panel}>
        <h2 className={styles.headline}>{outcomeHeadline(state)}</h2>
        <p className={styles.caption}>Final score</p>
        <p className={styles.score} data-testid="score">
          {finalScore(state)}
        </p>
        <p className={styles.seed}>Seed {state.seed}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => onNewGame()}>
            New game
          </button>
          <button type="button" className={styles.button} onClick={() => onNewGame(state.seed)}>
            Replay this seed
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `App.tsx`**

```tsx
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { Hud } from "./components/Hud";
import { LogDrawer } from "./components/LogDrawer";
import { Room } from "./components/Room";
import { WeaponStack } from "./components/WeaponStack";
import { useGame } from "./hooks/useGame";
import styles from "./App.module.css";

function Game() {
  const { state, stats, offersFor, runOffer, dispatch, newGame } = useGame();

  return (
    <>
      <div className={styles.stage}>
        <Hud state={state} stats={stats} runOffer={runOffer} onAction={dispatch} />
        <Room state={state} offersFor={offersFor} onAction={dispatch} />
        <WeaponStack weapon={state.weapon} />
        <LogDrawer log={state.log} />
      </div>
      <GameOverOverlay state={state} onNewGame={newGame} />
    </>
  );
}

export function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className={styles.crash} role="alert">
            <h2>The dungeon collapsed</h2>
            <p>{error.message}</p>
            <p>Reload to resume, or start a new run.</p>
            <button onClick={reset}>Try again</button>
          </div>
        )}
      >
        <Game />
      </ErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/ui/components/GameOverOverlay.test.tsx src/ui/App.test.tsx && npm test && npm run typecheck`
Expected: PASS, 9 new tests, whole suite green, typecheck clean.

The "plays a whole dungeon" test greedily clicks the first enabled offer, so it usually dies rather than wins. Either terminal state passes. If it throws "the game deadlocked", that is a real engine bug — go back to the Task 10 property test.

- [ ] **Step 7: Play it**

Run: `npm run dev` and play a full game. Verify by hand: running is refused after resolving a card and after a previous run; a second heart in one room heals nothing; equipping discards the old weapon's whole stack; the game ends with a score.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/GameOverOverlay.tsx src/ui/components/GameOverOverlay.module.css src/ui/components/GameOverOverlay.test.tsx src/ui/App.tsx src/ui/App.test.tsx
git commit -m "feat(ui): game over overlay and full app composition

The app test plays an entire dungeon by clicking the first enabled offer,
which also asserts that a legal move always exists end to end."
```

---

### Task 21: Card exit animations and stage shake

The last piece of animation machinery, plus the shake. Everything else is already pure CSS from earlier tasks.

**Files:**
- Create: `src/ui/hooks/useExitTransition.ts`, `src/ui/hooks/useExitTransition.test.tsx`
- Modify: `src/ui/components/Room.tsx`, `src/ui/App.tsx`, `src/ui/App.module.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: React only.
- Produces:
  ```ts
  export type Transitioned<T> = { item: T; key: string; exiting: boolean };
  export function useExitTransition<T>(
    items: readonly T[],
    keyOf: (item: T) => string,
    durationMs: number,
  ): Transitioned<T>[];
  ```

- [ ] **Step 1: Write the failing test**

`src/ui/hooks/useExitTransition.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitTransition } from "./useExitTransition";

type Item = { id: string };
const keyOf = (item: Item) => item.id;

function Harness({ items }: { items: Item[] }) {
  const rendered = useExitTransition(items, keyOf, 200);
  return (
    <ul>
      {rendered.map((entry) => (
        <li key={entry.key} data-exiting={String(entry.exiting)}>
          {entry.item.id}
        </li>
      ))}
    </ul>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const ids = () => screen.getAllByRole("listitem").map((node) => node.textContent);
const exitingIds = () =>
  screen
    .getAllByRole("listitem")
    .filter((node) => node.dataset["exiting"] === "true")
    .map((node) => node.textContent);

describe("useExitTransition", () => {
  it("passes current items through untouched", () => {
    render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    expect(ids()).toEqual(["a", "b"]);
    expect(exitingIds()).toEqual([]);
  });

  it("retains a departed item marked as exiting", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    expect(ids()).toEqual(["a", "b"]);
    expect(exitingIds()).toEqual(["b"]);
  });

  it("drops the departed item after the duration", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    act(() => void vi.advanceTimersByTime(200));
    expect(ids()).toEqual(["a"]);
  });

  it("handles several departures at once", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]} />);
    view.rerender(<Harness items={[]} />);
    expect(exitingIds()).toEqual(["a", "b", "c", "d"]);
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("does not re-add an item that returns while exiting", () => {
    const view = render(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<Harness items={[{ id: "a" }]} />);
    view.rerender(<Harness items={[{ id: "a" }, { id: "b" }]} />);
    expect(ids().filter((id) => id === "b")).toHaveLength(1);
  });

  it("resolves immediately at zero duration, as reduced motion requires", () => {
    function ZeroHarness({ items }: { items: Item[] }) {
      const rendered = useExitTransition(items, keyOf, 0);
      return <ul>{rendered.map((e) => <li key={e.key}>{e.item.id}</li>)}</ul>;
    }
    const view = render(<ZeroHarness items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<ZeroHarness items={[{ id: "a" }]} />);
    act(() => void vi.advanceTimersByTime(0));
    expect(ids()).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/hooks/useExitTransition.test.tsx`
Expected: FAIL — cannot resolve `./useExitTransition`.

- [ ] **Step 3: Write `useExitTransition.ts`**

```ts
import { useEffect, useRef, useState } from "react";

export type Transitioned<T> = { item: T; key: string; exiting: boolean };

/**
 * Retains departed items briefly so an exit animation can run, since React
 * unmounts removed children immediately.
 *
 * The effect keys on a joined signature rather than the array identity, because
 * callers pass a freshly derived array on every render. `keyOf` is assumed pure
 * and stable, which is why it is not a dependency.
 */
export function useExitTransition<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  durationMs: number,
): Transitioned<T>[] {
  const [departed, setDeparted] = useState<Transitioned<T>[]>([]);
  const previous = useRef<readonly T[]>(items);
  const signature = items.map(keyOf).join("|");

  useEffect(() => {
    const currentKeys = new Set(items.map(keyOf));
    const gone = previous.current.filter((item) => !currentKeys.has(keyOf(item)));
    previous.current = items;

    // An item that came back must not linger in the exiting list.
    setDeparted((existing) => existing.filter((entry) => !currentKeys.has(entry.key)));

    if (gone.length === 0) return;

    const entries: Transitioned<T>[] = gone.map((item) => ({ item, key: keyOf(item), exiting: true }));
    setDeparted((existing) => [
      ...existing.filter((entry) => !entries.some((added) => added.key === entry.key)),
      ...entries,
    ]);

    const timer = setTimeout(() => {
      const goneKeys = new Set(entries.map((entry) => entry.key));
      setDeparted((existing) => existing.filter((entry) => !goneKeys.has(entry.key)));
    }, durationMs);

    return () => clearTimeout(timer);
  }, [signature, durationMs]);

  return [
    ...items.map((item) => ({ item, key: keyOf(item), exiting: false })),
    ...departed,
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ui/hooks/useExitTransition.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire exits into `Room.tsx`**

Replace the body of `Room` with:

```tsx
export function Room({ state, offersFor, onAction }: RoomProps) {
  const cards = useExitTransition(state.room, (card) => card.id, EXIT_MS);

  return (
    <section className={styles.room} aria-label={`Room ${state.roomNumber}`}>
      {cards.map(({ item, key, exiting }, index) => (
        <CardView
          key={key}
          card={item}
          // A departing card must not offer actions; its offers are stale.
          offers={exiting ? [] : offersFor(item)}
          state={state}
          onAction={onAction}
          exiting={exiting}
          dealIndex={index}
        />
      ))}
    </section>
  );
}
```

and add above it:

```tsx
import { useExitTransition } from "../hooks/useExitTransition";

/** Must match --dur-exit in tokens.css. */
const EXIT_MS = 200;
```

`Room.test.tsx` still passes because a card present in `state.room` renders exactly once with `exiting: false`.

- [ ] **Step 6: Add the stage shake**

Append to `src/ui/App.module.css`:

```css
/*
  Two identical keyframe sets. Alternating between them restarts the animation
  without remounting the subtree, which would restart the deal animations too.
*/
.shakeA {
  animation: shakeA var(--dur-shake) ease-in-out;
}

.shakeB {
  animation: shakeB var(--dur-shake) ease-in-out;
}

@keyframes shakeA {
  0%, 100% { transform: none; }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

@keyframes shakeB {
  0%, 100% { transform: none; }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
```

In `src/ui/App.tsx`, replace the `Game` component's stage `div` with:

```tsx
function Game() {
  const { state, stats, offersFor, runOffer, dispatch, newGame } = useGame();

  const lastEntry = state.log.at(-1);
  const heavyHit = lastEntry?.kind === "fight" && lastEntry.damage >= 8;
  const shake = heavyHit ? (state.log.length % 2 === 0 ? styles.shakeA : styles.shakeB) : "";

  return (
    <>
      <div className={`${styles.stage}${shake === "" ? "" : ` ${shake}`}`}>
        <Hud state={state} stats={stats} runOffer={runOffer} onAction={dispatch} />
        <Room state={state} offersFor={offersFor} onAction={dispatch} />
        <WeaponStack weapon={state.weapon} />
        <LogDrawer log={state.log} />
      </div>
      <GameOverOverlay state={state} onNewGame={newGame} />
    </>
  );
}
```

- [ ] **Step 7: Update `README.md`**

Replace the whole file with:

```markdown
# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck.

## Play

```bash
npm install
npm run dev
```

Every run has a six-character seed shown in the HUD and written to the URL, so a
dungeon can be shared or replayed by passing `?seed=4F2A9C`.

## Rules

`docs/rules.md` is the rule set. `docs/design/2026-08-02-scoundrel-game-design.md`
resolves the ten places those rules are ambiguous and is authoritative for
implementation.

## Development

See `AGENTS.md` for commands. The rules engine in `src/engine/` is pure
TypeScript with no React, no browser APIs, and no user-visible strings; it is
tested independently of the UI.
```

- [ ] **Step 8: Full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck exits 0, production build succeeds.

Then `npm run dev` and confirm by hand:

- Cards drop in with a stagger when a room is dealt
- A resolved card animates out rather than vanishing
- The health bar slides and a red `−N` floats up on damage
- The stage shakes on a hit of 8 or more, and consecutive equal hits both shake
- With OS "reduce motion" enabled, everything is instant and nothing is broken
- Refreshing mid-run resumes the same position
- Editing the URL seed to a different value starts that dungeon
- The best score survives a reload

- [ ] **Step 9: Commit**

```bash
git add src/ui/hooks/useExitTransition.ts src/ui/hooks/useExitTransition.test.tsx src/ui/components/Room.tsx src/ui/App.tsx src/ui/App.module.css README.md
git commit -m "feat(ui): card exit transitions and stage shake

useExitTransition is the only animation machinery in the codebase. The shake
alternates between two identical keyframe sets so repeated hits restart the
animation without remounting the stage."
```

---

## Definition of done

- [ ] `npm test` passes with no skipped tests
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` succeeds
- [ ] All ten rule interpretations from the spec have a named test
- [ ] The invariant property test plays full games on eight seeds
- [ ] `src/engine/` imports no React, no browser API, and contains no user-visible string
- [ ] A full game is playable in the browser, ends with a score, and survives a refresh
