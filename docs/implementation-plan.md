# Scoundrel implementation plan

## Status and boundaries

Planning draft. No implementation is authorized yet. This branch contains artwork and documents, not an application. This plan proposes how to build the product and does not claim any build, test, performance, or deployment result.

The [PRD](prd.md#info-002) owns product scope, the [rules](rules.md) own default gameplay, and the [design plan](design-plan.md) owns presentation choices. This document owns delivery order, proposed technical boundaries, and verification. Resolve contradictions in the owning document rather than introducing a second ruleset here.

Use only [assets/](../assets/) as runtime card artwork. Keep [assets-old/](../assets-old/) as archived reference; exclude it from future application outputs.

## Proposed approach

Propose TypeScript, React, and Vite, with a pure game-rules layer and an accessible page-based interface. Select supported dependency versions when implementation begins; none are pinned or installed in this planning phase.

Prefer regular page elements for cards, controls, labels, and contextual help in the first playable version. They suit the turn-based board and keep input, screen-reader access, responsive layout, and translated text together. A canvas renderer is an alternative if a later visual requirement justifies its cost; it is not a prerequisite for the PRD. Motion is presentation feedback, not the authority for game state.

| Proposed area | Responsibility | Boundary |
| --- | --- | --- |
| `src/engine/` | Deck composition, seeded ordering, legal actions, previews, room progression, combat, undo, results, and scoring | No interface, browser storage, or presentation dependencies |
| `src/store/` | Active run, application preferences, saved progress, aggregate statistics, history, and replay links | Keep transient selection separate from saved game truth |
| `src/ui/` | Screens, card table, previews, confirmations, contextual help, focus, and announcements | Read rules-derived state; do not reimplement combat or action eligibility |
| `src/i18n/` | English and Simplified Chinese display messages | Translate controls, help, result feedback, and accessible descriptions together |
| `assets/` | Current card illustrations | Load only the expected 44 PNGs, preserving filenames |

Choose a state-management library only if the initial vertical slice needs it. The boundary matters more than the library. Plan rules operations around current game state plus a requested action producing a new state and a descriptive outcome. Preview and confirmation must use the same rule decisions. Resolve all random ordering from the run's seed so reproducing a dungeon does not depend on rendering or input timing.

## Settled planning decisions

- Escape is allowed only before the first card is resolved, regardless of the consecutive-room house-rule setting. Selecting or previewing a card does not resolve it. Escaping deals a new room and establishes that room's undo starting point; undo cannot return to the escaped room. See [REQ-007](prd.md#req-007) and [REQ-008](prd.md#req-008).
- Plan a fresh release. Define save, preference, seed, and replay-link formats for this product. Data import and compatibility work are outside scope. See [DEC-003](prd.md#dec-003).

- A win or loss is final. Undo is unavailable after either outcome, including after reloading the result screen. Retrying starts a fresh attempt. See [REQ-008](prd.md#req-008) and [REQ-009](prd.md#req-009).

## Remaining design detail

Define how escapes and room undo affect rooms explored, rooms cleared, and other run highlights before implementing those counters. Record the definitions in [REQ-013](prd.md#req-013). This does not reopen the settled escape or terminal-undo decisions.

## Rules research

The [published rules summary](https://rpdillon.net/scoundrel.html) describes skipping a freshly dealt room by returning all four cards to the bottom of the dungeon, with no consecutive skips. The user has explicitly settled the timing above. That summary does not specify undo. Treat room undo as the product feature defined by the PRD rather than attributing it to the tabletop rules. The original rules PDF could not be retrieved during this review.

Keep the literal canonical loss-scoring rule unless the user changes it: remaining unplayed monsters in the draw pile determine the loss score. Do not silently include unresolved room monsters. Likewise, an equal-value monster is ineligible after a weapon's last kill because the rule requires a strictly lower value.

## Delivery plan

All phases below are pending. Each phase produces a reviewable result and ends with its acceptance check. Do not treat this checklist as authorization to start coding.

### 1. Settle the foundation

Confirm the proposed interface approach; define the run-highlight counters; agree on the first title/play-screen design using the design plan's handoff sequence. Define the expected 44-card asset inventory, the seed/replay contract, and the intended release environment. Only after implementation is authorized, create the minimum application and verification tooling.

Requirements: [REQ-001](prd.md#req-001), [REQ-010](prd.md#req-010), [REQ-014](prd.md#req-014), [REQ-016](prd.md#req-016), [REQ-017](prd.md#req-017), and [DEC-001](prd.md#dec-001).

Acceptance check: approved decisions are recorded in the owning documents; the design covers small-screen and keyboard use; an asset inventory matches all 44 expected cards. After scaffolding is authorized, the minimal app builds and displays a current artwork card without including archived artwork.

### 2. Prove the game rules

Build the presentation-independent game model and its focused behavioral tests before connecting the full interface. Cover deck construction, seeded order, legal actions, previews, combat, equipment replacement, potion limits, escape restrictions, carryover, final rooms, room undo, scoring, and the three house-rule choices.

Requirements: [REQ-002](prd.md#req-002), [REQ-003](prd.md#req-003), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), and [REQ-011](prd.md#req-011).

Acceptance check: rule tests pass for weapon damage at and below zero, equal-value degradation rejection, barehanded choice, wasted potions, carried hearts, prohibited consecutive escapes, escape blocked after the first resolution under either escape option, escape allowed after preview alone when otherwise legal, a new undo boundary after escape, the final-room escape restriction under either escape option, final rooms of one through four cards, lethal combat, undo restoration during an active run, and undo rejection after both win and loss. Verify that win score equals surviving health, loss score includes draw-pile monsters but excludes unresolved room monsters, and death takes precedence when resolving the last card. The same seed yields the same initial deck, and an action preview agrees with the confirmed result. Check all combinations of the three house-rule choices where they affect gameplay.

### 3. Deliver a complete playable run

Connect title, play, and result screens to the rules layer. Include card selection and confirmation, weapon/kill-stack presentation, contextual help, explicit room entry, and undo. Include current artwork, responsive layout, keyboard interaction, translated messages, screen-reader feedback, and reduced-motion behavior from the first playable slice. Add About and preferences so a player can discover the rules and choose a ruleset. After the style guide is approved, review its extension to settings and the result scorecard; review the statistics screen in phase 4 as the second design handoff.

Requirements: [REQ-001](prd.md#req-001), [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-015](prd.md#req-015), [REQ-016](prd.md#req-016), and [REQ-017](prd.md#req-017).

Acceptance check: seeded playthroughs reach both win and loss through real interface actions. A player can select, preview, confirm, inspect help, undo, and enter the next room using keyboard alone and on a small touchscreen. Verify both languages, visible focus, meaningful announcements, legibility, and clarity with reduced motion. Visual review confirms the current artwork and agreed design direction.

### 4. Add continuity, history, and replay

Save active runs including room undo, preferences, and completed outcomes. Keep active-run rules fixed when preferences change. Add aggregate statistics, bounded recent history, replay from history, seed entry, and share links. Separate a fresh seeded attempt from resuming a saved run. Record completed runs once even after reloads, and preserve lifetime totals when recent history is trimmed.

Requirements: [REQ-001](prd.md#req-001), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-010](prd.md#req-010), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Acceptance check: close/reopen and reload checks preserve progress, undo, preferences, and results. Reloading a completed run does not increment statistics again or make undo available. Verify this after both win and loss. Removing a run preserves preferences and statistics. Check every listed statistic and history field, newest-first history order, and unchanged lifetime totals after trimming history. Verify room counts and result highlights against the agreed escape and undo semantics. Review the statistics screen against the approved visual language. A history replay and a copied link reproduce the starting deck and original rule options; seed-only entry uses selected options. Invalid or unreadable saves and replay links produce understandable recovery choices rather than an unusable screen.

### 5. Verify product readiness

Review every PRD acceptance check and the approved design. Run automated rule, interface, and browser checks appropriate to each behavior. Add manual screen-reader and touch review alongside automated accessibility checks. Verify the agreed release build in its intended environment; document run, build, and verification commands only once those commands actually exist.

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

## Planning review

A separate reviewer checked this draft against the PRD, rules, and design plan. The review found no blocking scope conflict and confirmed coverage of all 17 requirements. The plan includes explicit scoring and statistics checks and a second design handoff. Escape timing, fresh-release scope, and undo being unavailable after a win or loss are settled. No implementation checks have been run because implementation has not begun.

## Next action

Review the proposed interface approach and define the run-highlight counters. Wait for explicit implementation authorization before phase 1 scaffolding.
