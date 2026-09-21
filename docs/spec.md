# Scoundrel — Implementation Spec

## Problem Statement

As a player, I want to play Scoundrel — a 1-player roguelike dungeon-crawling card game with a standard deck — in a browser, so that I can enjoy a quick strategic solo game without setup, learn the rules intuitively, undo mistakes within a room, track my run history, and share reproducible runs with friends.

## Solution

A modern-RPG-styled web app (React + Vite + TypeScript) with a dark dungeon-crawler theme and a sharp, modern UI (crisp typography, depth/shadow, high contrast), implementing the full Scoundrel rule set from `docs/rules.md` by default, with optional house-rule toggles, per-room undo, save/resume, seedable & shareable runs, a stats dashboard with run history, and full unit/integration/e2e test coverage. The game logic lives in a pure TS engine (no React imports) wrapped by a thin React + Zustand UI layer, enabling fast deterministic tests and a clean engine/UI separation.

## User Stories

### Setup & discovery

1. As a new visitor, I want to land on a title screen with a dark dungeon-crawler backdrop, so that I immediately understand the game's mysterious, adventurous mood and can choose an action.
2. As a returning player with a saved run, I want a prominent "Continue" button on the title screen, so that I can resume my in-progress run in one click.
3. As a player who wants a fresh game, I want a "New Run" button on the title screen, so that I can start a brand-new randomized dungeon.
4. As a player who received a seed from a friend, I want an "Enter Seed" option on the title screen, so that I can reproduce their exact dungeon.
5. As a curious player, I want an "About" screen accessible from the title menu, so that I can read a condensed rules summary, credits, and links to the original PDF and the repo without leaving the app.
6. As a stats-minded player, I want a "Stats" entry on the title menu, so that I can view my win-rate, best score, streaks, and run history.
7. As a customizer, I want a "Settings" entry on the title menu, so that I can toggle house rules before starting a run.

### Core gameplay loop

8. As a player starting a run, I want the engine to deal the top 4 cards face up as a room, so that I can see the room and plan.
9. As a player in a room, I want to resolve exactly 3 of the 4 cards in any order I choose, so that I exercise strategic choice.
10. As a player resolving a room, I want the 4th un-resolved card to automatically carry over to the next room, so that the rules are enforced without manual bookkeeping.
11. As a player entering the next room, I want the carried card to be visually distinguished (tint/badge) from the 3 newly dealt cards, so that I learn and remember the carryover mechanic.
12. As a player who has resolved 3 cards, I want an explicit "Enter Next Room" button, so that I control the pacing and can pause to consider undo before committing.
13. As a player who has cleared the deck, I want the final partial room (fewer than 4 cards) to be resolved in full (no carryover), so that the dungeon is fully clearable and I can win.
14. As a player in the final single-card room, I want that card to be resolvable, so that the run can end in a win rather than stalling.

### Card interaction & combat

15. As a player facing a monster, I want to click the monster card to select it and see a damage preview ("Fighting 8♣ with weapon 5: take 3 dmg"), so that I make an informed decision before committing.
16. As a player, I want to confirm the action after previewing, so that misclicks don't accidentally commit me to a bad fight.
17. As a player with a weapon equipped, I want the option to fight a monster barehanded instead, so that I can preserve the weapon's kill threshold for a stronger upcoming monster.
18. As a player fighting barehanded, I want to take damage equal to the monster's full value, so that the rules are enforced.
19. As a player fighting with a weapon, I want the damage to equal `max(0, monster − weapon)`, so that stronger weapons reduce damage and can nullify weak monsters.
20. As a player, I want defeated monsters placed on top of a kill stack with the last-killed on top, so that I can see the weapon's current threshold at a glance.
21. As a player with a weapon, I want the weapon card displayed on the left and the kill stack on the right, so that the weapon-and-kills layout mirrors a physical card game and the threshold is legible.
22. As a player using a degraded weapon, I want to only be able to fight monsters weaker than the last monster it killed, so that the degradation rule is enforced.
23. As a player picking up a new weapon, I want my old weapon and its entire kill stack to be discarded, so that the new weapon starts fresh per the rules.
24. As a player, I want the weapon-swap discard to be announced visibly, so that I understand the cost of switching weapons mid-run.

