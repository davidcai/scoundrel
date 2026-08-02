# AGENTS.md

Guidance for AI coding agents working in this repo.

## Project

See `README.md` for the project description. The full rule set lives in `docs/rules.md` and
is the source of truth for gameplay behavior. `README.md` records the interpretations made
where the rules are silent — extend that list rather than deciding an edge case twice.

## Commands

```bash
npm install         # first run
npm run dev         # dev server
npm test            # rules test suite
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production bundle
```

## Project structure

- `docs/rules.md` — the official rule set (source of truth for gameplay)
- `src/game/` — the rules engine: pure, DOM-free, unit-tested
  - `cards.ts` — the 44-card deck, suits, card values
  - `rng.ts` — seeded PRNG and shuffle
  - `engine.ts` — `GameState`, `applyAction`, `isLegal`
- `src/ui/` — rendering only; no rules logic
- `src/main.ts` — state holder and dispatch loop
- `tests/` — engine tests

## Conventions

- **Rules belong in `src/game/`, never in `src/ui/`.** The UI renders a `GameState` and
  dispatches actions; it must not decide outcomes. It asks `isLegal` rather than
  re-deriving whether a move is allowed.
- **Quote the rule you are implementing.** Each rule in `engine.ts` carries the sentence
  from `docs/rules.md` it encodes, so behavior can be traced back to the text.
- **State transitions are pure.** `applyAction` returns a new `GameState`; nothing mutates
  in place. This is what keeps the rules testable without a DOM.
- **Shuffles go through the seeded RNG** so a dungeon is reproducible from its seed. Do not
  call `Math.random()` in game code.
- Add a test in `tests/engine.test.ts` for any rule change; `tests/helpers.ts` builds exact
  states via `stateWith(...)` and looks up cards by id (`card('s14')` is the Ace of Spades).
