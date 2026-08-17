# Scoundrel card game

Scoundrel is a 1-player roguelike dungeon-crawling card game played with a standard 44-card deck. This repo is a pixel/retro web implementation: React + Vite + TypeScript on top of a pure, deterministic game engine.

The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior. `docs/spec.md` records the implementation decisions; `docs/design-plan.md` records why each was made.

## Features

- Faithful canonical rules out of the box, with three house-rule toggles (run-away restriction, potions per room, weapon degradation)
- Pure TypeScript engine (zero React/DOM) with a `(state, action) → { state, result }` reducer
- Seedable, shareable runs: `#/play?seed=...&runAway=...&potions=...&degrade=...`
- Per-room undo, save/resume, and a stats dashboard with bounded run history + replay
- Card faces use the provided raster artwork in `assets/` (`assets/<suit>-<value>.jpg`)
- Keyboard-navigable with ARIA labels and a live-region announcer

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm test           # run unit + integration tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm run e2e        # Playwright end-to-end tests (requires `npx playwright install`)
```

## Structure

```text
assets/              44 provided card-face JPEGs (one per deck card)
docs/                rules.md (canonical), spec.md, design-plan.md
src/engine/          pure TS engine: deck, mulberry32 RNG, reducer, scoring
src/store/           Zustand store, persistence adapters, stats, config codec
src/ui/              React screens, components, hash router, card-art loader, theme
e2e/                 Playwright smoke tests
```

The engine is deterministic given a seed (`mulberry32`), so any run can be replayed exactly from its seed and config.