### Items & potions

25. As a player who finds a Heart, I want to drink it to restore HP equal to its value (capped at 20), so that I can recover health.
26. As a player in a room with multiple Hearts, I want only the first potion I drink to heal me; extras to be discarded without healing, so that the one-potion-per-room rule is enforced.
27. As a player who skips a Heart as the carryover card, I want it to carry to the next room and remain a valid drink (potions counter resets per room), so that the carry rule applies uniformly to all card types.

### Running away

28. As a player facing a bad room, I want to run away once per turn to send all 4 cards to the bottom of the Dungeon and deal a new room, so that I can escape unwinnable situations.
29. As a player who just ran away, I want to be blocked from running a second consecutive room, so that the "no two runs in a row" rule is enforced.
30. As a player in the final room (no cards left in the Dungeon after the deal), I want the "Run Away" action to be disabled, so that I can't attempt to escape the room I must resolve to win — fleeing it would just re-deal the same cards.
31. As a player, I want the disabled Run action to be visibly greyed out with a tooltip explaining why, so that I understand the constraint.

### Undo

32. As a player who made a mistake in the current room, I want an "Undo to Room Start" action that rewinds the current room to its beginning, so that I can retry the room without restarting the whole run.
33. As a player, I want undo to restore HP, weapon, kill stack, room cards, and potion counter to the room's start state, so that the rewind is faithful.
34. As a player, I want undo to be available only within the current room (a single current-room snapshot), so that the game stays strategically meaningful and I can't brute-force the whole dungeon.
35. As a player, I want the current-room snapshot to be cleared once I click "Enter Next Room", so that I can't rewind into a previous room's deal.
36. As a player, I want "Undo to Room Start" to not undo my transient card-selection highlight (selection is ephemeral UI state), so that engine truth and UI ephemera stay cleanly separated.

### Win/lose & scoring

37. As a player who clears every room until the deck is empty, I want to see a Win screen with my final score equal to remaining HP, so that I'm rewarded for survival.
38. As a player whose HP drops to 0 or below, I want to see a Lose screen with my final negative score (0 minus remaining unplayed monster values), so that the loss is scored per the rules.
39. As a player on the Win/Lose screen, I want a scorecard showing outcome, final HP, score, seed, toggles used, and run highlights (monsters killed, potions wasted, rooms explored), so that the run feels meaningful.
40. As a player on the Win/Lose screen, I want a "Copy replay link" button that copies `#/play?seed=...&config=...`, so that I can share my run.
41. As a player who reloads the page while on the Win/Lose screen, I want the screen to survive reload (terminal outcome persisted inline in the run record), so that a refresh doesn't lose my end state.
42. As a player finishing a run, I want the run's stats record to be written to the stats store exactly once (idempotent, guarded by a "stats-written" flag), so that reloads don't double-count my run.

### Persistence & save/resume

43. As a player who closes the browser mid-run, I want my run state (including current-room snapshot) saved to localStorage, so that I can resume later.
44. As a returning player, I want to land on the title screen (not auto-dropped into the run), so that the resume behavior is predictable and never disorienting.
45. As a player, I want settings, stats, and the active run to live in separate localStorage keys (`scoundrel:settings`, `scoundrel:stats`, `scoundrel:run`), so that changing settings doesn't disturb my active run and clearing my run doesn't wipe my stats.
46. As a player upgrading to a new schema version, I want my saved data to migrate automatically via versioned wrappers (`{version, data}`), so that schema changes don't corrupt or reset my data.

### Stats dashboard

47. As a player, I want the stats dashboard to show games played, wins, losses, win-rate, best score, current streak, and best streak, so that I can track my performance.
48. As a player, I want a scrollable run history (newest first, capped at ~50 entries), so that I can review recent runs.
49. As a player, I want each run history entry to show seed, config (toggles), outcome, score, date, and rooms cleared, so that I have full context.
50. As a player viewing a run history entry, I want a "Replay" affordance that loads that run's seed + config, so that I can re-experience the exact dungeon.

