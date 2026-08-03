# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

See `README.md` for the project description. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Commands

- `npm install` — install dev dependencies (Vite, Vitest, TypeScript; no runtime deps)
- `npm run dev` — start the Vite dev server (http://localhost:5173)
- `npm test` — run the Vitest suite once
- `npm run test:watch` — run tests in watch mode
- `npm run build` — type-check (`tsc`) and build for production into `dist/`
- `npm run preview` — serve the production build locally

## Project structure

- `docs/rules.md` — the official rule set (source of truth for gameplay)
- `README.md` — project description
- `index.html` — Vite entry point
- `src/game.ts` — game engine: pure state + rules, no DOM
- `src/game.test.ts` — engine tests (Vitest)
- `src/main.ts` — browser UI: renders state, forwards clicks to engine actions
- `src/style.css` — styling

## Conventions

- All gameplay logic lives in `src/game.ts` and must stay DOM-free so it can be tested headlessly. `src/main.ts` only renders state and dispatches engine actions.
- Any rule change starts from `docs/rules.md`; update or add a test in `src/game.test.ts` alongside engine changes.
- Games are seeded (`newGame(seed)`); the UI keeps the seed in the URL hash (`#seed=...`) so a dungeon can be replayed.
