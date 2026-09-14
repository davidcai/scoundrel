# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck, implemented as a web app (Phaser 3 + Vite + TypeScript, rendered to a single canvas). The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior; `docs/spec.md` is the implementation spec this app realizes.

## The game

Crawl a dungeon of 44 cards: clubs and spades are monsters, diamonds are weapons, hearts are potions. Each room deals 4 cards — resolve 3, carry the 4th. Defeat every room to win; your score is your remaining health.

## Commands

```sh
pnpm install          # set up
pnpm dev              # dev server
pnpm build            # typecheck + production build (dist/)
pnpm preview          # serve the production build
pnpm lint             # ESLint
pnpm format           # Prettier (write); pnpm format:check to verify
pnpm typecheck        # tsc -b
pnpm test             # Vitest: engine unit + store unit + view-model unit tests
pnpm e2e              # Playwright e2e (run `pnpm build` first; serves dist/)
```

## Architecture

- `src/engine/` — the pure TypeScript game engine: deck composition, mulberry32 seeded RNG, the reducer `(state, action) → { state, result }`, combat/weapon-degradation/potion/run-away rules, win/lose and scoring. Zero UI-framework imports, zero DOM — runs in Node.
- `src/store/` — Zustand store wiring the engine to the UI, with transient card-selection UI state (kept out of engine truth), sharded versioned localStorage persistence (`scoundrel:settings`, `scoundrel:stats`, `scoundrel:run`), idempotent stats writes, and shareable run URL encoding (`#/play?seed=...&config=...`).
- `src/game/` — the Phaser 3 canvas UI (1280×720 design resolution, `Scale.FIT`): scenes (title, play, game-over overlay, stats, settings, about) swapped by a hash-route `RouteController`, card/button/tooltip/toast/dialog widgets, pure view-models (action-panel previews, unit-tested), theme constants, and a `?debug`-gated `window.__SCOUNDREL__ = { game, store, worldToScreen }` handle for debugging and e2e.
- `src/i18n/` — typesafe-i18n dictionaries (`en.ts`, `zh.ts`) and typed translation setup; `src/i18n.ts` adds the zustand language store and `t()` helpers.
- `assets/` — the 44 card artwork JPEGs; doubles as the Vite public dir (served at `/<suit>-<rank>.jpg`).
- `e2e/` — Playwright black-box tests; seeded URLs (`#/play?seed=...`) make runs fully deterministic, and the canvas is driven via the `?debug` handle.

## Accessibility

The original React build shipped ARIA roles/labels on cards, DOM focus semantics, and focus-triggered tooltips; the Phaser port drops those — the canvas has no accessibility tree (a documented regression of this experiment). Keyboard play is preserved (arrow keys rove card focus, Home/End jump, Enter acts, Escape closes), and an off-screen DOM live region announces results to screen readers. `cardAriaLabel` is kept in `src/i18n.ts`, so reversing the regression stays cheap.

## Bundle size

Phaser is a big dependency: the vendor chunk is ~1.1 MB min / ~350 KB gzip, about 8× the old React bundle (split out of the app chunk via Vite `manualChunks`).

## Rule house-rule toggles

Settings exposes three toggles (run-away restriction, potions per room, weapon degradation). Defaults follow `docs/rules.md` exactly.

## Deploy

Deploys via Vercel (previews on PRs, production from `main`). The Vite build reads the base path from the environment (`vite.config.ts`), and the hash router tolerates any base.