### Settings & rule toggles

51. As a player, I want a settings screen exposing three rule toggles — run-away restriction (once vs unlimited), potions per room (1 vs unlimited), and weapon degradation (on vs off) — so that I can adjust the ruleset to my taste.
52. As a player, I want the default settings to enforce the canonical rules from `docs/rules.md`, so that the game is faithful out of the box.
53. As a player, I want my settings persisted across sessions, so that I don't have to reconfigure every launch.

### Accessibility

54. As a keyboard-only player, I want all cards and actions reachable via tab + arrow keys, so that I can play without a mouse.
55. As a screen-reader user, I want ARIA labels on cards ("8 of Clubs, monster, value 8"), so that the game state is legible.
56. As a screen-reader user, I want live-region announcements on combat results (damage taken, weapon broke), potion quaffs, and win/lose transitions, so that I can follow the game audibly.
57. As a player with low vision, I want sufficient color contrast and clear focus indicators, so that the dark theme doesn't compromise legibility.

### Onboarding & tooltips

58. As a new player, I want hover/tap-and-hold tooltips on card types, the weapon/degradation mechanic, and the run-away restriction, so that I can learn the rules without a linear tutorial.
59. As a player inspecting the weapon stack, I want a tooltip explaining the degradation chain ("can only fight monsters weaker than the last kill"), so that the most-confusing mechanic is discoverable.
60. As a player, I want the damage-preview tooltip and contextual tooltips to share infrastructure, so that the experience is consistent.

### Sharing & reproducibility

61. As a player, I want the current run's seed displayed somewhere on the play screen, so that I can note it or share it mid-run.
62. As a player, I want a shareable URL (`#/play?seed=...&config=...`) that reproduces the exact run, so that I can challenge friends with the same dungeon.
63. As a tester or bug-reporter, I want to share a seed + config that reproduces a bug deterministically, so that maintainers can replay the exact failing run.

### Mobile & responsive

64. As a mobile player, I want the layout to adapt to small screens with tap-friendly card targets, so that the game is playable on a phone.
65. As a player on any device, I want the HUD (HP, deck count, weapon stack, run-away indicator) to remain legible, so that critical info is always visible.

## Implementation Decisions

### Architecture & module layout

- **Engine/UI split**: A pure TypeScript engine module (`src/engine/`) holds all game rules, deck composition, RNG, combat math, weapon degradation, potion cap, run-away restriction, win/lose detection, and scoring. The engine imports zero React/UI code, so it runs in Node without a DOM for fast deterministic unit tests. The UI module (`src/ui/`) contains React components, the Zustand store, persistence adapters, and the router/renderer. Assets (`src/assets/`) hold raster art (title backdrop / key art only).
- **Reducer + pure functions**: The engine exposes `createInitialState(seed, config)` and a reducer `(state, action) → { state, result }`. The reducer is pure: it returns a new state and a typed result payload; no side effects. This is directly testable and supports per-room undo via snapshot/restore of a plain serializable object.
- **Selection lives in the store, not engine state**: The transient "currently selected card" highlight belongs in the Zustand store as a UI-only slice and is NOT part of `GameState`. The engine answers "what is the game truth"; the store/UI answers "what is the user hovering." Snapshots therefore exclude selection; undo restores game truth without pulsing ephemeral UI state. This is the canonical engine/UI split.

### Engine state shape (`GameState`)

A flat, JSON-serializable object (derived from the to-spec prototype sketches in `design-plan.md`):

```ts
interface GameState {
  seed: string;
  config: GameConfig;
  phase: 'playing' | 'won' | 'lost';
  hp: number;
  maxHp: number;
  dungeon: CardId[]; // remaining draw pile
  room: CardId[]; // current room (4 or fewer), incl. carried
  resolvedCount: number; // cards resolved this room
  weapon: CardId | null;
  killStack: CardId[]; // last-killed at killStack[length-1]
  potionsUsedThisRoom: number;
  ranAwayLastRoom: boolean;
  turnCount: number;
  runHighlights: { monstersKilled; potionsWasted; roomsExplored };
  startedAt: number;
  roomSnapshot: GameState | null; // single current-room snapshot for undo
}
```

