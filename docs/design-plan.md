# Scoundrel — Shared Understanding (55 decisions settled)

### A. Platform & stack
- **Q1a / Q5a** — Web app, **React + Vite + TypeScript**
- **Q2c** — Full scope: core loop + persistence + settings + difficulty variants + stats dashboard + undo
- **Q3a → overridden by Q6b** — Rules faithful to `docs/rules.md` *by default*; house-rule toggles exposed behind a settings screen
- **Q4c** — Full testing commitment: unit + integration + e2e

### B. Architecture
- **Q14a** — **Engine/UI split**: `src/engine/` (pure TS, zero React, fully Node-testable) + `src/ui/` (React, Zustand, persistence) + `src/assets/`
- **Q21b** — **Reducer + pure functions**: `(state, action) → { state, result }`
- **Q45b** — **Selection lives in the Zustand store, not engine state** — engine = pure game truth; store/UI owns transient card-selection/preview
- **Q9a** — **Zustand** for state management (snapshot/restore trivial for per-room undo)

### C. Engine contract
- **Q30a** — **Card-targeted actions**: `StartNewRun`, `DealRoom`, `FightMonster(cardId, {barehanded})`, `DrinkPotion(cardId)`, `EquipWeapon(cardId)`, `RunAway`, `UndoToRoomStart`, `EnterNextRoom`
- **Q25b** — **State + result tuple** (result is a return value, not a side effect)
- **Q35b** — **Result union**: per-action members (`MonsterDefeated{damage, weaponBroke, usedWeaponId}`, `WeaponEquipped{discardedWeaponId, discardedMonsterIds[]}`, `PotionQuaffed{healed, wasted}`, `RanAway{newCards}`, `RunAwayBlocked{reason}`, `RoomDealt{cards, carriedFrom}`, `UndoDone`, `InvalidAction{reason}`) + terminal `GameWon{score, seed, config}`, `GameLost{score, seed, config}`
- **Q16a / Q26a** — **Seedable + shareable**: `mulberry32` PRNG, seed shared as ~6-char base36 string; engine takes `(seed, config)`

