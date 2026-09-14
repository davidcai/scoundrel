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
pnpm test         # Vitest: engine unit + store unit + view-model unit tests
pnpm e2e          # Playwright e2e — run `pnpm build` first (serves dist/)
```

## Architecture

- `src/engine/` — pure TypeScript game engine (deck, seeded RNG, reducer `(state, action) → { state, result }`, all rules, scoring). Zero UI-framework imports, zero DOM; Node-testable.
- `src/store/` — Zustand store, sharded versioned localStorage persistence (`scoundrel:settings`/`stats`/`run`), stats aggregation, shareable replay URLs.
- `src/game/` — Phaser 3 canvas UI (1280×720, `Scale.FIT`): `scenes/` (Boot/Title/Play/GameOver overlay/Stats/Settings/About), `widgets/`, pure `view-models/`, `theme.ts`, `router.ts` (hash routes → scene swaps), `debug.ts` (`?debug`-gated `window.__SCOUNDREL__` handle), `live-region.ts` (off-screen DOM announcements). Transient card-selection lives in the store, never in engine state.
- `assets/` — the 44 card artwork JPEGs (bundled via `import.meta.glob` in `src/game/card-image.ts`).
- `tests/` — store unit tests. Engine tests live next to the code in `src/engine/`; view-model tests in `src/game/view-models/`. No component-render tests (the UI is canvas).
- `e2e/` — Playwright black-box tests (seeded URLs make runs deterministic); drives the Phaser canvas via the `?debug` handle.

## Conventions

- File naming: scene/widget/view-model files and their test files use CapitalCamelCase (e.g. `CardSprite.ts`); everything else uses kebab-case (lower-dash-case).
- i18n: powered by typesafe-i18n. Message text lives in the `en`/`zh` dictionaries in `src/i18n/`; `src/i18n.ts` exposes the zustand language store and `t()` helpers. Other files reference messages by `MessageKey`, never inline display strings.
- Engine code must stay pure and UI-framework-free; all randomness is resolved in `createInitialState` so the reducer is deterministic given `(state, action)`. View-models under `src/game/view-models/` are likewise pure (no Phaser imports).
- CardId format is `${suit}-${rank}` matching the artwork filenames (`club-8.jpg`).
- Shareable run URLs: `#/play?seed=...&config=...` (`src/store/share.ts`).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit+integration, and e2e (build first — `vite preview` serves `dist/`). Deployment is handled by Vercel (previews on PRs, production from `main`); the Vite build reads the base path from `BASE_URL` (`vite.config.ts`, default `/`) and the hash router tolerates any base.
