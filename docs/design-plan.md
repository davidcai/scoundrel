# Scoundrel product and design plan

## Product goal

Scoundrel is a single-player dungeon-crawling card game for the web. It should make a short, strategic game easy to start and learn, while handling the bookkeeping of rooms, combat, health, and scoring. Players should be able to return to an unfinished run and share a reproducible dungeon with friends.

The default game follows [the Scoundrel rules](rules.md). The rules document is the source of truth for gameplay. The decisions below describe the intended player experience and clarify how the game presents those rules.

## Game experience

The player starts with 20 health and works through a 44-card dungeon. Each room presents up to four cards. Monsters inflict damage, weapons reduce it, and potions restore health. Players choose the order in which to resolve cards and which card to carry forward. The game ends when the dungeon is cleared or health drops to zero or below.

The game should make each decision understandable before the player commits:

- Selecting a monster shows the expected damage and asks for confirmation. A player with a weapon can still choose to fight barehanded.
- The weapon and its defeated monsters appear as a visible stack, with the most recently defeated monster on top. The weapon appears to the left of the stack. The display explains that a used weapon can only fight a weaker monster than its last kill.
- Equipping a new weapon discards the old weapon and its defeated-monster stack. The game announces the discard.
- A carried card is visually distinguished in the next room. An unresolved potion can be carried normally, and the potion limit resets in the new room.
- The player explicitly enters the next room after resolving the required cards. In the final room, every remaining card must be resolved, including a lone card.
- Running away is unavailable in the final room. Whenever the action is unavailable, the game explains why.

Players can undo the current room back to its start, including health, equipment, cards, and potion use. Entering the next room ends the opportunity to undo the previous room.

## Screens and flow

The title screen offers New Run, Continue when a saved run exists, Enter Seed, Stats, Settings, and About. Returning players land on the title screen and can choose whether to continue. The About screen gives a condensed rules summary, credits, and links to the original rules and project.

During a run, the play screen keeps health, remaining dungeon cards, equipment, the ability to run away, and the run's seed visible and legible. Players can use contextual explanations to learn card types, combat, weapon degradation, and running away. The design uses tooltips rather than a required linear tutorial.

At the end of a run, a scorecard shows the outcome, health, score, seed, selected rule options, and highlights such as monsters defeated, potions wasted, and rooms explored. Players can copy a link that lets someone start the same dungeon with the same rule options. A completed scorecard remains available after a page reload.

## Progress, settings, and sharing

- Save the active run so players can resume after closing the game.
- Offer three optional house-rule controls: allow or prohibit running away from consecutive rooms; limit potions to one per room or allow unlimited potions; and turn weapon degradation on or off. Their defaults follow the rules.
- Remember settings between visits without changing an active run's rules. Offer English, Simplified Chinese, and automatic language selection based on the browser.
- Show games played, wins, losses, win rate, best score, current streak, and best streak. A recent run history shows the seed, rule options, outcome, score, date, and rooms cleared, with an option to replay a dungeon.
- Let a player enter a seed to reproduce a dungeon using their selected rule options. A shareable link includes both the seed and rule options, so others can start the same dungeon without exchanging moves.

## Visual direction

The game should feel like a modern RPG with a dark dungeon-crawler mood. Use crisp typography, depth, shadow, and strong contrast to create a mysterious, adventurous atmosphere while keeping game information easy to read. The current card artwork in [assets](../assets/) supplies the visual identity of the deck. The earlier artwork is preserved in [assets-old](../assets-old/) for reference.

The original design plan prioritized a visual style guide, title screen, and play screen first. Stats, settings, and the end-of-run scorecard followed, using the same visual language.

## Accessibility and devices

The game should work with a keyboard as well as pointer and touch input. Cards and actions need descriptive accessible labels, visible focus, and screen-reader announcements for meaningful events such as combat, potions, and the end of a run. The interface should remain legible with sufficient contrast, and card targets should be usable on small touchscreens. A reduced-motion setting gives players control over animated effects.

## Boundaries

The product is single-player. Real-time multiplayer, online leaderboards, daily challenges, audio, multi-room or per-action undo, and additional rule variants beyond the three controls above were outside the original scope. These are possible future product decisions rather than requirements for the core game.
