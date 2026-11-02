/**
 * Public API of the Scoundrel rules engine.
 *
 * The engine owns deck construction, seeded ordering, legal actions, previews,
 * room progression, combat, undo, results, and scoring (implementation plan,
 * "Approved implementation approach"). It is pure TypeScript: no React, DOM,
 * browser storage, clock, or random source outside the seeded utilities.
 */

export * from './cards';
export * from './config';
export * from './constants';
export * from './decisions';
export * from './reducer';
export * from './scoring';
export * from './seed';
export * from './state';
export * from './types';
