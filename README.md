# Scoundrel

Scoundrel is a single-player roguelike dungeon-crawling card game. Players face monsters, equip weapons, and use potions as they work through a dungeon made from a standard deck.

This branch builds a fresh game release. Phase 1 adds a minimal Vite + React + TypeScript application that presents the approved warm visual direction and a current-artwork card; gameplay is not implemented yet. The parent product branch must not be merged into `main`.

## Development

Use pnpm 11.7.0 and Node.js 22.13 or later (both pinned in `package.json`).

```sh
pnpm install
pnpm dev        # Vite dev server
pnpm build      # type-check and production build
pnpm preview    # serve the production build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test       # Vitest + Testing Library in jsdom
```

Application artwork comes only from [assets/](assets/), the current set of 44 PNG images. [Previous card artwork](assets-old/) preserves the earlier JPEG set for reference only; the application must never load or bundle it.

## Documentation

- [Game rules](docs/rules.md) describe the deck, room and combat rules, and scoring.
- [Product requirements](docs/prd.md) define the player experience, feature scope, and acceptance outcomes.
- [Design plan](docs/design-plan.md) describes presentation decisions and the design handoff sequence, referencing requirements in the PRD.
- [Development progress](docs/progress.md) tracks phase status, completed work, and next actions.
- [Implementation plan](docs/implementation-plan.md) owns delivery order, foundation decisions, and technical boundaries.

Read [AGENTS.md](AGENTS.md) for agent guidance.
