# Guidance for AI agents

## Read before working

Read [the PRD](docs/prd.md), [the game rules](docs/rules.md), and [the design plan](docs/design-plan.md). The PRD owns product scope and numbered requirements; the rules own default gameplay and scoring; the design plan owns presentation choices. Reference PRD IDs when planning, implementing, or reviewing work. Keep IDs and their anchors stable.

## Artwork

Use the 44 PNG card images in [assets/](assets/) for the game's artwork. Preserve their suit-and-rank filenames. The JPEG images in [assets-old/](assets-old/) are archived references only. Do not load, bundle, copy, or use them as fallback artwork in the game unless the user explicitly requests it.

## Current phase: implementation started

The user authorized implementation on November 1, 2026. Follow [the implementation plan](docs/implementation-plan.md). The foundation, independent rules layer, playable UI, and save/resume plus statistics/history are implemented. The rules-layer contract is in [docs/engine-contract.md](docs/engine-contract.md); persistence behavior and format are in [docs/persistence-contract.md](docs/persistence-contract.md). Product readiness verification is next. Keep unfinished actions disabled rather than simulating behavior.

Static HTML/CSS design documents and PNG previews under `docs/mockups/` remain design references. Keep them distinct from runtime code under `src/`.

The parent product branch is standalone and must not be merged into `main`. Do not merge or open a merge request for this planning branch without explicit instructions.

## Release scope

Treat this as a fresh game release. Define its save, preference, seed, and replay-link formats without data-import or compatibility work. Follow [DEC-003](docs/prd.md#dec-003). Escape is allowed only before the first card in a room is resolved, including when consecutive escapes are allowed.

Initial hosting is Vercel. Follow the hosting verification in [the implementation plan](docs/implementation-plan.md). Hosting selection alone does not authorize deployment.

## Future implementation work

- Resolve gameplay ambiguities against the canonical documents before encoding them. Record approved clarifications in the owning document.
- Keep game rules independent of presentation and saved-data handling. Use one source for previews and confirmed outcomes.
- Target modern browsers, especially Chromium-based browsers and Safari. Include keyboard navigation, semantic controls, descriptive labels, visible focus, touch, language, and reduced-motion behavior in relevant features. Extensive accessibility work is lower priority for the initial release; do not introduce formal audits or comprehensive screen-reader testing as release gates.
- Verify changes with checks appropriate to the work. For documents, check links, PRD references, and requirement coverage; for future code, run the relevant behavioral checks before claiming it works.
- When creating a branch and worktree, use a `codex/` branch name and place the worktree at `.worktrees/<kebab-cased-branch-name>`.

## Commands

Use Node 22 (`.nvmrc`) and pnpm 11.7.0. This worktree has its own pnpm workspace and lockfile; run commands from its project root.

- `pnpm install --frozen-lockfile` installs the locked dependencies.
- `pnpm lint` runs ESLint with zero warnings allowed.
- `pnpm typecheck` checks TypeScript without emitting files.
- `pnpm test` runs engine, session, and persistence-envelope behavioral tests; `pnpm test:watch` watches it.
- `pnpm dev` starts the local development server.
- `pnpm build` typechecks, builds `dist/`, and verifies the artwork inventory and archive exclusion.
- `pnpm preview` serves the production build locally.
- After `pnpm build`, `pnpm e2e` verifies the playable UI in Chromium. Install its browser with `pnpm exec playwright install chromium`; an existing executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- `pnpm format:check` verifies source formatting; `pnpm format` writes formatting fixes.
