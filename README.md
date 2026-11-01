# Scoundrel

Scoundrel is a single-player roguelike dungeon-crawling card game. Players face monsters, equip weapons, and use potions as they work through a dungeon made from a standard deck.

This branch builds a fresh game release. The application foundation, approved title screen, and independent rules layer are implemented. The approved play screen is connected to the engine, including complete win/loss runs, saved progress, and statistics/history. The parent product branch must not be merged into `main`.

- [Game rules](docs/rules.md) describe the deck, room and combat rules, and scoring.
- [Product requirements](docs/prd.md) define the player experience, feature scope, and acceptance outcomes.
- [Design plan](docs/design-plan.md) describes presentation decisions and the design handoff sequence, referencing requirements in the PRD.
- [Card artwork](assets/) contains the current set of 44 PNG images.
- [Previous card artwork](assets-old/) preserves the earlier set of 44 JPEG images for reference.

Read [AGENTS.md](AGENTS.md) for agent guidance and [the implementation plan](docs/implementation-plan.md) for the proposed delivery sequence and decisions to settle before coding.

Review the [title and play-screen mockups](docs/mockups/README.md) for desktop and mobile visual proposals.

## Run the foundation

Use Node 22 and pnpm 11.7.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` runs typechecking, creates the production build, and checks artwork inventory and archive exclusion. `pnpm preview` serves the build; `pnpm format:check` verifies source formatting.

New Run starts a random seeded dungeon; Enter Seed and versioned replay links start a reproducible one. Play uses current card artwork with previews, separate confirmations, equipment, potion feedback, room progression, escape, and room undo. Results show scores and highlights, allow replay, and expose a copyable replay link.

Progress, room undo, preferences, statistics, and the newest 50 completed runs are saved in this browser. Reloading an unfinished run returns to the title; Continue restores it. Menu and closing the page preserve the run. Starting a new run, entering a valid seed, or replaying history asks for confirmation when a run is active. Confirming replaces it and records one abandoned loss; Cancel or Escape preserves it. Fresh shared links start immediately. Stats shows lifetime totals and recent runs, with replay using each run's original rules. Completed result screens survive reload without recounting the outcome.

Progress is saved automatically without a routine status message; gameplay omits the footer. If saving fails, keep the tab open and use Retry saving. A stale tab cannot overwrite another tab's progress; Reload saved game opens the latest saved run. Saves belong to this browser and site address, including its port. Corrupt or unsupported saves are preserved while unsaved play remains available. See [the persistence contract](docs/persistence-contract.md).

All 44 current illustrations are available to the game; archived artwork is excluded from the build. Run `pnpm test` for engine/session and save-envelope tests. The [rules-layer contract](docs/engine-contract.md) defines the API and versioned seed/replay behavior.

For production browser checks:

```sh
pnpm exec playwright install chromium
pnpm build
pnpm e2e
```

Browser tests cover real seeded win/loss runs, previews and undo, carryover and escape, seed validation, keyboard selection, English/Chinese layouts, save/resume, durable preferences, statistics/history, simultaneous tabs, and save-failure recovery. No state is injected into the app to reach results.
