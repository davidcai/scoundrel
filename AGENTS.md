# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

See `README.md` for the project description. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — run all tests once
- `npm run test:watch` — watch mode
- `npm run typecheck` — TypeScript, no emit
- `npm run build` — typecheck then production build

`npm run dev` and `npm run build` do not work yet; both need `src/main.tsx`, which a later task adds.

Run `npm test` and `npm run typecheck` before considering any change complete.

## Project structure

- `docs/rules.md` — the official rule set (source of truth for gameplay)
- `README.md` — project description
- `docs/design/` — approved design specs
- `docs/plans/` — implementation plans
- `src/engine/` — pure rules engine (no React, no browser APIs, no display strings)
- `src/storage/` — localStorage and URL adapters
- `src/ui/` — React presentation layer, owns all user-visible strings