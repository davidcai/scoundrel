import { buildDeck } from './deck';
import { createGame, drinkPotion, equipWeapon, fightMonster, getKind } from './game';
import type { GameState, Suit } from './types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

function main(): void {
  // ---------------------------------------------------------------------------
  // buildDeck checks: 44 cards, 13 clubs / 13 spades / 9 diamonds / 9 hearts,
  // and NO hearts/diamonds with rank >= 11.
  // ---------------------------------------------------------------------------
  const deck = buildDeck();
  assert(deck.length === 44, `deck length ${deck.length} !== 44`);
  const countBySuit: Record<Suit, number> = { clubs: 0, spades: 0, diamonds: 0, hearts: 0 };
  for (const card of deck) {
    countBySuit[card.suit] += 1;
    if ((card.suit === 'hearts' || card.suit === 'diamonds') && card.rank >= 11) {
      throw new Error(`Red face card (rank >= 11) present in deck: ${card.id}`);
    }
  }
  assert(countBySuit.clubs === 13, `clubs count ${countBySuit.clubs} !== 13`);
  assert(countBySuit.spades === 13, `spades count ${countBySuit.spades} !== 13`);
  assert(countBySuit.diamonds === 9, `diamonds count ${countBySuit.diamonds} !== 9`);
  assert(countBySuit.hearts === 9, `hearts count ${countBySuit.hearts} !== 9`);
  console.log(
    `buildDeck: 44 cards (clubs=${countBySuit.clubs}, spades=${countBySuit.spades}, diamonds=${countBySuit.diamonds}, hearts=${countBySuit.hearts}); no red face cards. OK`,
  );

  // ---------------------------------------------------------------------------
  // createGame(42): initial state checks.
  // ---------------------------------------------------------------------------
  const g42 = createGame(42);
  assert(g42.room.length === 4, `room length ${g42.room.length} !== 4`);
  assert(g42.status === 'playing', `status ${g42.status} !== 'playing'`);
  assert(g42.health === 20, `health ${g42.health} !== 20`);
  assert(g42.deckCount === 40, `deckCount ${g42.deckCount} !== 40 after dealing 4`);
  console.log(`createGame(42): room=[${g42.room.map((c) => c.id).join(', ')}] status=${g42.status} health=${g42.health} deckCount=${g42.deckCount}. OK`);

  // ---------------------------------------------------------------------------
  // Deterministic action checks: find a seed whose first room contains BOTH a
  // weapon and a monster, then equip the weapon and fight the monster barehanded.
  // ---------------------------------------------------------------------------
  let actionSeed = -1;
  for (let seed = 1; seed <= 200; seed++) {
    const s = createGame(seed);
    if (
      s.room.some((c) => getKind(c) === 'weapon') &&
      s.room.some((c) => getKind(c) === 'monster')
    ) {
      actionSeed = seed;
      break;
    }
  }
  assert(actionSeed !== -1, 'no seed found with a weapon and monster in the first room');

  const g = createGame(actionSeed);
  console.log(`Deterministic actions (seed ${actionSeed}): room=[${g.room.map((c) => c.id).join(', ')}]`);

  const weaponCard = g.room.find((c) => getKind(c) === 'weapon')!;
  const gEquipped = equipWeapon(g, weaponCard.id);
  assert(gEquipped.equippedWeapon !== null, 'weapon not equipped');
  assert(gEquipped.equippedWeapon!.card.id === weaponCard.id, 'wrong weapon equipped');
  assert(gEquipped.resolvedThisRoom === 1, `resolvedThisRoom ${gEquipped.resolvedThisRoom} !== 1 after equip`);
  console.log(`equipWeapon(${weaponCard.id}): equipped, resolvedThisRoom=${gEquipped.resolvedThisRoom}`);

  const monsterCard = gEquipped.room.find((c) => getKind(c) === 'monster')!;
  const healthBefore = gEquipped.health;
  const gFought = fightMonster(gEquipped, monsterCard.id, 'barehanded');
  assert(gFought.health === healthBefore - monsterCard.value, 'health did not drop by the monster value');
  assert(gFought.resolvedThisRoom === 2, `resolvedThisRoom ${gFought.resolvedThisRoom} !== 2 after fight`);
  console.log(
    `fightMonster(${monsterCard.id}, barehanded): health ${healthBefore} -> ${gFought.health}, resolvedThisRoom=${gFought.resolvedThisRoom}`,
  );

  // Original state must be untouched (pure actions).
  assert(g.room.some((c) => c.id === weaponCard.id), 'input state was mutated by equipWeapon');

  // ---------------------------------------------------------------------------
  // Auto-play (seed 123): always fight the lowest-value monster barehanded;
  // if no monster is present, resolve a weapon (equip) or a potion (drink) so
  // the game reaches a terminal state. Invariants checked on every step.
  // ---------------------------------------------------------------------------
  let s: GameState = createGame(123);
  let guard = 0;
  while (s.status === 'playing') {
    guard++;
    if (guard > 2000) throw new Error('auto-play did not terminate');
    assert(s.health <= s.maxHealth, `health ${s.health} exceeds maxHealth ${s.maxHealth}`);
    assert(s.room.length > 0, 'room is empty during auto-play');

    const monsters = s.room.filter((c) => getKind(c) === 'monster');
    if (monsters.length > 0) {
      monsters.sort((a, b) => a.value - b.value);
      s = fightMonster(s, monsters[0].id, 'barehanded');
    } else {
      const weapon = s.room.find((c) => getKind(c) === 'weapon');
      if (weapon) {
        s = equipWeapon(s, weapon.id);
      } else {
        const potion = s.room.find((c) => getKind(c) === 'potion');
        if (potion) {
          s = drinkPotion(s, potion.id);
        } else {
          throw new Error('room has no resolvable cards');
        }
      }
    }
  }

  assert(s.status === 'won' || s.status === 'lost', `terminal status ${s.status} invalid`);
  if (s.score === null) throw new Error('final score is null');
  const finalScore = s.score;
  if (s.status === 'won') {
    assert(finalScore === s.health, `win score ${finalScore} !== health ${s.health}`);
    console.log(`Auto-play (seed 123): WON with score ${finalScore}`);
  } else {
    assert(finalScore < 0, `loss score ${finalScore} is not negative`);
    console.log(`Auto-play (seed 123): LOST with score ${finalScore} (deck monsters + room monsters = ${-finalScore})`);
  }

  console.log('SMOKE TEST PASSED');
}

main();