Selection (`selectedCardId`) is intentionally absent — it lives in the store. This shape is the prototype-derived decision encoding for Q45b.

### Config object

A single `GameConfig` object flows through engine → store → settings UI → persistence → tests:

```ts
interface GameConfig {
  runAwayMode: 'once' | 'unlimited';
  potionsPerRoom: 1 | Infinity;
  weaponDegradation: boolean;
}
```

Default config enforces `docs/rules.md` exactly. Presets, if ever desired, are factory functions returning a `GameConfig` — additive, not architectural.

### Action union (card-targeted)

Explicit card-targeted actions, one per card type:

- `StartNewRun{seed, config}`
- `DealRoom`
- `FightMonster{cardId, barehanded?: boolean}`
- `DrinkPotion{cardId}`
- `EquipWeapon{cardId}`
- `RunAway`
- `UndoToRoomStart`
- `EnterNextRoom`

`FightMonster` accepts an optional `barehanded` flag because rules line 27 makes barehanded an explicit alternative even with a weapon equipped. Invalid actions (e.g. `EquipWeapon` on a heart) reduce to a typed `InvalidAction{reason}` result rather than a runtime throw.

### Result union (state + result tuple)

The reducer returns `{ state, result }`; `result` is a discriminated union:

- Per-action: `MonsterDefeated{cardId, damage, weaponBroke, usedWeaponId?}`, `WeaponEquipped{cardId, discardedWeaponId?, discardedMonsterIds[]}`, `PotionQuaffed{cardId, healed, wasted}`, `RanAway{newCards}`, `RunAwayBlocked{reason: 'twice-in-row' | 'final-room'}`, `RoomDealt{cards, carriedFrom?}`, `UndoDone`, `InvalidAction{reason}`
- Terminal: `GameWon{score, seed, config}`, `GameLost{score, seed, config}`

Terminal results live in the union (not derived from `state.phase` alone) so the UI can write the stats record once at the natural moment (the result handler) and so the win/lose screen is reload-safe.

### RNG & seeds

A `mulberry32` PRNG (~10 lines, no dep) seeded by a `uint32`. The seed is shared/transmitted as a ~6-char base36 string. The engine takes the seed as a constructor arg (`StartNewRun{seed, config}`), enabling deterministic unit/integration/e2e tests and shareable/replayable runs.

### Rule decisions (engine-enforced)

- **Combat damage** = `max(0, monster − weapon)`.
- **Barehanded** is always a legal `FightMonster` option even with a weapon equipped.
- **Weapon swap** discards the weapon AND its entire kill stack; the new weapon starts fresh.
- **Weapon layout**: weapon card rendered on the left, kill stack on the right, with monsters still drawn as physical cards, last-killed on top. (UI/layout decision recorded here for cross-reference.)
- **Final partial room** (deck < 4 remaining): deal `min(4, remaining)`; if no next room exists (dungeon empty after this deal), resolve-all with no carryover; the final single-card room resolves that one card and triggers win. Unit tests must cover 4/3/2/1 remaining cases.
- **Run away** is disabled only in the final room (Dungeon empty after the current deal — fleeing would immediately re-deal the same cards). Whenever cards remain in the Dungeon, running is legal: the fled room's four cards go to the bottom and form part of the next deal. The twice-in-a-row restriction is the primary rule. UI greys Run via the available-actions query.
- **Unresolved hearts carry normally** to the next room; the potions-per-room counter resets per room; the `potionsPerRoom` toggle only changes the within-room cap, not the carry rule.

### Persistence

