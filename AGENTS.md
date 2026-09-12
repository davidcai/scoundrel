# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

Scoundrel — a 1-player roguelike dungeon-crawling card game, implemented as a web app. See `README.md` for the project overview. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior; `docs/spec.md` is the implementation spec the app realizes.

## Commands

pnpm is the package manager; run `pnpm install` to set up.

```sh
pnpm dev          # dev server
pnpm build        # typecheck + production build (dist/)
pnpm preview      # serve the production build
pnpm lint         # ESLint
pnpm format       # Prettier (write); pnpm format:check to verify
pnpm typecheck    # tsc -b
pnpm test         # Vitest: engine unit + RTL integration tests
pnpm e2e          # Playwright e2e — run `pnpm build` first (serves dist/)
```

## Architecture

- `src/engine/` — pure TypeScript game engine (deck, seeded RNG, reducer `(state, action) → { state, result }`, all rules, scoring). Zero React, zero DOM; Node-testable.
- `src/store/` — Zustand store, sharded versioned localStorage persistence (`scoundrel:settings`/`stats`/`run`), stats aggregation, shareable replay URLs.
- `src/ui/` — React screens and components. Transient card-selection lives in the store, never in engine state.
- `assets/` — the 44 card artwork JPEGs (bundled via `import.meta.glob` in `src/ui/cardImage.ts`).
- `tests/` — store unit tests + RTL integration tests. Engine tests live next to the code in `src/engine/`.
- `e2e/` — Playwright black-box tests (seeded URLs make runs deterministic).

## Conventions

- Engine code must stay pure and React-free; all randomness is resolved in `createInitialState` so the reducer is deterministic given `(state, action)`.
- CardId format is `${suit}-${rank}` matching the artwork filenames (`club-8.jpg`).
- Shareable run URLs: `#/play?seed=...&config=...` (`src/store/share.ts`).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit+integration, e2e (build first — `vite preview` serves `dist/`), then deploys `main` to GitHub Pages with `BASE_URL=/scoundrel/`.
