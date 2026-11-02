# Scoundrel development progress

Tracks where development currently stands. The [implementation plan](implementation-plan.md) owns delivery order, technical boundaries, and acceptance checks; this document records phase status, completed work, and next actions. Update it when a phase starts, completes, or its status changes.

## Current state

- **Phase:** Phase 4 — Add continuity, history, and replay. Phases 1–3 are complete and accepted on 2026-11-01/2026-11-02; Phase 4 is in progress.
- **Last updated:** 2026-11-01.
- **Branch:** standalone product branch; do not merge into `main` or open a merge request without explicit instructions.
- **Design:** the written style guide in the [design plan](design-plan.md#design-approval-status) was approved by the user on 2026-11-01 as drafted (warm palette, serif display headings, no-badge card states, larger kill stack); the earlier withdrawn direction stays retired.

### Phase gate

Implementation was authorized by the user on 2026-11-01. Phases 1–3 are complete and accepted: Phase 1 after independent verification, Phase 2 after an independent engine review, and Phase 3 after two independent UI review rounds. Phase 4 is in progress: the persisted store layer is committed and UI integration is underway. Deployment, merging into `main`, and opening a merge request remain separately unauthorized. The written style guide was approved on 2026-11-01.

## Phase status

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Settle the foundation | Complete | Accepted 2026-11-01 after independent verification; CI workflow green; foundation decisions, minimal app, bundle-size gate, and Vercel build config in place. |
| 2. Prove the game rules | Complete | Accepted after independent engine review; 147 engine tests at acceptance; pure seeded rules engine with strict purity and determinism. |
| 3. Deliver a complete playable run | Complete | Accepted after two independent UI review rounds; 218 UI/integration tests at acceptance; seeded win and loss flows through the real UI, keyboard/compact-screen/both languages/reduced motion; Safari checks deferred to Phase 5. |
| 4. Add continuity, history, and replay | In progress | Phase 4a persisted store layer committed at `063b7952`; Phase 4b UI integration in progress. |
| 5. Verify product readiness | Not started | |

Work and acceptance checks for each phase are defined in the [delivery plan](implementation-plan.md#delivery-plan). Update the status and notes columns when a phase starts, changes, or completes.

## Completed work

- Planning documents drafted: PRD, game rules, design plan, and implementation plan.
- Independent planning review found no blocking scope conflict and confirmed coverage of all 17 requirements; escape timing, fresh-release scope, and undo being unavailable after a win or loss are settled.
- Agent instructions combined with the DeepSeek Harness kit; generic skills added under `.agents/skills/`.
- Design mockups removed and their references scrubbed; artwork rules moved into the design plan. The earlier approved visual direction was withdrawn with those references.
- Written style guide updated to the approved warm direction and approved by the user as drafted on 2026-11-01 after two independent contrast/accessibility re-checks; recorded in the design plan and committed to the branch.
- Implementation authorized by the user on 2026-11-01; Phase 1 started.
- Phase 1 foundation decisions recorded in the implementation plan: pnpm and Node.js 22 targets, exact dependency pins, the 44-card inventory, seed/replay and rule-option encoding, build/routing, state-management deferral, saved-data versioning, and asset-weight strategy.
- Minimal Vite + React + TypeScript scaffold created with the approved warm tokens, display serif, and one current-artwork card; smoke and asset-inventory tests added, and the production build displays the card without archived artwork. ESLint, Prettier, TypeScript, Vitest, and the production build were run with passing observed output.
- Phase 1 CI workflow (Node 22 + pnpm, lint/format/typecheck/test/build/bundle-size), gzip bundle-size gate with recorded budgets, and Vercel build/caching config added; all gate commands verified locally, negative-tested, and recorded in the implementation plan.
- Phase 1 independent acceptance review passed with no blockers or majors on 2026-11-01; the CI workflow ran green on `50734a0`, and acceptance evidence includes the 44/44 asset inventory, recorded foundation decisions, a production build that displays current artwork, and the bundle-size gate. The six minor review findings (dependency inventory, gzip cross-check wording, bundle-gate comment, derived card radii, section-heading font, PNG dimensions test) were fixed in `a66a923`.
- Phase 1 milestone commits: `f964c3d` scaffold, `50734a0` CI workflow, bundle gate, and Vercel build config, `a66a923` acceptance-review fixes.
- Phase 2 rules engine delivered as a pure TypeScript layer with the recorded seed/replay contract and gameplay rulings in the [rules document](rules.md); independent engine review passed; 147 engine tests at acceptance. Milestone commit `2cbc748e`.
- Phase 3 playable run delivered: title/play/result screens on the approved warm visual direction, English and Simplified Chinese, keyboard and compact-screen behavior, reduced motion, and seeded win and loss flows through the real UI; 218 UI/integration tests at acceptance. Two independent UI review rounds found one major and twelve minor issues, all fixed and re-verified; real-Safari verification is deferred to Phase 5. Milestone commit `713f1ac4`.
- Phase 4a persisted store layer delivered: versioned save/preferences/statistics with recovery choices, a single active run, once-only outcome recording, and history/replay/share links; 211 store tests at acceptance and independent store reviews. Milestone commit `063b7952`; Phase 4b UI wiring is in progress.
- Adversarial document review fixed one high, seven medium, and eight low issues: design approval gate, loss scoring, escape return order, explicit discard, house-rule semantics, save and link recovery, future-update acceptance, measurable accessibility targets, final-room rule wording, wasted-potion definition, explored-versus-cleared counts, language fallback, archived-artwork exclusion, stable product-acceptance anchor, multi-tab recording, and statistics definitions.

## Next actions

- Finish Phase 4b UI integration and its independent review.
- Then run Phase 5 verification: Playwright/WebKit/real-Safari/Firefox checks, accessibility review, bundle-size and asset-weight checks, and the release-readiness report, against [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017).
- Deployment and merging remain separately unauthorized and require explicit user authorization; keep the Vercel hosting target in the [implementation plan](implementation-plan.md). Safari remote automation is currently disabled and must be enabled by the user ("Allow remote automation") for the real-Safari smoke check.
- Use the approved style guide as the presentation source of truth; changes to it require a new recorded approval.
- Verify the future-update saved-data format-change scenario during Phase 4/5 acceptance.