- **Sharded localStorage** with three keys: `scoundrel:settings`, `scoundrel:stats`, `scoundrel:run`. Each holds a single versioned wrapper `{version, data}` and a `migrate(key, currentVersion)` helper upgrades across schema versions. The settings shard is at version 2 (bumped at its call-site only — the global stamp stays 1 so run/stats shards are unaffected); the validator tolerates shards saved by older/removed-field builds, ignoring unknown extra fields.
- **`run` data** holds `GameState` + current snapshot + seed + config + startedAt + terminal outcome if completed. The terminal outcome is kept inline until the player returns to title so the win/lose screen survives reload. Stats write is idempotent (guarded by a "stats-written" flag) to prevent double-counting on reload.
- **`stats` data**: aggregates (`gamesPlayed`, `wins`, `losses`, `bestScore`, `currentStreak`, `bestStreak`) + a bounded `runs: RunRecord[]` (cap ~50, newest first). Each `RunRecord = {seed, config, outcome, score, date, roomsCleared}` doubles as the source for the "Replay this run" feature (seed + config).

### Routing & flow

- **Hash router** (`#/`, `#/play`, `#/stats`, `#/settings`) — no SPA-fallback config needed on GitHub Pages.
- **Title screen** with full menu (New Run, Continue if save, Enter Seed, Stats, Settings, About). App opens to the title; `Continue` is enabled only when a saved run exists.
- **Shareable run URL**: `#/play?seed=...&config=...` encodes the seed and the `GameConfig`. Opening this URL starts the run deterministically.

### UI interaction model

- **Click-to-select + damage preview + confirm**: activating a card (click on the canvas sprite — the DOM mirror mirrors the same hit-targets — or arrow-key selection through the overlay card-selection control) highlights it and shows a damage/cost preview; choosing "Fight" / "Drink" / "Equip" confirms. Keyboard-navigable and mobile-friendly.
- **Carryover auto-determined**: the un-resolved 4th card auto-carries to the next room and is visually marked (tint/badge) there.
- **Explicit "Enter Next Room" button**: creates the clean undo seam. Clicking it clears the current snapshot and snapshots the new room at its start.
- **Tooltips** (no linear tutorial): hover/tap-and-hold on card types, the weapon readout, and the run-away restriction. Tooltips reuse the damage-preview + ARIA live-region infrastructure.

### Accessibility

- All cards and actions are keyboard-reachable (the overlay card-selection control cycles the room with arrows/Home/End; every action button is tabbable).
- ARIA roles/labels describe cards ("8 of Clubs, monster, value 8") — card names are announced through the selection control's live region; the aria-hidden DOM room mirror keeps the room composition readable outside the canvas.
- Live regions announce combat results, potion quaffs, run-away blocks, and win/lose — driven directly by the Q25b result payloads.

### Visual & design

- **Modern RPG** aesthetic: dark dungeon-crawler theme, sharp and modern UI (crisp typography, depth/shadow, high contrast), mysterious and adventurous atmosphere; **hybrid rendering**: Phaser 4 owns the play screen's game table (card sprites, weapon + kill stack, tween-driven motion), while CSS + modern typography carry the HUD, action panel, and every other screen; raster art for the card artwork and the title backdrop.
- **Phased designer handoff**: Phase 1 = style guide + play screen + title (highest leverage); Phase 2 = stats, settings, win/lose scorecard. The designer overlaps Phase 2 once the style guide is approved; engineering implements Phase 1 in parallel.

### Toolchain

- Scaffold via `pnpm create vite@latest --template react-ts`, then strip `App.tsx` boilerplate and add the `engine/`/`ui/`/`store/`/`assets/` layers.
- **pnpm** (pinned via the `packageManager` field in `package.json`); CI installs with `pnpm install --frozen-lockfile`, with pnpm set up via `pnpm/action-setup` before `actions/setup-node` (which restores the pnpm store cache).
- **Strict TS + typescript-eslint (strict) + Prettier**.
- **Phaser 4** owns the play screen's game table (one prebuilt ESM module — not tree-shakeable — loaded exclusively through a dynamic import so the chunk stays off the title/stats routes; a `manualChunks` entry pins it to its own bundle).
- **GitHub Pages** deploy with **env-driven base path**: `base: process.env.BASE_URL ?? '/'`; CI sets `BASE_URL=/scoundrel/`. Hash router tolerates any base.

### CI