### D. Rule decisions (engine-side)
- **Q41a** — Combat damage = `max(0, monster − weapon)`; **barehanded always an option** even with a weapon equipped (preserves weapon threshold strategically)
- **Q42a** — On weapon swap, **entire stack discarded** (weapon + all defeated monsters); new weapon starts fresh
- **Q40 custom** — **Weapon card on left, kill stack on right**; killed monsters still rendered as physical cards, **last-killed on top**
- **Q52c** — **Adaptive final room**: deal `min(4, remaining)`; once no next room exists, **resolve-all** (no carryover); single-card final room resolves that card and triggers win
- **Q53a** — **Run disabled when `dungeon.length < 4`** (can't form a new room)
- **Q54a** — **Unresolved hearts carry normally** to next room; potions-per-room counter resets per room; the Q10 toggle only changes the within-room cap, not carry rules

### E. Rule toggles (settings screen)
- **Q6b / Q10a** — Three **core toggles**: run-away restriction (once vs unlimited), potions per room (1 vs unlimited), weapon degradation (on vs off)
- **Q19a** — Single **`GameConfig` object**: `{ runAwayMode: 'once'|'unlimited', potionsPerRoom: 1|Infinity, weaponDegradation: boolean }`. Engine takes config as a constructor arg.

### F. Persistence
- **Q11b / Q22b** — **Sharded localStorage** with **single versioned wrapper** per key: `scoundrel:settings`, `scoundrel:stats`, `scoundrel:run` (each `{version: 1, data: {...}}`; migrators honor `version`)
- **Q37b** — **`run` schema**: `GameState` + current snapshot + seed + config + startedAt + **terminal outcome if completed** (so win/lose screen is reload-safe); stats write idempotent (guarded by flag)
- **Q50a** — **`stats` schema**: aggregates (`gamesPlayed`, `wins`, `losses`, `bestScore`, `currentStreak`, `bestStreak`) + bounded `runs: RunRecord[]` (capped e.g. 50), each `RunRecord = {seed, config, outcome, score, date, roomsCleared}` — doubles as "replay this run" source

### G. Game flow & UX
- **Q13c** — **Hash router**: `#/`, `#/play`, `#/stats`, `#/settings`
- **Q17d** — **Click-to-select + damage preview + confirm** (keyboard-navigable, mobile-friendly)
- **Q29b** — **Carryover auto-determined** (unresolved 4th card), **visually marked** (tint/badge) in the next room
- **Q31b** — **Explicit "Enter Next Room" button** — creates the clean undo seam; current snapshot discarded once the new room is dealt
- **Q7b / Q36a** — **Per-room undo, current-room snapshot only**; `UndoToRoomStart` restores the snapshot; "Enter Next Room" clears the old snapshot and snapshots the new one
- **Q32a** — **Full title menu**: New Run, Continue (if save), Enter Seed, Stats, Settings, About (raster backdrop)
- **Q33b** — App opens to **title screen**; `Continue` prominent only if a save exists
- **Q38c** — **Win/lose scorecard** with **copyable replay link** (`#/play?seed=...&config=...`); run highlights (monsters killed, potions wasted, rooms explored) in state
- **Q43a** — **About screen**: condensed rules + credits + links to original PDF and repo
- **Q34b** — **Tooltips only** (no linear tutorial); reuses Q17d preview + Q28b ARIA infrastructure

### H. Accessibility
- **Q28b** — **Keyboard-navigable + ARIA labels + SR announcements**; Q25b result payloads map directly onto live-region announcements

### I. Visual / design
- **Q8a** — **Pixel/retro roguelike** aesthetic
- **Q12d** — **Hybrid assets**: provided raster **card faces** render every card (44 files in repo-root `assets/`, named `assets/<suit>-<value>.jpg`, 2:3 portrait); CSS + pixel font for HUD/UI; the **card back** and **title backdrop** (no art supplied) are CSS-generated
- **Q23c / Q44a / Q49b** — **Phased designer handoff**: Phase 1 = style guide + play screen + title (highest leverage, de-risks hardest screen); Phase 2 = stats, settings, win/lose scorecard. **Designer overlaps Phase 2 once the style guide is approved**; engineering implements Phase 1 in parallel.

### J. Testing
- **Q15a** — **Vitest** (unit: engine; integration: React Testing Library) + **Playwright** (e2e)
- **Q48a** — **Chromium-only in CI** (expandable to Firefox/WebKit later via one config line if real bugs surface)
- **Q24b** — CI: **install, lint, typecheck, unit+integration, Playwright e2e, build, deploy** on push to `main`; PRs run the same minus deploy, with **Playwright artifacts** (screenshots/traces) uploaded on failure

### K. Toolchain & deploy
- **Q27a** — **Strict TS + typescript-eslint (strict) + Prettier**
- **Q46a** — **npm** (`npm ci` in CI)
- **Q47a** — Scaffold via **`npm create vite@latest -- --template react-ts`**, then strip `App.tsx` boilerplate and add `engine/`/`ui/`/`store/`/`assets/`
- **Q20a / Q51c** — **GitHub Pages** deploy with **env-driven `base` path**: `process.env.BASE_URL ?? '/'`; CI sets `BASE_URL=/scoundrel/`. Hash router tolerates any base.

### L. Docs
- **Q39b** — **README** upgraded with overview, dev/test/deploy commands; `docs/rules.md` stays canonical; no separate architecture docs (contracts live in typed TS)

### M. Mechanical leftovers (no further input needed — handled by executor, not grill)
- `CardId` string format and 44-card definition table
- ESLint rule selection (strict preset)
- `mulberry32` implementation module
- Component folder layout under `src/ui/`

---

**The frontier is empty.** Every design branch visited, nothing silently assumed. The `docs/rules.md`-faithful-by-default + opt-in-toggles reconciliation, the engine/UI separation with selection-in-store, the final-room edge cases (Q52/Q53/Q54), and the Q40 custom weapon-stack layout all have explicit settlements.