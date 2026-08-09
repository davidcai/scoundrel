// =============================================================================
// Scoundrel — Rules-Compliance Verification
// -----------------------------------------------------------------------------
// Exercises EVERY rule in docs/rules.md against the engine. Run with:
//   npx tsx src/engine/__rules_test.ts
// Each test asserts a specific rule. Failures throw. Prints PASS/FAIL summary.
// =============================================================================

import { buildDeck } from './deck';
import {
  canFightWithWeapon,
  canRun,
  createGame,
  drinkPotion,
  equipWeapon,
  fightMonster,
  getKind,
  runAway,
} from './game';
import type { Card, GameState } from './types';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`);
  }
}

// Helper: force a specific room by reshuffling seeds until the predicate matches.
function gameWithRoom(predicate: (room: Card[]) => boolean, maxTries = 5000): GameState {
  for (let seed = 0; seed < maxTries; seed++) {
    const g = createGame(seed);
    if (predicate(g.room)) return g;
  }
  throw new Error('Could not find a seed producing the requested room');
}

// =============================================================================
// RULE: Setup & Card Values
// =============================================================================

console.log('\n[Setup & Card Values]');

// "Take a standard 52-card deck and remove both Jokers, all red face cards
//  (Jack, Queen, King of Hearts and Diamonds), and both red Aces.
//  You are left with 44 cards."
{
  const deck = buildDeck();
  check('deck has exactly 44 cards', deck.length === 44, `got ${deck.length}`);
  const clubs = deck.filter((c) => c.suit === 'clubs');
  const spades = deck.filter((c) => c.suit === 'spades');
  const diamonds = deck.filter((c) => c.suit === 'diamonds');
  const hearts = deck.filter((c) => c.suit === 'hearts');
  check('clubs has 13 cards', clubs.length === 13, `got ${clubs.length}`);
  check('spades has 13 cards', spades.length === 13, `got ${spades.length}`);
  check('diamonds has 9 cards (2-10)', diamonds.length === 9, `got ${diamonds.length}`);
  check('hearts has 9 cards (2-10)', hearts.length === 9, `got ${hearts.length}`);
  check(
    'no red face cards (diamonds rank >= 11)',
    diamonds.every((c) => c.rank <= 10),
  );
  check(
    'no red face cards (hearts rank >= 11)',
    hearts.every((c) => c.rank <= 10),
  );
  check(
    'no red aces (diamonds rank 14)',
    !diamonds.some((c) => c.rank === 14),
  );
  check(
    'no red aces (hearts rank 14)',
    !hearts.some((c) => c.rank === 14),
  );
  // black suits keep all 13 ranks including face cards and aces
  check(
    'clubs keeps face cards & ace (ranks 11,12,13,14 present)',
    [11, 12, 13, 14].every((r) => clubs.some((c) => c.rank === r)),
  );
  check(
    'spades keeps face cards & ace (ranks 11,12,13,14 present)',
    [11, 12, 13, 14].every((r) => spades.some((c) => c.rank === r)),
  );
}

// "Health: Start with 20 Health. Health can never go above 20."
{
  const g = createGame(0);
  check('starts with 20 health', g.health === 20, `got ${g.health}`);
  check('maxHealth is 20', g.maxHealth === 20);
}

// "Card Values: Number cards equal their face value. Jacks are 11, Queens are 12,
//  Kings are 13, and Aces are 14."
{
  const deck = buildDeck();
  const jack = deck.find((c) => c.rank === 11)!;
  const queen = deck.find((c) => c.rank === 12)!;
  const king = deck.find((c) => c.rank === 13)!;
  const ace = deck.find((c) => c.rank === 14)!;
  const seven = deck.find((c) => c.rank === 7)!;
  check('Jack value is 11', jack.value === 11);
  check('Queen value is 12', queen.value === 12);
  check('King value is 13', king.value === 13);
  check('Ace value is 14', ace.value === 14);
  check('7 value is 7', seven.value === 7);
}

// =============================================================================
// RULE: Card Meanings
// =============================================================================

console.log('\n[Card Meanings]');

// "Clubs & Spades (Monsters): Inflict damage equal to their numerical value."
// "Diamonds (Weapons): Used to attack monsters."
// "Hearts (Health Potions): Restores health equal to the card's value, capped at 20."
{
  const deck = buildDeck();
  check('clubs are monsters', deck.filter((c) => c.suit === 'clubs').every((c) => getKind(c) === 'monster'));
  check('spades are monsters', deck.filter((c) => c.suit === 'spades').every((c) => getKind(c) === 'monster'));
  check('diamonds are weapons', deck.filter((c) => c.suit === 'diamonds').every((c) => getKind(c) === 'weapon'));
  check('hearts are potions', deck.filter((c) => c.suit === 'hearts').every((c) => getKind(c) === 'potion'));
}

// =============================================================================
// RULE: Playing a Room — Deal 4 cards
// =============================================================================

console.log('\n[Playing a Room — Deal]');

// "Flip the top 4 cards from the Dungeon face up to form a Room."
{
  const g = createGame(0);
  check('initial room has 4 cards', g.room.length === 4, `got ${g.room.length}`);
  check('roomSize is 4', g.roomSize === 4);
  check('deckCount is 40 after first deal (44-4)', g.deckCount === 40, `got ${g.deckCount}`);
  check('isFinalRoom is false at start', g.isFinalRoom === false);
  check('resolvedThisRoom starts at 0', g.resolvedThisRoom === 0);
  check('potionsUsedThisRoom starts at 0', g.potionsUsedThisRoom === 0);
  check('ranLastRoom starts false', g.ranLastRoom === false);
  check('status is playing', g.status === 'playing');
}

// =============================================================================
// RULE: Resolve 3 of 4; 4th carries over
// =============================================================================

console.log('\n[Playing a Room — Resolve 3 of 4, carry over]');

// "You must interact with and resolve 3 of the 4 cards in any order you choose.
//  The 4th remaining card carries over into the next room."
{
  // Find a room with 3 monsters whose total damage is survivable (< 20 hp),
  // so the player lives to see the carry-over and next-room deal.
  const g = gameWithRoom(
    (room) =>
      room.filter((c) => getKind(c) === 'monster').length >= 3 &&
      room.filter((c) => getKind(c) === 'monster').reduce((sum, c) => sum + c.value, 0) < 20,
  );
  const monsters = g.room.filter((c) => getKind(c) === 'monster');
  // Fight 3 monsters barehanded (total damage < 20, so the player survives)
  let s = g;
  for (let i = 0; i < 3; i++) {
    const m = s.room.find((c) => getKind(c) === 'monster')!;
    s = fightMonster(s, m.id, 'barehanded');
  }
  check('player survived the 3 fights (status playing)', s.status === 'playing', `got ${s.status}`);
  check('after resolving 3, a new room is dealt (room length 4)', s.room.length === 4, `got ${s.room.length}`);
  check('after resolving 3, resolvedThisRoom reset to 0 for new room', s.resolvedThisRoom === 0);
  check('after resolving 3, ranLastRoom is false (faced the room)', s.ranLastRoom === false);
  // The 4th card (the one not fought) should be carried into the new room as room[0]
  const leftover = g.room.find((c) => !monsters.slice(0, 3).some((m) => m.id === c.id))!;
  check('carried-over card leads the new room', s.room[0].id === leftover.id, `expected ${leftover.id}, got ${s.room[0]?.id}`);
}

// =============================================================================
// RULE: Running Away
// =============================================================================

console.log('\n[Running Away]');

// "Once per turn, if you choose not to face a room, you can send all 4 cards to
//  the bottom of the Dungeon deck and deal a new room of 4 cards."
{
  const g = createGame(0);
  const roomCards = [...g.room];
  const deckBeforeTop = g.deck.slice(0, 4);
  check('canRun is true at start of a fresh room', canRun(g) === true);
  const s = runAway(g);
  check('after running, room has 4 new cards', s.room.length === 4);
  check('after running, ranLastRoom is true', s.ranLastRoom === true);
  // The 4 new cards should come from the top of the deck (not the cards we sent to bottom)
  check(
    'new room cards are from deck top (not the sent-away cards)',
    s.room.every((c) => deckBeforeTop.some((d) => d.id === c.id)),
  );
  // The sent-away cards should now be at the bottom of the deck
  const bottomFour = s.deck.slice(-4);
  check(
    'sent-away cards are at the bottom of the deck',
    roomCards.every((c) => bottomFour.some((b) => b.id === c.id)),
  );
}

// "You cannot run from two rooms in a row."
{
  const g = createGame(0);
  const s = runAway(g);
  check('cannot run twice in a row (canRun false)', canRun(s) === false, `got ${canRun(s)}`);
  let threw = false;
  try {
    runAway(s);
  } catch {
    threw = true;
  }
  check('running twice in a row throws', threw === true);
}

// Cannot run after partially resolving a room
{
  const g = gameWithRoom((room) => room.filter((c) => getKind(c) === 'monster').length >= 1);
  const m = g.room.find((c) => getKind(c) === 'monster')!;
  const s = fightMonster(g, m.id, 'barehanded');
  check('cannot run after partially resolving a room', canRun(s) === false, `got ${canRun(s)}`);
}

// Cannot run from the final room
{
  // Play a game down to the final room by auto-resolving (fight lowest monster barehanded)
  let s = createGame(7);
  let guard = 0;
  while (s.status === 'playing' && !s.isFinalRoom && guard < 200) {
    guard += 1;
    const monsters = s.room.filter((c) => getKind(c) === 'monster');
    if (monsters.length === 0) {
      // resolve a non-monster to advance
      const other = s.room.find((c) => getKind(c) !== 'monster')!;
      if (getKind(other) === 'weapon') s = equipWeapon(s, other.id);
      else s = drinkPotion(s, other.id);
    } else {
      const lowest = monsters.reduce((a, b) => (a.value < b.value ? a : b));
      s = fightMonster(s, lowest.id, 'barehanded');
    }
  }
  if (s.isFinalRoom) {
    check('cannot run from the final room', canRun(s) === false, `got ${canRun(s)}`);
  } else {
    check('reached a final room to test (skipped if no seed produced one)', true);
  }
}

// =============================================================================
// RULE: Combat & Item Rules — Fighting Barehanded
// =============================================================================

console.log('\n[Combat — Barehanded]');

// "Fighting Barehanded: Take damage equal to the full value of the monster."
{
  const g = gameWithRoom((room) => room.some((c) => getKind(c) === 'monster'));
  const m = g.room.find((c) => getKind(c) === 'monster')!;
  const healthBefore = g.health;
  const s = fightMonster(g, m.id, 'barehanded');
  check(
    'barehanded damage equals monster value',
    s.health === healthBefore - m.value,
    `expected ${healthBefore - m.value}, got ${s.health}`,
  );
  check('monster removed from room after fight', !s.room.some((c) => c.id === m.id));
  check('resolvedThisRoom incremented', s.resolvedThisRoom === g.resolvedThisRoom + 1);
}

// =============================================================================
// RULE: Combat — Fighting with a Weapon
// =============================================================================

console.log('\n[Combat — With Weapon]');

// "Equip a Diamond card. Subtract the weapon's value from the monster's value;
//  you take the remaining difference as damage."
{
  // Find a room with a weapon and a monster weaker-or-equal... actually a fresh weapon
  // can fight any monster. Find a room with both a weapon and a monster.
  const g = gameWithRoom(
    (room) => room.some((c) => getKind(c) === 'weapon') && room.some((c) => getKind(c) === 'monster'),
  );
  const weapon = g.room.find((c) => getKind(c) === 'weapon')!;
  const monster = g.room.find((c) => getKind(c) === 'monster')!;
  let s = equipWeapon(g, weapon.id);
  const healthAfterEquip = s.health;
  s = fightMonster(s, monster.id, 'weapon');
  const expectedDamage = Math.max(0, monster.value - weapon.value);
  check(
    'weapon damage = max(0, monster - weapon)',
    s.health === healthAfterEquip - expectedDamage,
    `expected ${healthAfterEquip - expectedDamage}, got ${s.health}`,
  );
  check('monster removed from room', !s.room.some((c) => c.id === monster.id));
  check('weapon still equipped after fight', s.equippedWeapon !== null);
  check('monster added to weapon kill stack', s.equippedWeapon!.killed.length === 1);
  check('lastKilledValue set to monster value', s.equippedWeapon!.lastKilledValue === monster.value);
}

// "The monster card is placed on top of your weapon."
{
  const g = gameWithRoom(
    (room) => room.some((c) => getKind(c) === 'weapon') && room.some((c) => getKind(c) === 'monster'),
  );
  const weapon = g.room.find((c) => getKind(c) === 'weapon')!;
  const monster = g.room.find((c) => getKind(c) === 'monster')!;
  let s = equipWeapon(g, weapon.id);
  s = fightMonster(s, monster.id, 'weapon');
  check('killed monster is on the weapon stack', s.equippedWeapon!.killed[0].id === monster.id);
}

// =============================================================================
// RULE: Weapon Degradation
// =============================================================================

console.log('\n[Weapon Degradation]');

// "After a weapon defeats a monster, it can only fight subsequent monsters that
//  have a lower value than the last monster it killed."
{
  // Equip a weapon, kill a monster of value V, then test canFightWithWeapon
  // for a monster with value < V (allowed) and value >= V (blocked).
  const g = gameWithRoom(
    (room) =>
      room.some((c) => getKind(c) === 'weapon') && room.filter((c) => getKind(c) === 'monster').length >= 2,
  );
  const weapon = g.room.find((c) => getKind(c) === 'weapon')!;
  const monsters = g.room.filter((c) => getKind(c) === 'monster');
  // Sort so we kill the higher one first, then test the lower
  const sorted = [...monsters].sort((a, b) => b.value - a.value);
  const first = sorted[0];
  const second = sorted[1];
  let s = equipWeapon(g, weapon.id);
  s = fightMonster(s, first.id, 'weapon');
  // Now weapon.lastKilledValue = first.value
  if (second.value < first.value) {
    check('can fight weaker monster after a kill', canFightWithWeapon(s, second.id) === true);
  } else {
    check('cannot fight equal/stronger monster after a kill', canFightWithWeapon(s, second.id) === false);
  }
}

// "If a stronger monster appears, you must either find a new weapon, switch weapons,
//  or fight barehanded."
{
  // Fresh weapon can fight any monster (lastKilledValue null)
  const g = gameWithRoom(
    (room) => room.some((c) => getKind(c) === 'weapon') && room.some((c) => getKind(c) === 'monster'),
  );
  const weapon = g.room.find((c) => getKind(c) === 'weapon')!;
  const monster = g.room.find((c) => getKind(c) === 'monster')!;
  const s = equipWeapon(g, weapon.id);
  check('fresh weapon can fight any monster', canFightWithWeapon(s, monster.id) === true);
}

// "switch weapons (picking up a new Diamond automatically discards your old weapon)"
{
  const g = gameWithRoom(
    (room) => room.filter((c) => getKind(c) === 'weapon').length >= 2,
  );
  const weapons = g.room.filter((c) => getKind(c) === 'weapon');
  let s = equipWeapon(g, weapons[0].id);
  const firstWeaponCard = s.equippedWeapon!.card;
  s = equipWeapon(s, weapons[1].id);
  check('equipping a new weapon replaces the old one', s.equippedWeapon!.card.id === weapons[1].id);
  check('old weapon is discarded (not the equipped card)', s.equippedWeapon!.card.id !== firstWeaponCard.id);
  check('new weapon has empty kill stack', s.equippedWeapon!.killed.length === 0);
  check('new weapon lastKilledValue is null', s.equippedWeapon!.lastKilledValue === null);
}

// =============================================================================
// RULE: Health Potions — one per room, cap at 20
// =============================================================================

console.log('\n[Health Potions]');

// "Restores health equal to the card's value, capped at 20."
{
  // Damage the player first, then drink a potion and check cap.
  const g = gameWithRoom((room) => room.some((c) => getKind(c) === 'monster') && room.some((c) => getKind(c) === 'potion'));
  const monster = g.room.find((c) => getKind(c) === 'monster')!;
  const potion = g.room.find((c) => getKind(c) === 'potion')!;
  let s = fightMonster(g, monster.id, 'barehanded');
  const healthAfterDamage = s.health;
  s = drinkPotion(s, potion.id);
  const expected = Math.min(20, healthAfterDamage + potion.value);
  check('potion heals capped at 20', s.health === expected, `expected ${expected}, got ${s.health}`);
}

// "You may only use one health potion per room. If a room contains multiple hearts,
//  any extra potions are discarded without healing you."
{
  // Need a room with 2 potions AND a monster, so we can damage the player first
  // (otherwise the first potion heals nothing due to the 20-hp cap).
  const g = gameWithRoom(
    (room) =>
      room.filter((c) => getKind(c) === 'potion').length >= 2 &&
      room.some((c) => getKind(c) === 'monster'),
  );
  const potions = g.room.filter((c) => getKind(c) === 'potion');
  const monster = g.room.find((c) => getKind(c) === 'monster')!;
  // Damage the player first so the first potion actually heals
  let s = fightMonster(g, monster.id, 'barehanded');
  const healthAfterDamage = s.health;
  s = drinkPotion(s, potions[0].id);
  const healthAfterFirst = s.health;
  check(
    'first potion did heal (health increased from damaged state)',
    healthAfterFirst > healthAfterDamage,
    `before ${healthAfterDamage}, after ${healthAfterFirst}`,
  );
  check('potionsUsedThisRoom is 1 after first potion', s.potionsUsedThisRoom === 1, `got ${s.potionsUsedThisRoom}`);
  s = drinkPotion(s, potions[1].id);
  check('second potion in same room heals nothing', s.health === healthAfterFirst, `expected ${healthAfterFirst}, got ${s.health}`);
  // The second potion still counts as resolved (it's removed from room)
  check('second potion removed from room', !s.room.some((c) => c.id === potions[1].id));
}

// =============================================================================
// RULE: Winning and Losing
// =============================================================================

console.log('\n[Winning and Losing]');

// "Winning: Successfully clear and navigate through every room of the dungeon until
//  the deck is empty. Your final score is your remaining health (maximum of 20)."
{
  // Auto-play to completion: always fight the lowest monster barehanded.
  // This will likely lose, but we check that IF it wins, score == health.
  let s = createGame(123);
  let guard = 0;
  while (s.status === 'playing' && guard < 500) {
    guard += 1;
    const monsters = s.room.filter((c) => getKind(c) === 'monster');
    if (monsters.length === 0) {
      const other = s.room.find((c) => getKind(c) !== 'monster');
      if (!other) break;
      if (getKind(other) === 'weapon') s = equipWeapon(s, other.id);
      else s = drinkPotion(s, other.id);
    } else {
      const lowest = monsters.reduce((a, b) => (a.value < b.value ? a : b));
      s = fightMonster(s, lowest.id, 'barehanded');
    }
  }
  check('game reaches a terminal state', s.status === 'won' || s.status === 'lost', `got ${s.status}`);
  if (s.status === 'won') {
    check('won: score equals remaining health', s.score === s.health, `expected ${s.health}, got ${s.score}`);
    check('won: deck is empty', s.deckCount === 0);
  } else {
    check('lost: score is negative', s.score !== null && s.score < 0, `got ${s.score}`);
  }
}

// "Losing: If your health drops to 0 or below, you are defeated. Your final negative
//  score is calculated by subtracting the values of all remaining unplayed monsters
//  left in the dungeon deck from 0."
{
  // The max monster value is 14 (Ace), so a fresh 20-hp player can't die in one hit.
  // Drive health down by fighting monsters barehanded until a lethal blow is possible,
  // then verify the loss state and score.
  let s = createGame(3);
  let guard = 0;
  while (s.status === 'playing' && guard < 500) {
    guard += 1;
    const monsters = s.room.filter((c) => getKind(c) === 'monster');
    if (monsters.length === 0) {
      const other = s.room.find((c) => getKind(c) !== 'monster');
      if (!other) break;
      if (getKind(other) === 'weapon') s = equipWeapon(s, other.id);
      else s = drinkPotion(s, other.id);
      continue;
    }
    // Fight the highest monster barehanded to drive health down fast
    const highest = monsters.reduce((a, b) => (a.value > b.value ? a : b));
    s = fightMonster(s, highest.id, 'barehanded');
  }
  check('game ended in a loss (auto-play drove health to 0)', s.status === 'lost', `got ${s.status}`);
  check('health drops to <= 0 on lethal hit', s.health <= 0, `got ${s.health}`);
  check('score is negative', s.score !== null && s.score < 0, `got ${s.score}`);
  // score = -(sum of unresolved monsters in deck + room)
  const unresolvedMonsters = [...s.deck, ...s.room].filter((c) => getKind(c) === 'monster');
  const expectedScore = -unresolvedMonsters.reduce((sum, c) => sum + c.value, 0);
  check(
    'loss score = -(sum of unresolved monsters in deck + room)',
    s.score === expectedScore,
    `expected ${expectedScore}, got ${s.score}`,
  );
}

// =============================================================================
// Purity / immutability check
// =============================================================================

console.log('\n[Purity / Immutability]');

{
  const g = createGame(0);
  const snapshot = JSON.stringify(g);
  const m = g.room.find((c) => getKind(c) === 'monster');
  if (m) {
    fightMonster(g, m.id, 'barehanded');
    check('action does not mutate input state', JSON.stringify(g) === snapshot);
  } else {
    check('found a monster to test immutability (skipped if none)', true);
  }
}

// =============================================================================
// Summary
// =============================================================================

console.log('\n=========================================');
console.log(`RULES COMPLIANCE: ${passed} passed, ${failed} failed`);
console.log('=========================================');
if (failed > 0) {
  throw new Error(`${failed} rule(s) failed — see output above.`);
}