- On push to `main`: install, lint, typecheck, unit + integration (Vitest), Playwright e2e (Chromium only), build, deploy to GitHub Pages.
- On PR: same minus deploy; Playwright uploads failure screenshots/traces as artifacts.

## Testing Decisions

### Testing philosophy

A good test asserts **external behavior**, not implementation details. We test the engine through its public reducer API `(state, action) → { state, result }` and assert the returned state and result; we never reach into private helpers or assert on internal data structures that aren't part of the contract. Integration tests assert user-visible outcomes (rendered text, accessibility tree) via React Testing Library queries, not on component internals. E2e tests assert player-visible flow outcomes via Playwright locators, treating the app as a black box.

### Seams

We prefer the **fewest seams possible** — ideally one. This spec uses **three seams**, each at the highest practical point:

1. **Engine reducer seam (pure unit tests)** — the highest-leverage single seam. Tests call `reducer(state, action)` and assert `{ state, result }`. Covers all rule behavior: deck composition (44-card), combat damage (`max(0, m−w)`), barehanded vs weapon, weapon degradation threshold, weapon swap discards stack, potion cap (1 vs toggle), potion counter reset on room, run-away twice-in-a-row block, run-away final-room gate, unresolved-heart carry, final-partial-room shapes (4/3/2/1 remaining), win/lose detection, scoring formulas. Deterministic via mulberry32 seeds; runs in Node with no DOM. _This seam absorbs the vast majority of test surface._

2. **React component seam (integration)** — React Testing Library + Vitest. Renders React components with a Zustand store and asserts on the accessible rendered output (queries like `getByRole`, `getByText`, `findByLiveAnnouncement`). The `src/game` entry is stubbed in jsdom (no canvas/WebGL there — Phaser must never load under RTL). Covers: card-selection state appears in the store (not engine), keyboard selection through the overlay CardSelectionControl, confirming an action dispatches the engine action and re-renders, damage-preview reflects the reducer's preview, undo button rewinds, carryover marker appears on the carried card, win/lose screen renders the scorecard (the handoff gate opens via the stubbed run-ended channel), replay-link affordance copies the URL. No mount of internal subcomponent state; no `instance()` access.

3. **Playwright seam (e2e)** — highest seam for behavior that crosses the whole stack (router, persistence, real browser — including the Phaser canvas). Tests drive the title → new run → play → win/lose → stats flow with seeded URLs (`#/play?seed=FIXED&config=...`) for deterministic assertions of exact outcomes (the seedability decision Q16a makes this possible — this is the rare e2e case that can assert _exact_ final scores, not just invariants). Canvas input goes through the aria-hidden DOM room mirror (the same `[data-card-id]` hit-targets the canvas draws), keyboard selection through the overlay control, and assertions stay on the DOM overlay; the game's `data-table-ready` marker gates canvas-dependent waits, `reducedMotion: 'reduce'` emulation pins tween end-states, and a `motion=off` hash param is the URL escape hatch. Covers: localStorage persistence survives reload, win/lose screen survives reload (Q37b idempotent stats — reloading the win screen does NOT double-count the run), shareable URL round-trip, keyboard card selection via the overlay control, SR announcements present in the a11y tree, and one canvas snapshot covering card layout. _Chromium-only in CI_ (Q48a); one config line to add Firefox/WebKit later if bugs surface.

### Why three seams and not one

A single seam (e2e only) would force every rule edge case through a full browser run — too slow and too brittle for the rule-coverage the engine needs. A single seam (engine only) would miss React store/UI wiring (selection-in-store, persistence reload-safety, SR announcements). The three-seam split puts each concern at its highest feasible point: pure rules at the reducer, React wiring at RTL, cross-stack behavior at Playwright.

### Modules under test

