# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

See `README.md` for the project description. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Commands

The toolchain is Vite + React + TypeScript with Vitest for tests and ESLint (flat config) for linting.

- `npm run dev` — start the Vite dev server.
- `npm run build` — `tsc -b` then `vite build` (type-check + production bundle into `dist/`).
- `npm run preview` — serve the production build.
- `npm test` — run the Vitest suite once; `npm run test:watch` for watch mode.
- `npm run typecheck` — `tsc --noEmit` (run after non-trivial changes).
- `npm run lint` — eslint over `src` and `tests`; `npm run lint:fix` to auto-fix.

Always run `npm run typecheck`, `npm test`, and `npm run lint` before considering a task done.

## Project structure

- `src/game/` — pure, unit-tested game logic (`types`, `constants`, `rng`, `deck`, `rules`, `engine`). The `engine` reducer is the single source of truth for gameplay behavior; the React layer is a thin view over it.
- `src/hooks/useGame.ts` — `useReducer` wrapper with action creators.
- `src/components/` — UI components (`CardView` renders SVG pip cards).
- `tests/` — Vitest unit tests for `deck`, `rules`, and `engine`.
- `docs/rules.md` — the official rule set (source of truth for gameplay).