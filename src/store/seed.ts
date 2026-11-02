/**
 * New-run seed generation for the store (implementation-plan foundation
 * decision): 16 lowercase hexadecimal characters from `crypto.getRandomValues`.
 * The rules engine has no random source outside its seeded utilities, so the
 * interface owns this one call to the browser's crypto API.
 */
const SEED_BYTES = 8;

export function newRunSeed(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi === undefined || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Web Crypto is unavailable; cannot generate a new-run seed.');
  }
  const bytes = new Uint8Array(SEED_BYTES);
  cryptoApi.getRandomValues(bytes);
  let seed = '';
  for (const byte of bytes) {
    seed += byte.toString(16).padStart(2, '0');
  }
  return seed;
}
