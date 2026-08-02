# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

This repo contains a playable web implementation (Vite + React + TypeScript) plus a pure, unit-tested game engine.

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and build for production into dist/
npm run preview  # serve the production build locally
```

## Testing & quality

```bash
npm test         # run the Vitest suite once
npm run test:watch   # run tests in watch mode
npm run typecheck    # tsc --noEmit
npm run lint        # eslint
```

## How to play

See `docs/rules.md` for the official rules. In short:

- **Clubs / Spades** are monsters whose damage equals their value (J=11, Q=12, K=13, A=14).
- **Diamonds** are weapons (value 2–10). A weapon deals `max(0, monster − weapon)` damage; after a kill it can only fight a strictly weaker monster. Equipping a new weapon discards the old one.
- **Hearts** are potions (value 2–10). Only the first potion each room heals; extras fizzle but still count as a resolve.
- Each room deals 4 cards; resolve 3, and the leftover carries into the next room. You may flee once per room (never twice in a row).
- Clear the whole dungeon to **win** (score = remaining health, capped at 20). Drop to 0 health and you **lose** (score = − remaining monster values in the draw pile).

## Project structure

- `src/game/` — pure game logic: `types`, `constants`, `rng`, `deck`, `rules`, and the `engine` reducer (source of truth for behavior, fully unit-tested).
- `src/hooks/useGame.ts` — `useReducer` wrapper exposing state and action creators.
- `src/components/` — React UI (`CardView` renders SVG pip cards; `Room`, `WeaponPanel`, `HealthBar`, `DeckIndicator`, `ActionBar`, `Log`, `GameOver`).
- `src/styles/app.css` — styling.
- `tests/` — Vitest unit tests for `deck`, `rules`, and `engine`.
- `docs/rules.md` — the official rule set (source of truth for gameplay).