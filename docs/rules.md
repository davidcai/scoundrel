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

1. Deal: Flip the top 4 cards from the Dungeon face up to form a Room.
2. Resolve: You must interact with and resolve 3 of the 4 cards in any order you choose. The 4th remaining card carries over into the next room.
3. Running Away: Once per turn, if you choose not to face a room, you can send all 4 cards to the bottom of the Dungeon deck and deal a new room of 4 cards. You cannot run from two rooms in a row.

## Combat & Item Rules

- Fighting Barehanded: Take damage equal to the full value of the monster.
- Fighting with a Weapon: Equip a Diamond card. Subtract the weapon's value from the monster's value; you take the remaining difference as damage. The monster card is placed on top of your weapon.
- Weapon Degradation: After a weapon defeats a monster, it can only fight subsequent monsters that have a lower value than the last monster it killed. If a stronger monster appears, you must either find a new weapon, switch weapons (picking up a new Diamond automatically discards your old weapon), or fight barehanded.
- Health Potions: You may only drink one health potion per room. A second potion you drink in the same room is discarded and restores nothing. A Heart you leave un-resolved (such as the carried 4th card) is not discarded — it carries into the next room, and the one-potion limit resets each room.

## Winning and Losing

- Winning: Successfully clear and navigate through every room of the dungeon until the deck is empty. Your final score is your remaining health (maximum of 20).
- Losing: If your health drops to 0 or below, you are defeated. Your final negative score is calculated by subtracting the values of all remaining unplayed monsters left in the dungeon deck from 0.

## References

- [http://stfj.net/art/2011/Scoundrel.pdf](http://stfj.net/art/2011/Scoundrel.pdf#:~:text=Scoundrel%20is%20played%20with%20a%20standard%20deck,Aces.%20Place%20them%20off%20to%20the%20sid)

- [https://community.arduboy.com/t/scoundrel/13085](https://community.arduboy.com/t/scoundrel/13085)
- [https://rpdillon.net/scoundrel.html](https://rpdillon.net/scoundrel.html#:~:text=A%20standard%2052%2Dcard%20deck%20is%20used%2C%20with,The%20goal%20of%20the%20game%20is%20to)
