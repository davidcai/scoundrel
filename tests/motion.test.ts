import { describe, expect, it } from 'vitest';
import { isCanvasTerritory } from '../src/ui/motion';

/**
 * Unit tests for the canvas-mode contract predicate (see motion.ts): DOM
 * choreography on elements strictly inside `.room` would fight canvas
 * sprites once the canvas owns the room, so such elements classify as
 * canvas territory. The room container itself — and everything outside it
 * (HP bar, weapon zone, kill stack) — is shared chrome.
 */
describe('isCanvasTerritory', () => {
  it('classifies room descendants as canvas territory and the rest as chrome', () => {
    document.body.innerHTML = `
      <main id="screen">
        <section class="room">
          <div class="phaser-board canvas-live"></div>
          <button data-card-id="club-8"></button>
        </section>
        <div class="hp-bar"></div>
        <div class="weapon-side"><button data-card-id="diamond-5"></button></div>
        <div class="kill-stack"><button data-card-id="club-9"></button></div>
      </main>`;
    const screen = document.getElementById('screen')!;
    expect(isCanvasTerritory(screen.querySelector('[data-card-id="club-8"]'))).toBe(true);
    expect(isCanvasTerritory(screen.querySelector('.phaser-board'))).toBe(true);
    // The room container itself is chrome: a shake nudges the canvas along
    // with the DOM, so nothing fights.
    expect(isCanvasTerritory(screen.querySelector('.room'))).toBe(false);
    expect(isCanvasTerritory(screen.querySelector('.hp-bar'))).toBe(false);
    expect(isCanvasTerritory(screen.querySelector('.weapon-side [data-card-id]'))).toBe(false);
    expect(isCanvasTerritory(screen.querySelector('.kill-stack [data-card-id]'))).toBe(false);
    expect(isCanvasTerritory(null)).toBe(false);
  });
});
