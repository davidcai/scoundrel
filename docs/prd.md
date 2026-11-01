# Scoundrel product requirements

## How to use this document

Each labeled item has a stable ID and link anchor. Use the ID when referencing a requirement or decision. Keep IDs when editing or moving an item; retire an ID rather than reusing it for a different meaning.

<a id="info-001"></a>
### INFO-001: Product and sources

Scoundrel is a single-player dungeon-crawling card game for the web. This PRD draws on the player-facing requirements in `main`'s `docs/spec.md` and the prior product and design plan on this branch.

<a id="info-002"></a>
### INFO-002: Document authority

This PRD defines product goals, scope, and acceptance outcomes. The [game rules](rules.md) are authoritative for default gameplay and scoring. The [design plan](design-plan.md) specifies presentation decisions that satisfy the PRD. It references requirements here rather than maintaining a second feature list. The current rules and PRD supersede older specification choices, including English-only support and artwork limited to backdrops.

## Product goals

<a id="goal-001"></a>
### GOAL-001: Start and learn easily

New players can start a strategic solo game without a physical deck and learn through understandable choices and contextual help.

<a id="goal-002"></a>
### GOAL-002: Return and replay

Returning players can resume unfinished runs, review their progress, replay a dungeon, and share a challenge with friends.

<a id="goal-003"></a>
### GOAL-003: Make the full game accessible

Players using a keyboard, screen reader, or small touchscreen can complete the same game as other players.

## Core requirements

<a id="req-001"></a>
### REQ-001: Start and resume

The title screen offers New Run, Enter Seed, Stats, Settings, and About. Continue is prominent when an unfinished saved run exists. Returning players choose when to resume rather than being placed directly into a run. New Run starts a shuffled dungeon using the player's selected rule options.

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

Running away returns the room's cards to the bottom of the dungeon and deals another room. Default play prohibits running away from consecutive rooms. Running away is always unavailable in the final room, including when the consecutive-room restriction is turned off.

<a id="req-008"></a>
### REQ-008: Retry the current room

Undo to Room Start restores the current room's starting health, equipment, defeated monsters, cards, and potion allowance. It restores the same room rather than generating another dungeon. Undo remains available after resuming a saved run. Entering the next room ends the opportunity to undo the previous room.

<a id="req-009"></a>
### REQ-009: Finish and review a run

Clearing the final room while alive produces a win. Health at zero or below produces a loss. Scoring follows the game rules. The result screen shows outcome, final health, score, seed, rule options, and highlights such as monsters defeated, potions wasted, and rooms explored. Reloading preserves the result screen. Each completed run contributes to statistics once, including after repeated reloads.

## Supporting requirements

<a id="req-010"></a>
### REQ-010: Preserve progress and preferences

Players can close and reopen the game to resume their active run with its room progress and undo intact. Settings and statistics persist between visits. Changing settings does not alter an active run's rules, and removing a saved run does not remove statistics or preferences. Product updates should preserve existing player progress and preferences.

<a id="req-011"></a>
### REQ-011: Offer three house-rule choices

Players can change these options before starting a run. Default play follows the game rules.

| Option | Default | Alternative |
| --- | --- | --- |
| Running away from consecutive rooms | Prohibited | Allowed |
| Healing potions per room | One | Unlimited |
| Weapon degradation | On | Off |

<a id="req-012"></a>
### REQ-012: Support language and motion preferences

Players can select English, Simplified Chinese, or automatic language selection based on their browser. Players can reduce motion through a remembered preference. Animated effects must not be required to understand an action or result.

<a id="req-013"></a>
### REQ-013: Review statistics and recent runs

Statistics show games played, wins, losses, win rate, best score, current streak, and best streak. Recent run history appears newest first and shows each run's seed, rule options, outcome, score, date, and rooms cleared. Players can replay a listed dungeon with its original rule options. History is a bounded collection of recent runs; lifetime totals remain useful beyond that collection.

<a id="req-014"></a>
### REQ-014: Share and replay a dungeon

Players can enter a seed or copy a replay link from the result screen. A seed identifies the starting dungeon. A replay link includes both the seed and rule options, so another player can begin the same challenge. It starts a fresh attempt rather than copying moves or current progress. Entering a seed alone uses the recipient's selected rule options.

<a id="req-015"></a>
### REQ-015: Learn through contextual help

Contextual help explains card types, damage previews, weapon degradation, and run-away restrictions. Players can learn without completing a linear tutorial. About provides condensed rules, credits, and links to the original rules and project.

<a id="req-016"></a>
### REQ-016: Support desktop and mobile play

Critical game information and controls remain legible on desktop and small mobile screens, with usable touch targets and sufficient contrast.

<a id="req-017"></a>
### REQ-017: Support keyboard and screen-reader play

Every card, action, and contextual explanation is accessible with a keyboard and has visible focus. Screen-reader users receive descriptive card information and announcements for meaningful changes, including combat, potion use, blocked actions, and run outcomes. Contextual explanations are also available with pointer and touch input.

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

## Product acceptance

All requirements above are in scope. The following checks group the outcomes needed for the core product to be ready.

<a id="ac-001"></a>
### AC-001: Complete a default run

A player can start, play, and finish a default run with correct room transitions, final-room behavior, combat, and scoring. Covers [REQ-001](#req-001), [REQ-002](#req-002), [REQ-003](#req-003), [REQ-007](#req-007), and [REQ-009](#req-009).

<a id="ac-002"></a>
### AC-002: Trust decisions and continuity

Previews explain confirmed outcomes; undo and save/resume restore the expected room without losing progress. Covers [REQ-004](#req-004), [REQ-005](#req-005), [REQ-006](#req-006), [REQ-008](#req-008), and [REQ-010](#req-010).

<a id="ac-003"></a>
### AC-003: Review and reproduce runs

Results survive reloads without duplicate statistics. History replays and shared links start the intended dungeon with the intended rules. Covers [REQ-009](#req-009), [REQ-013](#req-013), and [REQ-014](#req-014).

<a id="ac-004"></a>
### AC-004: Respect preferences

All house-rule choices work as described without changing an active run's rules. Language and motion preferences persist. Covers [REQ-010](#req-010), [REQ-011](#req-011), and [REQ-012](#req-012).

<a id="ac-005"></a>
### AC-005: Play and learn across devices and access needs

The complete play flow and contextual help work with keyboard, screen reader, and touch, with legible information in both supported languages and the agreed visual identity. Covers [REQ-012](#req-012), [REQ-015](#req-015), [REQ-016](#req-016), [REQ-017](#req-017), and [DEC-001](#dec-001).
