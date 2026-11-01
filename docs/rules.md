# Scoundrel Rule Set

Scoundrel is a popular 1-player roguelike dungeon-crawling card game. Played with a standard deck, you navigate rooms, fight monsters, equip weapons, and manage health to survive the dungeon.

## Setup & Card Values

- The Deck: Take a standard 52-card deck and remove both Jokers, all red face cards (Jack, Queen, King of Hearts and Diamonds), and both red Aces. You are left with 44 cards. Shuffle them face down into a draw pile called the Dungeon.
- Health: Start with 20 Health (track this on paper, with dice, or using extra cards). Health can never go above 20.
- Card Values: Number cards equal their face value. Jacks are 11, Queens are 12, Kings are 13, and Aces are 14.

## Card Meanings

- Clubs & Spades (Monsters): Inflict damage equal to their numerical value.
- Diamonds (Weapons): Used to attack monsters. Their strength equals their number value (2–10).
- Hearts (Health Potions): Restores health equal to the card's value, capped at 20.

## Playing a Room

1. Deal: Flip cards from the Dungeon face up until the Room contains 4 cards, including any carried card. If fewer cards remain, deal all of them. Once the Dungeon draw pile is empty after dealing, this is the final room.
2. Resolve: Resolve 3 of the 4 cards in any order you choose. The 4th remaining card carries over into the next room. In the final room, resolve every remaining card with no carryover, even if only one card remains.
3. Running Away: Only before resolving the first card in a room, if you choose not to face it, you can send all 4 cards to the bottom of the Dungeon deck as one block, preserving their current left-to-right order (the leftmost card is dealt again first among them), and deal a new room of 4 cards. The authors' rulesheet does not specify a return order; this rule makes the result deterministic. Selecting or previewing a card does not count as resolving it. You cannot run from two rooms in a row. You cannot run away from the final room. Its cards are the last in the Dungeon, so escaping would deal the same room again; the final room must be resolved.

## Combat & Item Rules

- Fighting Barehanded: Take damage equal to the full value of the monster.
- Fighting with a Weapon: Equip a Diamond card. Subtract the weapon's value from the monster's value; you take the remaining difference as damage, with a minimum of 0. A weapon stronger than the monster causes no damage to the player and does not restore health. The monster card is placed on top of your weapon.
- Weapon Degradation: After a weapon defeats a monster, it can only fight subsequent monsters that have a lower value than the last monster it killed; a monster with equal or greater value is ineligible. If such a monster appears, you must either find a new weapon, switch weapons (picking up a new Diamond automatically discards your old weapon), or fight barehanded.
- Health Potions: You may only drink one health potion per room. A second potion you drink in the same room is discarded and restores nothing. A Heart you leave un-resolved (such as the carried 4th card) is not discarded — it carries into the next room, and the one-potion limit resets each room. A potion counts as wasted when it restores no health: one consumed at 20 health, or one discarded as a second potion in the room.

## Winning and Losing

- Winning: Successfully resolve every card in the final room while still alive. An empty Dungeon draw pile alone does not count as a win. Your final score is your remaining health (maximum of 20).
- Losing: If your health drops to 0 or below, you are defeated. Your final score is the negative sum of the values of all monsters remaining in the Dungeon draw pile. The Dungeon is the face-down draw pile; face-up room cards, including the carried fourth card, are not in the Dungeon and are not counted. This follows the authors' 2011 rulesheet, which counts all remaining monsters in the Dungeon.

## References

- [http://stfj.net/art/2011/Scoundrel.pdf](http://stfj.net/art/2011/Scoundrel.pdf#:~:text=Scoundrel%20is%20played%20with%20a%20standard%20deck,Aces.%20Place%20them%20off%20to%20the%20sid)

- [https://community.arduboy.com/t/scoundrel/13085](https://community.arduboy.com/t/scoundrel/13085)
- [https://rpdillon.net/scoundrel.html](https://rpdillon.net/scoundrel.html#:~:text=A%20standard%2052%2Dcard%20deck%20is%20used%2C%20with,The%20goal%20of%20the%20game%20is%20to)
- [Copy of the 2011 rulesheet](https://aiscoundrel.com/Scoundrel.pdf)
