# Scoundrel implementation plan

## Plan scope and boundaries

This plan proposes how to build the product and does not claim any build, test, performance, or deployment result. Current phase, status, and next actions are tracked in [progress.md](progress.md).

The [PRD](prd.md#info-002) owns product scope, the [rules](rules.md) own default gameplay, and the [design plan](design-plan.md) owns presentation choices. This document owns delivery order, proposed technical boundaries, and verification. Resolve contradictions in the owning document rather than introducing a second ruleset here. Keep links, PRD references, and requirement coverage valid when editing these documents.

Use only [assets/](../assets/) as runtime card artwork. Keep [assets-old/](../assets-old/) as archived reference only; never load, bundle, or copy it into application outputs.

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

## Settled planning decisions

- Escape is allowed only before the first card is resolved, regardless of the consecutive-room house-rule setting. Selecting or previewing a card does not resolve it. Escaping deals a new room and establishes that room's undo starting point; undo cannot return to the escaped room. See [REQ-007](prd.md#req-007) and [REQ-008](prd.md#req-008).
- Room undo restores the full room-start state specified by [REQ-008](prd.md#req-008), including escape eligibility and run-highlight counters. Retrying a room must not accumulate duplicate highlights.
- Plan a fresh release. Define save, preference, seed, and replay-link formats for this product. Data import and compatibility work are outside scope. See [DEC-003](prd.md#dec-003).

- A win or loss is final. Undo is unavailable after either outcome, including after reloading the result screen. Retrying starts a fresh attempt. See [REQ-008](prd.md#req-008) and [REQ-009](prd.md#req-009).

- Loss scoring counts only monsters remaining in the Dungeon draw pile; unresolved room cards are excluded. See the [rules](rules.md).

- Escaped room cards return to the bottom of the Dungeon as one block in their current left-to-right order; the leftmost is dealt again first among them. See [REQ-007](prd.md#req-007).

## Initial hosting target

Host the initial release on Vercel. Keep deployment configuration and build instructions in implementation documentation rather than the PRD. Hosting is settled; publishing a deployment is not authorized by this plan.

When deployment is authorized, verify the deployed game loads its current artwork, supports opening and refreshing screens and replay links directly, and preserves saves, preferences, and statistics across reloads on the intended player-facing URL. If preview deployments are used, verify their replay links and asset paths too. Document that saved data belongs to the browser and site address where it was created; no cross-site or cross-device synchronization is in scope.

## Browser and accessibility targets

Follow [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017). Verify the current and previous major versions of Chrome, Edge, Firefox, and Safari on desktop, plus current iOS Safari and Android Chrome; Chromium-based browsers and Safari are the primary verification targets, and Firefox gets a complete-flow smoke check. Verify applicable desktop and mobile use. Use Chromium and WebKit browser automation for broad checks, plus a real Safari smoke check; WebKit automation alone is not proof of Safari compatibility.

Keyboard navigation and common accessibility practices are initial-release work. Use semantic controls, descriptive labels, visible focus, and readable contrast. Verify contrast against WCAG 2.2 AA (4.5:1 for normal text; 3:1 for large text and essential UI boundaries) and verify touch targets at least 24×24 CSS px, with 44×44 CSS px for primary card and action controls. Verify the complete flow without a pointer, including help and dialogs, with no focus traps. Keep basic screen-reader support, but formal audits, certification, and extensive screen-reader testing are lower-priority follow-ups rather than release blockers.

## Statistics decisions

Room counts, abandonment losses and scoring, consecutive-win streaks, and the newest-50-runs history limit are settled in [REQ-013](prd.md#req-013). Lifetime statistics persist independently of the retained history entries.

## Rules research

A [copy of the authors' 2011 rulesheet](https://aiscoundrel.com/Scoundrel.pdf) defines rooms as four dealt cards, allows skipping a room by returning all four cards to the bottom of the dungeon, prohibits consecutive skips, and completes a normal turn after resolving three cards. It does not define explored/cleared statistics or undo. Treat those as application features owned by the PRD rather than attributing their definitions to tabletop rules.

Loss scoring follows the [rules](rules.md): only monsters remaining in the Dungeon draw pile count; unresolved room cards, including the carried card, are excluded. Keep that literal canonical rule unless the user changes it. Likewise, an equal-value monster is ineligible after a weapon's last kill because the rule requires a strictly lower value.

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

Save active runs including room undo, preferences, and completed outcomes. Keep active-run rules fixed when preferences change. Add aggregate statistics, recent history using the limit in [REQ-013](prd.md#req-013), replay from history, seed entry, and share links. Separate a fresh seeded attempt from resuming a saved run. Apply the single-active-run replacement policy in [REQ-001](prd.md#req-001) to every fresh-run entry point. Record abandoned runs as losses when replaced or explicitly discarded, preserving their abandoned status in history and applying the normal loss formula to the outgoing draw pile before replacing or removing the run. Record completed runs once even after reloads or when the same result is open in another tab, and preserve lifetime totals when recent history is trimmed.

Requirements: [REQ-001](prd.md#req-001), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-010](prd.md#req-010), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Acceptance check: close/reopen and reload checks preserve progress, undo, preferences, and results. Reloading a completed run, or opening it in a second tab, does not increment statistics again or make undo available, and only one outcome is recorded per run. Verify this after both win and loss. Removing a run preserves preferences and previously recorded statistics while adding the required abandoned loss for an unfinished run. Verify that New Run, valid seed entry, history replay, and a valid shared link each replace an unfinished run without confirmation, and that Continue or reload then restores only the replacement run. Each replacement must record exactly one abandoned loss for the outgoing run, updating games played, losses, and win rate. Reloading must not record that loss again. Explicitly discarding an unfinished run has the same statistical effect: Discard Run appears on the title screen only when an unfinished run exists, requires confirmation, and removes the saved run. For both replacement and discard, verify that positive remaining health does not affect abandonment score, unresolved room monsters are excluded, and 38 monster points in the outgoing draw pile produce a score of -38. A draw pile with no monsters produces score 0 but remains a loss. Include abandonment scores in best-score comparisons and confirm the incoming run does not affect the outgoing score. Returning to the title, closing, or reloading a resumable run must not record a loss. Invalid seeds or links must not replace the active run or count it as abandoned, and must explain the problem. Check every listed statistic and history field, including the win-rate formula and rounding, the zero-game win-rate display, and history dates shown in local time; verify newest-first history order and unchanged lifetime totals after trimming history. After recording 51 runs, exactly the newest 50 remain in history, while lifetime statistics include all 51 outcomes. Include abandoned losses in this limit and exclude unfinished active runs. Reload must neither restore trimmed entries nor apply an outcome again. Verify room counts and result highlights against [REQ-009](prd.md#req-009) and [REQ-013](prd.md#req-013). Include the clear/escape/death example yielding 3 explored and 1 cleared; a clear/undo/clear sequence; the final room; and death on the last required card. Check explored counts immediately after a deal and cleared counts before pressing Enter Next Room. After save/resume, undo must still restore room-start escape eligibility and counters exactly. Review the statistics screen against the visual language once the design plan records its approval. A history replay and a copied link reproduce the starting deck and original rule options; seed-only entry uses selected options. Invalid seeds and links are explained without changing the active run or statistics. Invalid or unreadable saves and unavailable storage follow the recovery choices in [REQ-010](prd.md#req-010) rather than showing an unusable screen. Exercise a saved-data format change: a save written under a previous supported version loads through the documented migration, or an unsupported version reports its recovery choices, while progress, settings, and statistics are preserved.

Streak acceptance checks: both counters start at 0; win, win, loss, win yields current 1 and best 2. Verify that abandonment resets the current streak, an unfinished run leaves both unchanged, and reload does not apply an outcome twice. Include wins and losses from replays and different house-rule settings in the same streak. Trimming history must preserve both streak counters.

### 5. Verify product readiness

Review every PRD acceptance check and the design direction approved in the design plan, including the phase-4 saved-data format-change scenario. Run automated rule, interface, and browser checks appropriate to each behavior. Run Chromium and WebKit browser checks, a real Safari smoke check, and a complete-flow Firefox smoke check, including touch and complete keyboard playthroughs. Review basic accessibility during normal interface verification; record extensive screen-reader testing and formal audits as lower-priority follow-ups. Verify the release build for Vercel and, when deployment is authorized, smoke-check the deployed URL; document run, build, and verification commands only once those commands actually exist.

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
