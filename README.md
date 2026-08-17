# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Docs

- `docs/rules.md` — canonical rule set (source of truth for gameplay)
- `docs/spec.md` — implementation spec (what gets built)
- `docs/design-plan.md` — settled decisions (why it gets built that way)

## Development

```bash
npm install        # install dependencies
npm run dev        # start the dev server
npm run test       # unit + integration tests (Vitest)
npm run e2e        # end-to-end tests (Playwright, Chromium)
npm run lint       # eslint (typescript-eslint strict)
npm run typecheck  # tsc project references
npm run format     # prettier write
npm run build      # production build (BASE_URL env sets the base path)
npm run preview    # preview the production build
```

Card artwork lives in `src/assets/cards/` as 44 JPGs named `<suit>-<value>.jpg` (e.g. `club-a.jpg`, `heart-10.jpg`). A `CardId` doubles as its artwork filename stem.
