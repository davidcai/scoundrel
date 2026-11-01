# Guidance for AI agents

## Read before working

Read [the PRD](docs/prd.md), [the game rules](docs/rules.md), and [the design plan](docs/design-plan.md). The PRD owns product scope and numbered requirements; the rules own default gameplay and scoring; the design plan owns presentation choices. Reference PRD IDs when planning, implementing, or reviewing work. Keep IDs and their anchors stable.

## Artwork

Use the 44 PNG card images in [assets/](assets/) for the game's artwork. Preserve their suit-and-rank filenames. The JPEG images in [assets-old/](assets-old/) are archived references only. Do not load, bundle, copy, or use them as fallback artwork in the game unless the user explicitly requests it.

## Current phase: planning only

Follow [the implementation plan](docs/implementation-plan.md). For now, create and revise planning documents only. Do not scaffold an application, add dependencies, create source files or executable test code. Begin implementation only after the user explicitly asks to proceed.

The parent product branch is standalone and must not be merged into `main`. Do not merge or open a merge request for this planning branch without explicit instructions.

## Release scope

Treat this as a fresh game release. Define its save, preference, seed, and replay-link formats without data-import or compatibility work. Follow [DEC-003](docs/prd.md#dec-003). Escape is allowed only before the first card in a room is resolved, including when consecutive escapes are allowed.

## Future implementation work

- Resolve gameplay ambiguities against the canonical documents before encoding them. Record approved clarifications in the owning document.
- Keep game rules independent of presentation and saved-data handling. Use one source for previews and confirmed outcomes.
- Include keyboard, screen-reader, touch, language, and reduced-motion behavior in each relevant feature rather than adding them only at the end.
- Verify changes with checks appropriate to the work. For documents, check links, PRD references, and requirement coverage; for future code, run the relevant behavioral checks before claiming it works.
- When creating a branch and worktree, use a `codex/` branch name and place the worktree at `.worktrees/<kebab-cased-branch-name>`.
