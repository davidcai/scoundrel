# Scoundrel implementation plan

## Status and boundaries

Implementation started on November 1, 2026. The initial scaffold and approved title-screen foundation are implemented. The independent rules layer is now implemented and tested; playable UI integration is implemented; persistence and statistics/history UI are implemented. Product readiness verification and deployment remain pending. The progress record below distinguishes completed checks from future acceptance criteria.

The [PRD](prd.md#info-002) owns product scope, the [rules](rules.md) own default gameplay, and the [design plan](design-plan.md) owns presentation choices. This document owns delivery order, proposed technical boundaries, and verification. Resolve contradictions in the owning document rather than introducing a second ruleset here.

Use only [assets/](../assets/) as runtime card artwork. Keep [assets-old/](../assets-old/) as archived reference; exclude it from future application outputs.

## Approved implementation approach

Use TypeScript, React, and Vite, with an independent, pure game-rules layer and an accessible HTML-based interface. This implementation approach and the initial foundation work are approved. Dependency versions are recorded in `package.json` and the worktree lockfile.

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

## Initial hosting target

Host the initial release on Vercel. Keep deployment configuration and build instructions in implementation documentation rather than the PRD. Hosting is settled; publishing a deployment is not authorized by this plan.

When deployment is authorized, verify the deployed game loads its current artwork, supports opening and refreshing screens and replay links directly, and preserves saves, preferences, and statistics across reloads on the intended player-facing URL. If preview deployments are used, verify their replay links and asset paths too. Document that saved data belongs to the browser and site address where it was created; no cross-site or cross-device synchronization is in scope.

## Browser and accessibility targets

Follow [REQ-016](prd.md#req-016) and [REQ-017](prd.md#req-017). Support modern browsers, using current stable Chromium-based browsers and Safari at verification time as primary targets. Verify applicable desktop and mobile use. Use Chromium and WebKit browser automation for broad checks, plus a real Safari smoke check; WebKit automation alone is not proof of Safari compatibility.

Keyboard navigation and common accessibility practices are initial-release work. Use semantic controls, descriptive labels, visible focus, and readable contrast. Verify the complete flow without a pointer, including help and dialogs, with no focus traps. Keep basic screen-reader support, but formal audits, certification, and extensive screen-reader testing are lower-priority follow-ups rather than release blockers.

## Statistics decisions

Room counts, abandonment losses and scoring, consecutive-win streaks, and the newest-50-runs history limit are settled in [REQ-013](prd.md#req-013). Lifetime statistics persist independently of the retained history entries.

## Rules research

A [copy of the authors' 2011 rulesheet](https://aiscoundrel.com/Scoundrel.pdf) defines rooms as four dealt cards, allows skipping a room by returning all four cards to the bottom of the dungeon, prohibits consecutive skips, and completes a normal turn after resolving three cards. It does not define explored/cleared statistics or undo. Treat those as application features owned by the PRD rather than attributing their definitions to tabletop rules.

Keep the literal canonical loss-scoring rule unless the user changes it: remaining unplayed monsters in the draw pile determine the loss score. Do not silently include unresolved room monsters. Likewise, an equal-value monster is ineligible after a weapon's last kill because the rule requires a strictly lower value.

## Delivery plan

The phase 1 scaffold/title screen and phase 2 rules layer are implemented and verified. Phase 3 playable-screen integration is implemented and verified. Phase 4 persistence/history is implemented. Phase 5 release verification remains pending. Each phase produces a reviewable result and ends with its acceptance check.

### 1. Settle the foundation

Use the approved title/play-screen mockups and style tokens from the design plan's handoff sequence. Define the expected 44-card asset inventory and the seed/replay contract. Prepare build and routing choices for the Vercel hosting target. The minimum application and verification tooling are now in place. The version-1 seed/replay contract is now documented in [the rules-layer contract](engine-contract.md).

Requirements: [REQ-001](prd.md#req-001), [REQ-010](prd.md#req-010), [REQ-014](prd.md#req-014), [REQ-016](prd.md#req-016), [REQ-017](prd.md#req-017), and [DEC-001](prd.md#dec-001).

Acceptance check: approved decisions are recorded in the owning documents; the design covers small-screen and keyboard use; an asset inventory matches all 44 expected cards. The minimal app builds and displays a current artwork card without including archived artwork.

### 2. Prove the game rules

Status: implemented. See [the rules-layer contract](engine-contract.md) for the public API, version-1 seed/replay format, and the current suite.

Build the presentation-independent game model and its focused behavioral tests before connecting the full interface. Cover deck construction, seeded order, legal actions, previews, combat, equipment replacement, potion limits, escape restrictions, carryover, final rooms, room undo, scoring, and the three house-rule choices.

Requirements: [REQ-002](prd.md#req-002), [REQ-003](prd.md#req-003), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), and [REQ-011](prd.md#req-011).

Acceptance check: rule tests pass for weapon damage at and below zero, equal-value degradation rejection, barehanded choice, wasted potions, carried hearts, prohibited consecutive escapes, escape blocked after the first resolution under either escape option, escape allowed after preview alone when otherwise legal, a new undo boundary after escape, the final-room escape restriction under either escape option, final rooms of one through four cards, lethal combat, undo restoration during an active run, and undo rejection after both win and loss. Verify that win score equals surviving health, loss score includes draw-pile monsters but excludes unresolved room monsters, and death takes precedence when resolving the last card. Verify that undo restores all fields listed in [REQ-008](prd.md#req-008): a previously eligible room can be escaped after undo; a room entered after an escape stays ineligible under default rules; final-room escape stays blocked; repeated resolve/undo cycles do not inflate highlights. The same seed yields the same initial deck, and an action preview agrees with the confirmed result. Check all combinations of the three house-rule choices where they affect gameplay.

### 3. Deliver a complete playable run

Status: implemented; phase 4 now adds durability. New Run, seed entry, replay links, the approved play screen, room controls, English/Chinese feedback, and final results are connected to the engine. Stats/history UI and reload recovery are implemented in phase 4.

Connect title, play, and result screens to the rules layer. Include card selection and confirmation, weapon/kill-stack presentation, contextual help, explicit room entry, and undo. Include current artwork, responsive layout, keyboard interaction, translated messages, basic accessible labels and feedback, and reduced-motion behavior from the first playable slice. Add About and preferences so a player can discover the rules and choose a ruleset. After the style guide is approved, review its extension to settings and the result scorecard; review the statistics screen in phase 4 as the second design handoff.

Requirements: [REQ-001](prd.md#req-001), [REQ-003](prd.md#req-003), [REQ-004](prd.md#req-004), [REQ-005](prd.md#req-005), [REQ-006](prd.md#req-006), [REQ-007](prd.md#req-007), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-011](prd.md#req-011), [REQ-012](prd.md#req-012), [REQ-015](prd.md#req-015), [REQ-016](prd.md#req-016), and [REQ-017](prd.md#req-017).

Acceptance check: seeded playthroughs reach both win and loss through real interface actions. A player can select, preview, confirm, inspect help, undo, and enter the next room using keyboard alone and on a small touchscreen. Verify both languages, visible focus, keyboard navigation without traps, semantic controls, descriptive labels, legibility, and clarity with reduced motion in the target browsers. Visual review confirms the current artwork and agreed design direction.

### 4. Add continuity, history, and replay

Status: implemented. See [the persistence contract](persistence-contract.md) for the version-1 format, transactional writes, recovery, and verification.

Save active runs including room undo, preferences, and completed outcomes. Keep active-run rules fixed when preferences change. Add aggregate statistics, recent history using the limit in [REQ-013](prd.md#req-013), replay from history, seed entry, and share links. Separate a fresh seeded attempt from resuming a saved run. Apply the single-active-run replacement policy in [REQ-001](prd.md#req-001) to every fresh-run entry point. Record abandoned runs as losses when replaced or explicitly discarded, preserving their abandoned status in history and applying the normal loss formula to the outgoing draw pile before replacing or removing the run. Record completed runs once even after reloads, and preserve lifetime totals when recent history is trimmed.

Requirements: [REQ-001](prd.md#req-001), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-010](prd.md#req-010), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014).

Acceptance check: close/reopen and reload checks preserve progress, undo, preferences, and results. Before shipping a saved-data format change, load a fixture saved by this game's preceding supported format and verify progress, room undo, settings, statistics, and result finality survive migration. This applies to future versions of this game, not data import from other releases. Reloading a completed run does not increment statistics again or make undo available. Verify this after both win and loss. Removing a run preserves preferences and previously recorded statistics while adding the required abandoned loss for an unfinished run. Verify that New Run, valid seed entry, history replay, and a valid shared link each replace an unfinished run without confirmation, and that Continue or reload then restores only the replacement run. Each replacement must record exactly one abandoned loss for the outgoing run, updating games played, losses, and win rate. Reloading must not record that loss again. Explicitly discarding an unfinished run has the same statistical effect. For both replacement and discard, verify that positive remaining health does not affect abandonment score, unresolved room monsters are excluded, and 38 monster points in the outgoing draw pile produce a score of -38. A draw pile with no monsters produces score 0 but remains a loss. Include abandonment scores in best-score comparisons and confirm the incoming run does not affect the outgoing score. Returning to the title, closing, or reloading a resumable run must not record a loss. Invalid seeds or links must not replace the active run or count it as abandoned. Check every listed statistic and history field, newest-first history order, and unchanged lifetime totals after trimming history. After recording 51 runs, exactly the newest 50 remain in history, while lifetime statistics include all 51 outcomes. Include abandoned losses in this limit and exclude unfinished active runs. Reload must neither restore trimmed entries nor apply an outcome again. Verify room counts and result highlights against [REQ-013](prd.md#req-013). Include the clear/escape/death example yielding 3 explored and 1 cleared; a clear/undo/clear sequence; the final room; and death on the last required card. Check explored counts immediately after a deal and cleared counts before pressing Enter Next Room. After save/resume, undo must still restore room-start escape eligibility and counters exactly. Review the statistics screen against the approved visual language. A history replay and a copied link reproduce the starting deck and original rule options; seed-only entry uses selected options. Invalid or unreadable saves and replay links produce understandable recovery choices rather than an unusable screen.

Streak acceptance checks: both counters start at 0; win, win, loss, win yields current 1 and best 2. Verify that abandonment resets the current streak, an unfinished run leaves both unchanged, and reload does not apply an outcome twice. Include wins and losses from replays and different house-rule settings in the same streak. Trimming history must preserve both streak counters.

### 5. Verify product readiness

Review every PRD acceptance check and the approved design. Run automated rule, interface, and browser checks appropriate to each behavior. Run Chromium and WebKit browser checks and a real Safari smoke check, including touch and complete keyboard playthroughs. Review basic accessibility during normal interface verification; record extensive screen-reader testing and formal audits as lower-priority follow-ups. Verify the release build for Vercel and, when deployment is authorized, smoke-check the deployed URL; document run, build, and verification commands only once those commands actually exist.

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

A separate reviewer checked this draft against the PRD, rules, and design plan. The review found no blocking scope conflict and confirmed coverage of all 17 requirements. The plan includes explicit scoring and statistics checks and a second design handoff. Escape timing, fresh-release scope, and undo being unavailable after a win or loss are settled. That planning review preceded implementation; measured implementation checks are recorded below.

## Foundation verification

Measured on November 1, 2026:

| Check | Result |
| --- | --- |
| Node 22.23.4 production build | Typecheck and Vite build passed |
| `pnpm format:check` | Passed |
| `scripts/check-artwork.mjs` | Exact 44-card source inventory; archived artwork excluded |
| Local Chromium production checks | English and Chinese at 320, 390, 768, and 1440px; current artwork loaded; no horizontal overflow or runtime errors |
| Keyboard and dialog checks | Skip link, settings controls, Escape close, focus restoration, and About links verified |
| Independent foundation review | Approved after 2 rounds; fixed automatic-language selection to honor browser preference order |

Safari has not yet been verified. All original PNG card assets are bundled, with only rendered cards requested by the browser; delivery optimization remains release work. The three original title illustrations total about 7.4 MB. Persistence and statistics were added after the foundation checks; see phase 4 verification below.

## Rules-layer verification

Measured on November 1, 2026:

- `pnpm test` on Node 22.23.4: 79 tests passed, including 256 complete seeded runs across all eight configurations and a pinned version-1 deck fixture.
- Node 22 production build, typecheck, artwork validation, and formatting checks passed.
- Independent review approved the engine, tests, and versioned replay contract with no open findings.

## Playable UI verification

Measured on November 1, 2026:

- 82 engine/session unit tests pass.
- Six production Chromium browser tests pass. A pinned `browser-1` fixture is played through real UI actions under default rules, reaching a win with score 7. A separate lethal run reaches a loss. Tests also cover previews, confirmation, full-room undo, carryover, escape restriction, validation, frozen active-run rules, and keyboard selection.
- English and Chinese play layouts were checked at 320, 390, 637, 768, 1000, and 1440px with loaded artwork and no horizontal overflow. Desktop/mobile production screenshots were visually reviewed against the mockups.
- Build, typecheck, artwork archive exclusion, and formatting checks pass. Independent review approved after fixing a skip-link/history regression; a browser check confirms skipping preserves the replay fragment and equipped weapon.

Win-test fixture note: heuristic searches pruned valid routes before UI actions ran. The final test uses an independently verified, pinned default-rules route, validates it against the engine, then executes every action in the browser. No game-state injection or relaxed rules are used.

## Persistence and history verification

Measured on November 1, 2026:

- 99 engine/session/save-envelope unit tests pass on Node 22.23.4. They cover room-start restoration, fixed active-run rules, result finality, exactly-once outcomes, history trimming, lifetime statistics and streaks, invalid envelopes, and a synthetic migration-chain fixture.
- All 16 production Chromium browser tests pass. They cover reload and close/reopen recovery, preferences, abandoned losses, history replay with original rules, explicit discard, win/loss reload without recounting, corrupt/newer saves, unavailable storage, failed-write preservation and retry, and simultaneous-tab conflict protection.
- Browser storage uses one versioned envelope in an IndexedDB read/write transaction so checking the previous revision and replacing it are atomic. A browser trace disproved the earlier assumption that a Web Lock refreshes another renderer's localStorage cache; that approach was removed.
- Typecheck, production build, artwork inventory/archive exclusion, formatting, and changed-document local links/anchors pass. Desktop English and mobile Chinese Stats screens were visually checked without horizontal overflow; rule details open using the keyboard.
- Independent persistence review approved after two rounds. The only finding was the cross-tab overwrite race; transactional storage fixed it, with no declined or open findings.
- This is the first save format for this fresh release. Before any future supported format change, add real preceding-version fixtures and the corresponding migration. The synthetic fixture proves the migration helper, not compatibility with a released predecessor.

## Next action

Proceed to phase 5: verify PRD coverage, optimize artwork delivery, and run WebKit plus real Safari smoke checks. Review the saved-game and Stats experience locally first. Vercel publishing remains a separate, explicitly authorized action.
