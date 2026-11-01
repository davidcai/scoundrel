import { isCardId } from '../../src/engine';
import type { Action } from '../../src/engine';
export const WINNING_SEED = 'browser-1';
const rounds = [
  'E diamond-5,W spade-j,H heart-7',
  'W club-9,W club-3,E diamond-7',
  'W club-j,W club-2,E diamond-3',
  'E diamond-10,W spade-a,W club-k',
  'H heart-5,W club-q,W spade-10',
  'W spade-8,H heart-9,B spade-6',
  'W spade-7,E diamond-2,W club-7',
  'W spade-2,E diamond-8,H heart-8',
  'B spade-3,W club-10,H heart-4',
  'W club-8,W spade-4,H heart-6',
  'E diamond-4,W spade-9,W spade-5',
  'E diamond-6,E diamond-9,W club-a',
  'W spade-q,W club-6,H heart-10',
  'W club-5,W club-4,H heart-3',
  'B spade-k,H heart-2',
];
export const WINNING_ACTIONS: Action[] = [];
for (const [index, round] of rounds.entries()) {
  for (const command of round.split(',')) {
    const [op, cardId] = command.split(' ');
    if (!isCardId(cardId)) throw new Error('Invalid winning fixture card');
    if (op === 'E') WINNING_ACTIONS.push({ type: 'equip', cardId });
    else if (op === 'H') WINNING_ACTIONS.push({ type: 'drink', cardId });
    else if (op === 'W' || op === 'B')
      WINNING_ACTIONS.push({ type: 'fight', cardId, mode: op === 'W' ? 'weapon' : 'barehanded' });
    else throw new Error('Invalid winning fixture operation');
  }
  if (index < rounds.length - 1) WINNING_ACTIONS.push({ type: 'next-room' });
}
