# Scoundrel implementation plan

## Plan scope and boundaries

This plan proposes how to build the product and does not claim any build, test, performance, or deployment result. Current phase, status, and next actions are tracked in [progress.md](progress.md).

The [PRD](prd.md#info-002) owns product requirements, decisions, open questions, research findings, and acceptance outcomes. The [rules](rules.md) own default gameplay and scoring; the [design plan](design-plan.md) owns presentation choices. This document owns delivery order, technical boundaries, and verification. Reference PRD items rather than restating them, resolve contradictions in the owning document, and keep links, PRD references, and requirement coverage valid when editing these documents.

Follow the [design plan](design-plan.md) for the card artwork rules, including which artwork sets may appear in application outputs.

## Approved implementation approach

Use TypeScript, React, and Vite, with an independent, pure game-rules layer and an accessible HTML-based interface. This implementation approach is approved. Select supported dependency versions when implementation begins.

Use regular HTML elements for cards, controls, labels, and contextual help in the first playable version. They suit the turn-based board and keep input, screen-reader access, responsive layout, and translated text together. A canvas renderer is outside the approved initial approach; revisit only if a later product decision justifies it. Motion is presentation feedback, not the authority for game state.

| Proposed area | Responsibility | Boundary |
| --- | --- | --- |
| `src/engine/` | Deck composition, seeded ordering, legal actions, previews, room progression, combat, undo, results, and scoring | No interface, browser storage, or presentation dependencies |
| `src/store/` | Active run, application preferences, saved progress, aggregate statistics, history, and replay links | Keep transient selection separate from saved game truth |
| `src/ui/` | Screens, card table, previews, confirmations, contextual help, focus, and announcements | Read rules-derived state; do not reimplement combat or action eligibility |
| `src/i18n/` | English and Simplified Chinese display messages | Translate controls, help, result feedback, and accessible descriptions together |
| `assets/` | Current card illustrations | Load only the expected 44 PNGs, preserving filenames |

Choose a state-management library only if the initial vertical slice needs it. The boundary matters more than the library. Plan rules operations around current game state plus a requested action producing a new state and a descriptive outcome. Preview and confirmation must use the same rule decisions. Resolve all random ordering from the run's seed so reproducing a dungeon does not depend on rendering or input timing.

## Foundation decisions (recorded 2026-11-01)

Phase 1 records these implementation decisions. They choose tooling and formats; they do not change product requirements or authorize deployment.

| Area | Decision |
| --- | --- |
| Package manager | pnpm 11.7.0, fixed by the `packageManager` field in `package.json`. Install and run scripts with pnpm; do not mix package managers in one lockfile. |
| Node.js target | Node.js 22 LTS (>= 22.13.0) for the runtime and CI, fixed by `engines` in `package.json`. CI installs the current 22.x release; newer Node.js versions may be used locally but are not the support target. |
| Dependency versions | Exact versions, no range specifiers, locked by `pnpm-lock.yaml`: React and React DOM 19.3.1; Vite 8.3.5 with `@vitejs/plugin-react` 6.1.2; TypeScript 5.9.3; ESLint 10.14.0 with `@eslint/js` 10.0.1, `typescript-eslint` 8.72.1, `eslint-plugin-react-hooks` 7.1.1, and `eslint-plugin-react-refresh` 0.5.7, and `globals` 17.13.0; Prettier 3.9.10; Vitest 5.0.5 with jsdom 30.1.3, Testing Library React 16.3.3, Testing Library DOM 10.4.2, and jest-dom 7.0.1; `@types/node` 22.20.5, `@types/react` 19.3.0, and `@types/react-dom` 19.3.0. Playwright is deliberately not installed in Phase 1; browser automation is added when Phase 3/5 verification needs it. |
| Asset inventory | The only application artwork is the 44 PNGs in `assets/`, each 1024×1536 px (2:3), named `<suit>-<rank>.png` with lowercase rank letters. Clubs and spades each contribute A, 2–10, J, Q, K (13 each, 26 monsters); diamonds contribute 2–10 (9 weapons); hearts contribute 2–10 (9 potions). No file from `assets-old/` may be loaded, bundled, copied, or referenced as a fallback. |
| Seed format | A run's seed is a trimmed, NFC-normalized, case-sensitive Unicode string of 1–64 characters. The seed is displayed in mono text and URL-encoded in replay links. A new run without an entered seed generates 16 lowercase hexadecimal characters (64 bits) with `crypto.getRandomValues`; that generated value becomes the run's seed for history and replay. |
| Deterministic ordering | Hash the seed's UTF-8 bytes with 32-bit FNV-1a to obtain a uint32 seed, then generate the deck order with mulberry32. Shuffle the canonical deck order (clubs A–K, spades A–K, diamonds 2–10, hearts 2–10) with a Fisher–Yates pass from the last index down, selecting `Math.floor(next() * (i + 1))`. No `Math.random` may affect a run; previews and confirmed outcomes use the same ordered deck. |
| Replay-link shape | Hash routing keeps every route on `index.html`, so hosted refreshes never need server rewrites. Play routes have the shape `#/play?seed=<seed>&config=<hex>`. A replay link always carries both values; entering a seed manually without `config` uses the player's currently selected rule options, per [REQ-014](prd.md#req-014). Invalid seed or link values are explained without replacing the active run or statistics. |
| Rule-option encoding | The three house rules in [REQ-011](prd.md#req-011) are a 3-bit mask written as one lowercase hexadecimal digit, `config=0` through `config=7`. Bit 0 (value 1) allows running away from consecutive rooms; bit 1 (value 2) allows unlimited healing potions per room; bit 2 (value 4) turns weapon degradation off. Defaults are `config=0`; invalid masks are rejected as invalid links. |
| Build and routing | Vite `base: process.env.BASE_URL ?? '/'` is captured at build time, and asset URLs derive from the Vite base. The app uses hash routes, so the Vercel target only needs to serve the static build and never rewrites deep links. The build gate and the Vercel configuration are recorded under Build verification and hosting configuration below; publishing remains owned by the later deployment task. |
| State management | No state-management library in Phase 1. The rules layer stays independent and pure; screens use React state and hooks until a vertical slice demonstrates a need for more. Revisit with a recorded decision if that need appears. |
| Saved-data versioning | Saved runs, preferences, and statistics are separate versioned JSON payloads under the product's own storage namespace, each carrying an integer `schemaVersion`. Reads validate the payload before use; supported older versions migrate through ordered migration functions; corrupt or unsupported payloads are preserved rather than overwritten, with the recovery choices in [REQ-010](prd.md#req-010). Implementation follows in Phase 4; no cross-product import or compatibility work is in scope ([DEC-003](prd.md#dec-003)). |
| Asset weight | `assets/` totals about 106 MB, so the 44 PNGs are the release's dominant payload. Phase 1 imports only the artwork a screen uses and never bundles `assets-old/`; later screens import only their needed cards and lazy-load artwork where practical. Do not compress, convert, re-encode, or replace the artwork without a recorded design decision that also re-checks its contrast and legibility rules. Flag deploy-weight risk to the hosting task: static bandwidth, preview-deploy size, and cache headers are recorded under Build verification and hosting configuration. |

## Initial hosting target

Host the initial release on Vercel. Keep deployment configuration and build instructions in implementation documentation rather than the PRD. Hosting is settled; publishing a deployment is not authorized by this plan.

When deployment is authorized, verify the deployed game loads its current artwork, supports opening and refreshing screens and replay links directly, and preserves saves, preferences, and statistics across reloads on the intended player-facing URL. If preview deployments are used, verify their replay links and asset paths too. Document that saved data belongs to the browser and site address where it was created; no cross-site or cross-device synchronization is in scope, consistent with [DEC-002](prd.md#dec-002).

## Build verification and hosting configuration (recorded 2026-11-01)

Phase 1 records the verification gate and the Vercel build configuration. This section configures builds; it does not authorize a deployment, a Vercel project connection, or publishing.

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `release/ds-react` and on manual `workflow_dispatch`. It has no `pull_request` trigger because this standalone branch does not open merge requests, and it has no deploy job. The workflow uses Node.js 22 with pnpm 11.7.0 read from `packageManager`, installs with `pnpm install --frozen-lockfile`, and then runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm bundle-size` in that order. Browser automation joins CI in a later phase when Playwright is installed; Phase 1 CI verifies only these steps.

### Bundle-size gate

`scripts/check-bundle-size.mjs`, run as `pnpm bundle-size` after `pnpm build`, reads the production output in `dist/` and measures gzip size with `node:zlib` level 9, because gzip approximates the bytes a browser downloads. Raw sizes are not budgeted. The script identifies entry chunks from `dist/index.html` and tolerates a non-root `BASE_URL`. The gate fails with a non-zero exit and a clear message when a budget is exceeded. The environment variables `BUNDLE_ENTRY_JS_GZIP_MAX_KB`, `BUNDLE_TOTAL_JS_GZIP_MAX_KB`, and `BUNDLE_TOTAL_CSS_GZIP_MAX_KB` override a budget in KiB for deliberate negative testing only and are never set in CI.

| Budget | Limit (gzip) | Phase 1 measured |
| --- | --- | --- |
| Entry JS (scripts referenced by `dist/index.html`) | 250 KiB | 66.51 KiB |
| Total JS (all emitted JS chunks) | 350 KiB | 66.51 KiB |
| Total CSS (all emitted CSS) | 50 KiB | 1.29 KiB |

Vite reports its own decimal-kB baseline (220.57 kB raw / 68.99 kB gzip JS, 3.29 kB / 1.33 kB gzip CSS); it compresses on a slightly different basis, so treat that as an approximate cross-check of the gate's 66.51 KiB entry-JS figure (about 1.3% apart), not a unit conversion. The limits let phases 2–5 add the rules layer, screens, translation, and persistence while still catching an accidental large dependency; revisit them at the Phase 5 readiness review with measured evidence. The gate budgets code only. The 44 PNG illustrations are the dominant payload and are excluded on purpose; their decision is recorded below and under Asset weight.

### Vercel configuration and caching

`vercel.json` selects the Vite framework, installs with `pnpm install --frozen-lockfile`, builds with `pnpm build`, and publishes `dist/`. Hashed build files under `/assets/*` receive `Cache-Control: public, max-age=31536000, immutable`; HTML is deliberately left without a long-lived cache rule so a later deployment can be picked up on reload. Hash routing means every route is served from `index.html`, so no catch-all rewrite is needed and direct route refreshes work once deployed.

`BASE_URL` remains a build-time override with default `/`. A non-root base changes emitted asset URLs, so the `/assets/*` header path must be updated with it. Preview and production deployments use the same `vercel.json`, but Vercel previews and the production domain are different origins, so saves, preferences, statistics, and replay links do not cross between them (data belongs to the browser and site address where it was created, per [DEC-002](prd.md#dec-002)). Persistence and direct-link checks must therefore run on the intended player-facing URL. No Vercel project is created or linked in Phase 1, and creating or promoting a deployment still requires the explicit authorization recorded in [progress.md](progress.md).

### Artwork payload and caching decision

`assets/` totals about 106 MB across the 44 current PNGs, so artwork is the release's dominant download. Decision: do not compress, convert, re-encode, or replace the artwork; the approved design and the Asset weight decision above still apply, and no file from `assets-old/` is bundled. Hashed artwork receives the same immutable `/assets/*` caching, so repeats do not re-download it within a deployment. Phases 3–5 import only the cards a screen uses and lazy-load artwork where practical. Static bandwidth, preview-deploy size, and the first-load cost of screens showing many cards remain known hosting risks; changing the artwork format or delivery would need a recorded product decision and is not assumed by this configuration.

## Browser and accessibility verification

Verify [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017) with Chromium browser automation, covering desktop and mobile widths, touch, keyboard-only operation, help and dialogs, focus behavior, and reduced motion. Chrome is the only supported browser (user decision, 2026-11-08); Firefox, Safari, and WebKit checks are out of scope. Formal audits, certification, and extensive screen-reader testing remain the lower-priority follow-ups defined in [REQ-017](prd.md#req-017).

## Delivery plan

Each phase produces a reviewable result and ends with its acceptance check. Do not treat this checklist as authorization to start coding. Track phase status in [progress.md](progress.md).

### 1. Settle the foundation

Follow the design plan's handoff sequence and visual treatment. Define the expected 44-card asset inventory and the seed/replay contract. Prepare build and routing choices for the Vercel hosting target. Only after implementation is authorized, create the minimum application and verification tooling.

Requirements: [REQ-001](prd.md#req-001), [REQ-010](prd.md#req-010), [REQ-014](prd.md#req-014), [REQ-016](prd.md#req-016), [REQ-017](prd.md#req-017), and [DEC-001](prd.md#dec-001).

Acceptance check: approved decisions are recorded in the owning documents; the design plan records the required small-screen and keyboard coverage for the style guide and records its approval status; an asset inventory matches all 44 expected cards. After scaffolding is authorized, the minimal app builds and displays a current artwork card without including archived artwork.

### 2. Prove the game rules

Build the presentation-independent game model and its focused behavioral tests before connecting the full interface. Cover deck construction, seeded order, legal actions, previews, combat, equipment replacement, potion limits, escape restrictions, carryover, final rooms, room undo, scoring, and the three house-rule choices.

Requirements: [REQ-002](prd.md#req-002), [REQ-003](prd.md#req-003), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), and [REQ-011](prd.md#req-011).

Acceptance check: rule tests pass for weapon damage at and below zero, equal-value degradation rejection, barehanded choice, wasted potions, carried hearts, prohibited consecutive escapes, escape blocked after the first resolution under either escape option, escape allowed after preview alone when otherwise legal, a new undo boundary after escape, the final-room escape restriction under either escape option, the defined escape return order, final rooms of one through four cards, lethal combat, undo restoration during an active run, and undo rejection after both win and loss. Verify that win score equals surviving health, loss score includes draw-pile monsters but excludes unresolved room monsters, and death takes precedence when resolving the last card. Verify that undo restores all fields listed in [REQ-008](prd.md#req-008): a previously eligible room can be escaped after undo; a room entered after an escape stays ineligible under default rules; final-room escape stays blocked; repeated resolve/undo cycles do not inflate highlights. The same seed yields the same initial deck, and an action preview agrees with the confirmed result. Check all combinations of the three house-rule choices where they affect gameplay against the definitions in [REQ-011](prd.md#req-011).

### 3. Deliver a complete playable run

Connect title, play, and result screens to the rules layer. Include card selection and confirmation, weapon/kill-stack presentation, contextual help, explicit room entry, and undo. Include current artwork, responsive layout, keyboard interaction, translated messages, basic accessible labels and feedback, and reduced-motion behavior from the first playable slice. Add About and preferences so a player can discover the rules and choose a ruleset. After the design plan records approval of the style guide, review its extension to settings and the result scorecard; review the statistics screen in phase 4 as the second design handoff.

Requirements: [REQ-001](prd.md#req-001), [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-015](prd.md#req-015), [REQ-016](prd.md#req-016), and [REQ-017](prd.md#req-017).

Acceptance check: seeded playthroughs reach both win and loss through real interface actions. A player can select, preview, confirm, inspect help, undo, and enter the next room using keyboard alone and on a small touchscreen. Verify both languages, the English fallback for an unsupported browser language, visible focus, keyboard navigation without traps, semantic controls, descriptive labels, legibility, and clarity with reduced motion in the target browsers. Visual review confirms the current artwork and the design direction approved under the design plan's design approval status.

### 4. Add continuity, history, and replay

Add persistence, statistics, recent history, replay, seed entry, and share links for [REQ-001](prd.md#req-001), [REQ-010](prd.md#req-010), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014), including the replacement, abandonment, once-only recording, and history-trimming policies those requirements define.

Requirements: [REQ-001](prd.md#req-001), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-010](prd.md#req-010), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Acceptance check: close/reopen and reload checks preserve progress, undo, preferences, and results. Reloading a completed run, or opening it in a second tab, does not increment statistics again or make undo available, and only one outcome is recorded per run. Verify this after both win and loss. Removing a run preserves preferences and previously recorded statistics while adding the required abandoned loss for an unfinished run. Verify that New Run, valid seed entry, history replay, and a valid shared link each replace an unfinished run without confirmation, and that Continue or reload then restores only the replacement run. Each replacement must record exactly one abandoned loss for the outgoing run, updating games played, losses, and win rate. Reloading must not record that loss again. Explicitly discarding an unfinished run has the same statistical effect: Discard Run appears on the title screen only when an unfinished run exists, requires confirmation, and removes the saved run. For both replacement and discard, verify that positive remaining health does not affect abandonment score, unresolved room monsters are excluded, and 38 monster points in the outgoing draw pile produce a score of -38. A draw pile with no monsters produces score 0 but remains a loss. Include abandonment scores in best-score comparisons and confirm the incoming run does not affect the outgoing score. Returning to the title, closing, or reloading a resumable run must not record a loss. Invalid seeds or links must not replace the active run or count it as abandoned, and must explain the problem. Check every listed statistic and history field, including the win-rate formula and rounding, the zero-game win-rate display, and history dates shown in local time; verify newest-first history order and unchanged lifetime totals after trimming history. After recording 51 runs, exactly the newest 50 remain in history, while lifetime statistics include all 51 outcomes. Include abandoned losses in this limit and exclude unfinished active runs. Reload must neither restore trimmed entries nor apply an outcome again. Verify room counts and result highlights against [REQ-009](prd.md#req-009) and [REQ-013](prd.md#req-013). Include the clear/escape/death example yielding 3 explored and 1 cleared; a clear/undo/clear sequence; the final room; and death on the last required card. Check explored counts immediately after a deal and cleared counts before pressing Enter Next Room. After save/resume, undo must still restore room-start escape eligibility and counters exactly. Review the statistics screen against the visual language once the design plan records its approval. A history replay and a copied link reproduce the starting deck and original rule options; seed-only entry uses selected options. Invalid seeds and links are explained without changing the active run or statistics. Invalid or unreadable saves and unavailable storage follow the recovery choices in [REQ-010](prd.md#req-010) rather than showing an unusable screen. Exercise a saved-data format change: a save written under a previous supported version loads through the documented migration, or an unsupported version reports its recovery choices, while progress, settings, and statistics are preserved.

Streak acceptance checks: both counters start at 0; win, win, loss, win yields current 1 and best 2. Verify that abandonment resets the current streak, an unfinished run leaves both unchanged, and reload does not apply an outcome twice. Include wins and losses from replays and different house-rule settings in the same streak. Trimming history must preserve both streak counters.

### 5. Verify product readiness

Review every PRD acceptance check and the design direction approved in the design plan, including the phase-4 saved-data format-change scenario. Run automated rule, interface, and browser checks appropriate to each behavior. Run Chromium browser checks at desktop and mobile widths, including touch and complete keyboard playthroughs. Review basic accessibility during normal interface verification; record extensive screen-reader testing and formal audits as lower-priority follow-ups. Verify the release build for Vercel and, when deployment is authorized, smoke-check the deployed URL; document run, build, and verification commands only once those commands actually exist.

Requirements: all [product acceptance checks](prd.md#product-acceptance), including [AC-001](prd.md#ac-001), [AC-002](prd.md#ac-002), [AC-003](prd.md#ac-003), [AC-004](prd.md#ac-004), and [AC-005](prd.md#ac-005).

Acceptance check: all required checks pass, manual review findings are resolved or explicitly documented for the user, every requirement has supporting evidence, and application output contains current artwork without archived images. A release-readiness report identifies any remaining limitations. Publishing, merging, or opening a merge request requires explicit instructions.

## Risks and review focus

| Risk | Planned response |
| --- | --- |
| Different rules in previews, confirmed actions, and help | One rules layer plus preview/result agreement checks; help derives from the selected rules |
| Undo or reload changes history or duplicates a completed run | Keep completed results final; check undo rejection and repeated reload after both win and loss |
| Saved data becomes unreadable after a future product update | Version and validate data created by this product; preserve supported saves and preferences |
| Artwork or effects obscure accessible information | Current assets only; translated text, focus, and announcements remain independently readable |
| Scope expands into renderer rewrites or extra modes | Keep delivery tied to PRD IDs and [DEC-002](prd.md#dec-002); revisit only on an explicit product decision |
