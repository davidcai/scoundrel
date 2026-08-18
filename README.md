# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Docs

- `docs/rules.md` — canonical rule set (source of truth for gameplay)
- `docs/spec.md` — implementation spec (what gets built)
- `docs/design-plan.md` — settled decisions (why it gets built that way)

## Development

```bash
pnpm install       # install dependencies
pnpm run dev       # start the dev server → http://localhost:5173
pnpm run test      # unit + integration tests (Vitest)
pnpm run e2e       # end-to-end tests (Playwright, Chromium)
pnpm run lint      # eslint (typescript-eslint strict)
pnpm run typecheck # tsc project references
pnpm run format    # prettier write
pnpm run build     # production build (BASE_URL env sets the base path)
pnpm run preview   # preview the production build
```

Card artwork lives in `src/assets/cards/` as 44 JPGs named `<suit>-<value>.jpg` (e.g. `club-a.jpg`, `heart-10.jpg`). A `CardId` doubles as its artwork filename stem.
