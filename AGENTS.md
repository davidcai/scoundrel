# Scoundrel agent instructions

## Base instructions for DeepSeek Harness

### Workflow

1. Identify the package manager and existing conventions from repository files; do not assume them.
2. Inspect only relevant files; use a subagent for bounded cross-file searches when needed.
3. Write acceptance criteria and a short plan before nontrivial edits.
4. Make the smallest safe change; follow existing architecture and conventions.
5. Run targeted checks, then broader checks when justified.
6. For failures, capture error evidence, isolate root cause, retry no more than twice without new evidence.
7. Request an independent diff review on nontrivial changes.
8. Report files changed, tests actually run, outcomes, and unresolved risks.

### Guardrails

- Never claim a command passed unless its output was observed.
- Never commit, reset, clean, delete, install packages, or modify lockfiles without need and approval when destructive or unexpected.
- Never expose secrets, `.env` values, or credentials to agents or logs.
- Subagents used for research or review must have read-only tool permissions enforced by the harness; prompts alone are not security controls.
- Subagents: depth 1, maximum 2 active; do not delegate trivial tasks.

## Scoundrel project guidance

### Read before working

Read [the PRD](docs/prd.md), [the game rules](docs/rules.md), [the design plan](docs/design-plan.md), and [the implementation plan](docs/implementation-plan.md), and check [development progress](docs/progress.md) for the current phase before working. The PRD owns product requirements, decisions, open questions, and research findings; the rules own default gameplay and scoring; the design plan owns presentation; the implementation plan owns delivery order and technical boundaries. Reference PRD IDs when planning, implementing, or reviewing work. Keep IDs and their anchors stable.

### Phase and scope

- Implementation was authorized by the user on 2026-11-01. Build phases 1–5 per the [implementation plan](docs/implementation-plan.md#delivery-plan); Phase 1 owns foundation decisions, the minimal app, and verification tooling. Deployment, merging into `main`, and opening a merge request remain separately unauthorized. The [development progress](docs/progress.md) record tracks the current phase and next actions.
- Treat this as a fresh release. Define this product's own save, preference, seed, and replay-link formats; data import and compatibility with other products are out of scope. See [DEC-003](docs/prd.md#dec-003).
- Hosting is settled in the [implementation plan](docs/implementation-plan.md); the hosting choice alone does not authorize deployment.
- The parent product branch is standalone and must not be merged into `main`. Do not merge or open a merge request for this branch without explicit instructions.

### Working rules

- Resolve gameplay ambiguities against the canonical documents before encoding them, and record approved clarifications in the owning document.
- Update [development progress](docs/progress.md) when a phase starts, completes, or its status changes.
- Keep game rules independent of presentation and saved-data handling; use one source for previews and confirmed outcomes.
- Follow the approved [design plan](docs/design-plan.md) for card artwork and presentation; use the current PNG artwork only, never the archived JPEG set. The style guide was approved on 2026-11-01; changes require a new recorded approval.
- Follow [REQ-016](docs/prd.md#req-016) and [REQ-017](docs/prd.md#req-017) for browser and accessibility targets, plus the verification expectations in the [implementation plan](docs/implementation-plan.md).
- Verify changes with checks appropriate to the work: for documents, links, PRD references, and requirement coverage; for code, the relevant behavioral checks before claiming it works.
- When creating a branch and worktree, use a `codex/` branch name unless the user specifies another prefix, and place the worktree at `.worktrees/<kebab-cased-branch-name>`.

### Commands

Run these from the repository root with pnpm 11.7.0 and Node.js 22.13 or later (pinned in `package.json`):

- `pnpm install` — install the exact pinned dependencies from `pnpm-lock.yaml`.
- `pnpm dev` — start the Vite development server.
- `pnpm build` — type-check and build the production bundle into `dist/`.
- `pnpm preview` — serve the production build locally.
- `pnpm lint` — run ESLint.
- `pnpm format` / `pnpm format:check` — write / check Prettier formatting.
- `pnpm typecheck` — run the TypeScript no-emit check.
- `pnpm test` — run the Vitest suite in jsdom.

If `pnpm install` resolves projects outside this worktree, pass `--ignore-workspace`; this checkout is nested under a parent pnpm workspace in the current environment.

