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
- `src/store/` — Zustand store, sharded versioned localStorage persistence (`scoundrel:settings`/`stats`/`run`), stats aggregation, shareable replay URLs. Every action publishes its reducer result on a `lastResult` channel that the renderer consumes as its animation cue sheet.
- `src/game/` — Phaser 4 renderer for the play screen's game table (static layout + hand-authored tweens; reacts to the store via `store-bridge`, routes sprite input to `selectCard`). Loaded ONLY through a dynamic import so Phaser stays off the other routes and out of RTL-tested import chains.
- `src/ui/` — React screens and DOM overlay around the canvas: Hud, ActionPanel, CardSelectionControl (keyboard card selection), WeaponReadout (weapon/kill-stack information), RoomMirror (aria-hidden room seam used by e2e), CardHoverLayer. Transient card-selection lives in the store, never in engine state; the win/lose handoff is gated on the canvas flourish (fail-open timeout in PlayScreen).
- `assets/` — the 44 card artwork JPEGs (bundled via `import.meta.glob` in `src/ui/card-image.ts`; consumed by both the DOM `CardView` and the Phaser texture loader).
- `tests/` — store unit tests + RTL integration tests (`tests/phaser-play.test.tsx` covers the play screen by stubbing the `src/game` entry; no Phaser under jsdom). Engine tests live next to the code in `src/engine/`.
- `e2e/` — Playwright black-box tests (seeded URLs make runs deterministic; input goes through the DOM room mirror, assertions on the DOM overlay).
- `docs/phaser-plan.md` — the (implemented) integration plan for the Phaser layer.

## Conventions

- When creating a GIT branch and its worktree, create the worktree at `.worktrees/<kebab-cased-branch-name>`.
- File naming: React component files and their test files use CapitalCamelCase (e.g. `CardView.tsx`); everything else uses kebab-case (lower-dash-case).
- i18n: powered by typesafe-i18n. Message text lives in the `en`/`zh` dictionaries in `src/i18n/`; `src/i18n.ts` exposes the zustand language store and `useT()`/`t()` helpers. Other files reference messages by `MessageKey`, never inline display strings.
- Engine code must stay pure and React-free; all randomness is resolved in `createInitialState` so the reducer is deterministic given `(state, action)`.
- CardId format is `${suit}-${rank}` matching the artwork filenames (`club-8.jpg`).
- Shareable run URLs: `#/play?seed=...&config=...` (`src/store/share.ts`).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit+integration, and e2e (build first — `vite preview` serves `dist/`). Deployment is handled by Vercel (previews on PRs, production from `main`); the Vite build reads the base path from `BASE_URL` (`vite.config.ts`, default `/`) and the hash router tolerates any base.
