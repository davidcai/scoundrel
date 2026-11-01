import { CARD_IDS } from './cards';
import type { CardId, GameConfig } from './types';

export const DEFAULT_CONFIG: GameConfig = Object.freeze({
  allowConsecutiveEscapes: false,
  unlimitedPotions: false,
  weaponDegradation: true,
});
export function validateConfig(value: unknown): GameConfig {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('allowConsecutiveEscapes' in value) ||
    !('unlimitedPotions' in value) ||
    !('weaponDegradation' in value) ||
    typeof value.allowConsecutiveEscapes !== 'boolean' ||
    typeof value.unlimitedPotions !== 'boolean' ||
    typeof value.weaponDegradation !== 'boolean'
  )
    throw new RangeError('Invalid game configuration');
  return {
    allowConsecutiveEscapes: value.allowConsecutiveEscapes,
    unlimitedPotions: value.unlimitedPotions,
    weaponDegradation: value.weaponDegradation,
  };
}
export function validateSeed(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(value))
    throw new RangeError('Seed must contain 1–32 ASCII letters, digits, underscores, or hyphens');
  return value;
}
export function shuffledDeck(seed: string): CardId[] {
  validateSeed(seed);
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  let state = hash;
  function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  const deck = [...CARD_IDS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function encodeReplay(seed: string, config: GameConfig = DEFAULT_CONFIG): string {
  validateSeed(seed);
  const valid = validateConfig(config);
  const rules = [valid.allowConsecutiveEscapes, valid.unlimitedPotions, valid.weaponDegradation]
    .map((v) => (v ? '1' : '0'))
    .join('');
  return `#/play?v=1&seed=${seed}&rules=${rules}`;
}
export function decodeReplay(fragment: string): { seed: string; config: GameConfig } {
  if (!fragment.startsWith('#/play?')) throw new RangeError('Invalid replay path');
  const params = new URLSearchParams(fragment.slice(7));
  const entries = [...params.entries()];
  if (
    entries.length !== 3 ||
    new Set(entries.map(([key]) => key)).size !== 3 ||
    params.get('v') !== '1' ||
    !params.has('seed') ||
    !params.has('rules')
  )
    throw new RangeError('Invalid replay parameters');
  const seed = validateSeed(params.get('seed'));
  const rules = params.get('rules')!;
  if (!/^[01]{3}$/.test(rules)) throw new RangeError('Invalid replay rules');
  return {
    seed,
    config: {
      allowConsecutiveEscapes: rules[0] === '1',
      unlimitedPotions: rules[1] === '1',
      weaponDegradation: rules[2] === '1',
    },
  };
}
