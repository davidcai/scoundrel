# Scoundrel product requirements

## How to use this document

Each labeled item has a stable ID and link anchor. Use the ID when referencing a requirement, decision, finding, or open question. Keep IDs when editing or moving an item; retire an ID rather than reusing it for a different meaning.

<a id="info-001"></a>
### INFO-001: Product context

Scoundrel is a single-player dungeon-crawling card game for the web. This PRD defines the intended product from its initial release.

<a id="info-002"></a>
### INFO-002: Document authority

This PRD defines product goals, scope, and acceptance outcomes. The [game rules](rules.md) are authoritative for default gameplay and scoring. The [design plan](design-plan.md) specifies presentation decisions that satisfy the PRD. It references requirements here rather than maintaining a second feature list.

## Research findings

<a id="find-001"></a>
### FIND-001: Tabletop rules scope

The [game rules](rules.md) cite the authors' 2011 rulesheet, which defines rooms as four dealt cards, allows skipping a room by returning all four cards to the bottom of the dungeon, prohibits consecutive skips, and completes a normal turn after resolving three cards. The rulesheet does not define explored or cleared statistics or undo; those behaviors are application features owned by this PRD. Default gameplay, including loss scoring and weapon eligibility, remains authoritative in the [game rules](rules.md).

## Open questions

None at planning time. A question that affects scope, requirements, decisions, or acceptance checks is recorded here before those items change.

## Product goals

<a id="goal-001"></a>
### GOAL-001: Start and learn easily

New players can start a strategic solo game without a physical deck and learn through understandable choices and contextual help.

<a id="goal-002"></a>
### GOAL-002: Return and replay

Returning players can resume unfinished runs, review their progress, replay a dungeon, and share a challenge with friends.

<a id="goal-003"></a>
### GOAL-003: Make the full game accessible

Players using a keyboard or small touchscreen can complete the game. Provide common accessibility support as part of normal interface work; extensive accessibility work is a lower priority for the initial release.

## Core requirements

<a id="req-001"></a>
### REQ-001: Start and resume

The title screen offers New Run, Enter Seed, Stats, Settings, and About. Continue is prominent when an unfinished saved run exists; in that case the title screen also offers Discard Run. Returning players choose when to resume rather than being placed directly into a run. New Run starts a shuffled dungeon using the player's selected rule options. The game keeps one active run. Starting a fresh attempt through New Run, valid seed entry, history replay, or a valid shared link immediately replaces any unfinished run without confirmation. The replaced run cannot be resumed and is recorded as an abandoned loss under [REQ-013](#req-013). Discard Run requires confirmation, records the unfinished run as an abandoned loss, and leaves no resumable run.

<a id="req-002"></a>
### REQ-002: Play by the selected rules