- **Engine**: deck builder, mulberry32 PRNG, reducer, action handlers, result constructors, win/lose detection, scoring. (Seam 1.)
- **Persistence adapters**: localStorage wrappers, migrator, schema versioning. (Seam 2, via RTL — render the app, reload the JS context, assert state restored.)
- **UI components**: title, play, stats, settings, about screens; card components; HUD; weapon-zone readout; damage preview; tooltips; win/lose scorecard. (Seam 2.)
- **Store**: Zustand store wiring actions to the reducer, selection state, undo snapshot management, the `lastResult` result channel consumed by the renderer. (Seam 2, via the rendered UI.)
- **Phaser renderer layer** (`src/game/`): table scene layout, store bridge (result → presentation commands, snapshot first-sync, drift fallback), animations, texture loading — unit-tested against a stubbed scene; the canvas itself is covered by the e2e snapshot. (Seams 1/3.)
- **Cross-stack flows**: full run lifecycle, persistence reload, shareable URL, a11y. (Seam 3.)

### Prior art

No prior art in this greenfield repo. The codebase conventions do not yet exist; this spec establishes them. The React Testing Library "test behavior, not implementation" approach is the prior art we adopt. Playwright's seeded-URL pattern (deterministic e2e via app-controlled RNG) is the prior art we adopt for exact-outcome e2e.

## Out of Scope

- **Real rule toggles beyond the three core** (run-away, potions/room, weapon degradation). Scoring variants, deck-composition variants, and difficulty presets behind the settings screen are deferred — Q10a settled on the core three.
- **Multi-room undo / full game rewind**. Only single current-room snapshot undo (Q7b, Q36a) is in scope.
- **Per-card-action undo**. Out of scope — would trivialize strategy.
- **Linear onboarding tutorial**. Tooltips only (Q34b).
- **Real-time multiplayer or online leaderboards**. Single-player only.
- **Daily challenge mode**. Seedability (Q16a) makes it trivially addable later; not built now.
- **Deep analytics** (per-room HP curves, card-resolution frequencies, monster kill counts beyond run-highlights). Persistence stays at a single bounded run-list (Q50a).
- **Additional e2e browsers in CI**. Chromium only for now (Q48a); WebKit/Firefox added later only if specific bugs justify them.
- **Architecture docs parallel to the code**. Contracts live in typed TS, not separate markdown (Q39b). Only `README.md` (overview + commands) and `docs/rules.md` (canonical rules) are maintained as prose.
- **Vercel/Netlify/custom-domain deploy**. GitHub Pages only (Q20a).
- **Audio**. Not in scope; the dark theme is visual.
- **Internationalization**. English-only for now.
- **Server-side state or accounts**. All-local; no backend.

## Further Notes

### Source of truth

- `docs/rules.md` is the canonical rule set. The engine implements it exactly under the default `GameConfig`. Any divergence between this spec and `docs/rules.md` is a spec bug.
- `docs/design-plan.md` records the 55 grilling-settled decisions that produced this spec; it is the source of truth for _why_ each decision was made. This spec is the source of truth for _what_ gets built.

### Reused prototypes / decision snippets

- The `GameState` and `GameConfig` interfaces in Implementation Decisions are derived from the grilling prototype sketches in `design-plan.md` (Q45b, Q19a). They encode decisions more precisely than prose; they are NOT a working implementation and will trim further during build (e.g. `runHighlights` field types).

### Key cross-decision synergies

- **Seedability (Q16a) + run history (Q18b)** = "Replay this run" feature is essentially free — `RunRecord.seed + RunRecord.config` is all that's needed.
- **Seedability (Q16a) + hash router (Q13c)** = shareable replay URLs (`#/play?seed=...&config=...`) are essentially free.
- **Result union (Q35b) + accessibility (Q28b)** = SR live-region announcements map 1:1 to result payloads.
- **Result union (Q35b) + damage preview (Q17d)** = previews read the same typed payloads the UI uses for feedback.
- **Engine/UI split (Q14a) + selection-in-store (Q45b)** = engine unit tests run in Node with zero React; the snapshot excludes ephemeral UI state, keeping undo and persistence honest.

### Mechanical leftovers (no spec decision needed; handled by the builder)

- `CardId` string format and the 44-card definition table.
- ESLint rule selection within the strict preset.
- Exact `mulberry32` implementation module.
- Component folder layout under `src/ui/`.
