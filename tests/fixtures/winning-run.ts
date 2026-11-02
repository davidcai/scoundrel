import type { UiStep } from '../helpers/game';

/**
 * Recorded winning run for the play-flow test.
 *
 * Winning is rare enough that searching for a line at test time would be slow
 * and flaky, so a deterministic line found by an offline search is kept as a
 * fixture. The play-flow test replays every step through real interface
 * clicks and asserts the run ends with a win.
 */
export interface WinningRun {
  readonly seed: string;
  readonly steps: readonly UiStep[];
}

export const WINNING_RUN: WinningRun = {
  seed: 'plain-257',
  steps: [
    { kind: 'resolve', card: 'diamond-9' },
    { kind: 'resolve', card: 'club-a', attack: 'weapon' },
    { kind: 'resolve', card: 'club-q', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'club-j', attack: 'weapon' },
    { kind: 'resolve', card: 'club-10', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-5' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'spade-5', attack: 'weapon' },
    { kind: 'resolve', card: 'diamond-7' },
    { kind: 'resolve', card: 'spade-k', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'spade-9', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-3' },
    { kind: 'resolve', card: 'diamond-3' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'heart-9' },
    { kind: 'resolve', card: 'diamond-10' },
    { kind: 'resolve', card: 'spade-a', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'club-k', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-4' },
    { kind: 'resolve', card: 'spade-q', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'spade-j', attack: 'weapon' },
    { kind: 'resolve', card: 'spade-3', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-2' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'club-2', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-10' },
    { kind: 'resolve', card: 'club-5', attack: 'barehanded' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'heart-6' },
    { kind: 'resolve', card: 'diamond-8' },
    { kind: 'resolve', card: 'spade-10', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'runAway' },
    { kind: 'resolve', card: 'spade-7', attack: 'weapon' },
    { kind: 'resolve', card: 'club-4', attack: 'weapon' },
    { kind: 'resolve', card: 'club-7', attack: 'barehanded' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'club-3', attack: 'weapon' },
    { kind: 'resolve', card: 'heart-7' },
    { kind: 'resolve', card: 'spade-8', attack: 'barehanded' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'spade-2', attack: 'weapon' },
    { kind: 'resolve', card: 'spade-4', attack: 'barehanded' },
    { kind: 'resolve', card: 'diamond-6' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'heart-8' },
    { kind: 'resolve', card: 'club-9', attack: 'weapon' },
    { kind: 'resolve', card: 'spade-6', attack: 'weapon' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'diamond-2' },
    { kind: 'resolve', card: 'club-6', attack: 'weapon' },
    { kind: 'resolve', card: 'diamond-4' },
    { kind: 'enterNextRoom' },
    { kind: 'resolve', card: 'club-8', attack: 'weapon' },
    { kind: 'resolve', card: 'diamond-5' },
  ],
};