The game handles dealing, damage, healing, equipment, and scoring according to the game rules by default. Players choose which cards to resolve and in what order. Optional house rules are defined in [REQ-011](#req-011).

<a id="req-003"></a>
### REQ-003: Progress through rooms

The unresolved fourth card carries automatically to the next room and is distinguishable from newly dealt cards. Players explicitly choose to enter the next room after resolving the required cards. When dealing empties the draw pile, the final room requires resolving every remaining card, even a lone card. Winning requires clearing that room while alive.

<a id="req-004"></a>
### REQ-004: Understand the current state

Health, remaining draw-pile cards, equipped weapon, defeated monsters, run-away availability, and the seed remain legible during play. Players can identify the weapon's current limit. Unavailable actions explain their restrictions.

<a id="req-005"></a>
### REQ-005: Preview and confirm actions

Selecting a card shows its effect before a separate confirmation commits the action. A monster preview shows expected damage and whether the equipped weapon can be used. Fighting barehanded remains an option when a weapon is equipped. Weapon damage cannot be negative or restore health.

<a id="req-006"></a>
### REQ-006: Explain item outcomes

Replacing a weapon explains that the old weapon and all its defeated monsters are discarded. Potion feedback distinguishes health restored from a potion consumed without healing. Unresolved potions carry normally, and the potion allowance resets each room.

<a id="req-007"></a>
### REQ-007: Run away when permitted

Running away is allowed only before the first card in a room is resolved. Selecting or previewing a card does not count as resolving it. This timing restriction applies under either consecutive-room house-rule choice. Running away returns all four room cards to the bottom of the dungeon as one block in their current left-to-right order (the leftmost is dealt again first among them) and deals another room. Default play prohibits running away from consecutive rooms. Running away is always unavailable in the final room, including when the consecutive-room restriction is turned off.

<a id="req-008"></a>
### REQ-008: Retry the current room

Undo to Room Start restores the current room's starting health, equipment, defeated-monster stack, room cards and their order, draw-pile order, potion allowance, escape eligibility, and run-highlight counters. It restores the same room rather than generating another dungeon. The seed and selected rules stay fixed.

If escape was allowed at room entry, undo makes escape available again because no card remains resolved. If escape was blocked at room entry because the preceding room was escaped, undo keeps it blocked. Other restrictions, including the final-room escape prohibition, still apply.

Undo reverses changes to run highlights made since the room began, including monsters defeated and potions wasted. Retrying a room must not accumulate duplicate counts.

Undo remains available after resuming an unfinished saved run. Undo is unavailable once the run ends in a win or loss, including after reloading the result screen. Entering the next room ends the opportunity to undo the previous room. Running away also starts a new room with its own undo starting point; undo cannot return to the escaped room.

<a id="req-009"></a>
### REQ-009: Finish and review a run

Clearing the final room while alive produces a win. Health at zero or below produces a loss. Scoring follows the game rules. The result screen shows outcome, final health, score, seed, rule options, and highlights: monsters defeated, potions wasted (potions that restored no health, including a potion consumed at 20 health or one discarded as a second potion in the room), rooms explored, and rooms cleared (using the definitions in [REQ-013](#req-013)). A completed result is final; retrying requires starting a fresh run or replay. Reloading preserves the result screen. Each completed run contributes to statistics once, including after repeated reloads or when its result is open in more than one tab; a second tab must not record another outcome for the same run.

## Supporting requirements

<a id="req-010"></a>
### REQ-010: Preserve progress and preferences

Players can close and reopen the game to resume their active run with its room progress and undo intact. Settings and statistics persist between visits. Changing settings does not alter an active run's rules, and removing a saved run does not remove statistics or preferences. Future product updates should preserve progress and preferences created by this game. If saved data cannot be read because it is corrupt or from an unsupported version, or if browser storage is unavailable, the game explains the problem and offers recovery choices instead of failing silently: an unreadable active run can be discarded without being recorded as a run, unreadable settings or statistics can be reset separately, readable data is not overwritten, and the game remains playable for the session with a warning that progress, settings, and statistics will not persist.

<a id="req-011"></a>
### REQ-011: Offer three house-rule choices

Players can change these options before starting a run. Default play follows the game rules.

| Option | Default | Alternative |
| --- | --- | --- |
| Running away from consecutive rooms | Prohibited | Allowed |
| Healing potions per room | One | Unlimited |
| Weapon degradation | On | Off |

With consecutive escapes allowed, running away is never blocked solely by the previous room; the timing and final-room restrictions in [REQ-007](#req-007) still apply. With unlimited potions, every potion heals up to 20 and a potion consumed at 20 health restores 0 and is discarded. With degradation off, an equipped weapon can fight any monster regardless of prior kills; damage remains the positive difference or 0, and the weapon's kill stack is still recorded and discarded when the weapon is replaced. Changing these options does not affect an active run's rules.

<a id="req-012"></a>
### REQ-012: Support language and motion preferences

Players can select English, Simplified Chinese, or automatic language selection based on their browser. Automatic selection uses English when the browser preference does not match a supported language, and the last selected language is remembered. Players can reduce motion through a remembered preference. Animated effects must not be required to understand an action or result.

<a id="req-013"></a>
### REQ-013: Review statistics and recent runs

Statistics show games played, wins, losses, win rate, best score, current streak, and best streak. Games played counts wins plus losses, including abandoned losses; an unfinished active run is not counted. Win rate is wins divided by games played, shown as a whole-number percentage rounded to the nearest percent and shown as "—" before any run is recorded. Best score is the highest score among recorded runs. Recent run history appears newest first and shows each run's seed, rule options, outcome, score, date, and rooms cleared. Dates are stored as UTC ISO 8601 timestamps and displayed in the browser's local time zone as locale-formatted dates. Players can replay a listed dungeon with its original rule options. Keep the newest 50 completed runs, including abandoned losses. When a new entry exceeds that limit, remove the oldest history entry. Trimming history must not change lifetime games played, wins, losses, win rate, best score, current streak, or best streak. An unfinished active run does not occupy a history entry.

An unfinished run is abandoned when it is replaced by a fresh attempt or explicitly discarded. Record it exactly once as a loss, increasing games played and losses and including it in the win-rate calculation. Identify the loss as abandoned in run history. Score it using the normal loss formula at the moment of abandonment: the negative sum of monster values remaining in the draw pile. Ignore remaining health and exclude unresolved room monsters. If no monsters remain in the draw pile, the score is 0; the outcome is still a loss. Include this score in best-score comparisons like any other run. Returning to the title screen, closing the game, or reloading does not abandon a resumable run. Invalid seed entries or shared links that do not start a replacement run do not record a loss.

Streaks count consecutive wins across all runs, including replays and house-rule variants. Both streak counters start at 0. Each win increases the current streak by 1; each loss, including abandonment, resets it to 0. The best streak is the highest current streak ever reached and does not decrease. An unfinished run leaves both counters unchanged. Record each outcome once so reloading or opening the run in another tab cannot increase or reset a streak again. For example, win, win, loss, win produces a current streak of 1 and a best streak of 2.

Room counts are application statistics with these definitions:

- **Rooms explored:** Increase once whenever a new room is dealt, including the starting room and each replacement room dealt after escape. Resuming or undoing the same room does not add another explored room.
- **Rooms cleared:** Increase once when the required cards have been resolved while the player is alive: three cards in a normal room, or every card in the final room. Pressing Enter Next Room is not required for this count.
- **Escape:** The escaped room remains explored but is not cleared. Its replacement adds one explored room, even if some of its cards have been seen before.
- **Undo:** Restore room-start counters according to [REQ-008](#req-008). Undoing a cleared room removes that room's cleared count; clearing it again adds it once. The current room remains explored.
- **Death:** The room where the player dies is explored but not cleared, even if the lethal action resolves its last required card.

For example, clearing the first room, escaping the second, and dying in the third produces 3 rooms explored and 1 room cleared.

<a id="req-014"></a>
### REQ-014: Share and replay a dungeon

Players can enter a seed or copy a replay link from the result screen. A seed identifies the starting dungeon. A replay link includes both the seed and rule options, so another player can begin the same challenge. It starts a fresh attempt rather than copying moves or current progress. Entering a seed alone uses the recipient's selected rule options. Fresh attempts follow the replacement policy in [REQ-001](#req-001). Invalid seed or link input shows an explanation and leaves the active run and statistics unchanged.

<a id="req-015"></a>
### REQ-015: Learn through contextual help

Contextual help explains card types, damage previews, weapon degradation, and run-away restrictions. Players can learn without completing a linear tutorial. About provides condensed rules, credits, and links to the original rules and project.

<a id="req-016"></a>
### REQ-016: Support desktop and mobile play

Support the current and previous major versions of Chrome, Edge, Firefox, and Safari on desktop, and current iOS Safari and Android Chrome on mobile. Chromium-based browsers and Safari are the primary verification targets; Firefox gets a complete-flow smoke check. Critical game information and controls remain legible on desktop and small mobile screens, with touch targets at least 24×24 CSS px and at least 44×44 CSS px for primary card and action controls.

<a id="req-017"></a>
### REQ-017: Support keyboard navigation and basic accessibility

Players can navigate cards, actions, screens, and contextual help with the keyboard, with visible focus and no keyboard traps. Use semantic controls, descriptive labels and card information, readable contrast, and basic screen-reader support. Text and essential interface boundaries meet WCAG 2.2 AA contrast: at least 4.5:1 for normal text and 3:1 for large text and essential UI boundaries. Contextual explanations are also available with pointer and touch input. Keyboard navigation and these basic practices are in scope for the initial release. Formal accessibility audits, conformance certification, and extensive screen-reader testing are lower-priority follow-up work and do not block the initial release.

## Product decisions

<a id="dec-001"></a>
### DEC-001: Visual identity

The product uses a modern RPG style with a dark dungeon-crawler atmosphere. The current 44 card illustrations in [assets](../assets/) define the deck's visual identity. [assets-old](../assets-old/) preserves the earlier artwork for reference. The design plan specifies how the interface presents this direction.

<a id="dec-002"></a>
### DEC-002: Core scope boundaries

The following are outside the core product:

- Real-time multiplayer, online leaderboards, daily challenges, accounts, and cross-device save synchronization.
- Per-action undo, undo across previous rooms, or full-run rewind.
- Additional scoring or deck variants and difficulty presets beyond the three house-rule options.
- A required linear tutorial, audio, or detailed gameplay analytics beyond the listed statistics and run highlights.

<a id="dec-003"></a>
### DEC-003: Fresh release

Define save, preference, seed, and replay-link formats for this product. Data import and compatibility work are outside scope. Preserve data created by this game as described in [REQ-010](#req-010).

<a id="product-acceptance"></a>
## Product acceptance

All requirements above are in scope. The following checks group the outcomes needed for the core product to be ready.

<a id="ac-001"></a>
### AC-001: Complete a default run

A player can start, play, and finish a default run with correct room transitions, final-room behavior, combat, and scoring. Covers [REQ-001](#req-001), [REQ-002](#req-002), [REQ-003](#req-003), [REQ-007](#req-007), and [REQ-009](#req-009).

<a id="ac-002"></a>
### AC-002: Trust decisions and continuity

Previews explain confirmed outcomes; undo and save/resume restore the expected room without losing progress. Unreadable or unsupported saved data and unavailable storage produce understandable recovery choices rather than an unusable or silently erased state. Covers [REQ-004](#req-004), [REQ-005](#req-005), [REQ-006](#req-006), [REQ-008](#req-008), and [REQ-010](#req-010).

<a id="ac-003"></a>
### AC-003: Review and reproduce runs

Results are final, with undo unavailable after a win or loss, and survive reloads without duplicate statistics. History replays and shared links start the intended dungeon with the intended rules. Invalid seed or link input is explained without changing the active run or statistics. Covers [REQ-009](#req-009), [REQ-013](#req-013), and [REQ-014](#req-014).

<a id="ac-004"></a>
### AC-004: Respect preferences

All house-rule choices work as described without changing an active run's rules. Language and motion preferences persist. Covers [REQ-010](#req-010), [REQ-011](#req-011), and [REQ-012](#req-012).

<a id="ac-005"></a>
### AC-005: Play and learn across devices and access needs

The complete play flow and contextual help work with keyboard and touch in the target browsers, with visible focus, semantic controls, descriptive labels, legible information in both supported languages, the contrast and target-size thresholds in [REQ-016](#req-016) and [REQ-017](#req-017), and the visual identity approved under the design plan's approval gate. Review basic accessibility; formal audits and extensive screen-reader testing are not initial-release gates. Covers [REQ-012](#req-012), [REQ-015](#req-015), [REQ-016](#req-016), [REQ-017](#req-017), and [DEC-001](#dec-001).
