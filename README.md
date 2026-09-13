# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck, implemented as a web app. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior; `docs/spec.md` is the implementation spec this app realizes.

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
pnpm test             # Vitest: engine unit + RTL integration tests
pnpm e2e              # Playwright e2e (run `pnpm build` first; serves dist/)
```

## Architecture

- `src/engine/` — the pure TypeScript game engine: deck composition, mulberry32 seeded RNG, the reducer `(state, action) → { state, result }`, combat/weapon-degradation/potion/run-away rules, win/lose and scoring. Zero React, zero DOM — runs in Node.
- `src/store/` — Zustand store wiring the engine to React, with transient card-selection UI state (kept out of engine truth), sharded versioned localStorage persistence (`scoundrel:settings`, `scoundrel:stats`, `scoundrel:run`), idempotent stats writes, and shareable run URL encoding (`#/play?seed=...&config=...`).
- `src/ui/` — screens (title, play, stats, settings, about), card/HUD/weapon-stack components, ARIA live-region announcer and tooltips.
- `src/i18n/` — typesafe-i18n dictionaries (`en.ts`, `zh.ts`) and typed translation setup; `src/i18n.ts` adds the zustand language store and `useT()`/`t()` helpers.
- `assets/` — the 44 card artwork JPEGs; doubles as the Vite public dir (served at `/<suit>-<rank>.jpg`).
- `e2e/` — Playwright black-box tests; seeded URLs (`#/play?seed=...`) make runs fully deterministic.

## Rule house-rule toggles

Settings exposes three toggles (run-away restriction, potions per room, weapon degradation). Defaults follow `docs/rules.md` exactly.

## Deploy

Deploys to GitHub Pages from `main` via CI with `BASE_URL=/scoundrel/`. The Vite build reads the base path from the environment (`vite.config.ts`), and the hash router tolerates any base.
