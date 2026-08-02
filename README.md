# Scoundrel card game

A complete browser version of **Scoundrel**, the one-player roguelike card game. Explore a 44-card dungeon, fight monsters, equip degrading weapons, use potions, and try to escape with your health intact.

The gameplay behavior follows [`docs/rules.md`](docs/rules.md), which remains the source of truth.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open the local address shown in the terminal.

## Checks

```bash
npm run build
npm test
```

## How to play

- Resolve three cards in every four-card room; the fourth carries forward.
- Clubs and spades are monsters. Fight them barehanded or with a diamond weapon.
- A weapon can only fight monsters lower than its previous kill.
- Hearts restore health, but only one potion heals in each room.
- Run before resolving a card, but never from two rooms in a row.
- Clear the entire Dungeon to win.
