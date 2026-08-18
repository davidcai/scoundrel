/**
 * Shareable-run URL codec (Q63/Q64). A run URL looks like:
 *
 *   #/play?seed=a3f9k2&config=o1d
 *
 * The config is encoded as exactly 3 characters, one per toggle:
 *   [0] runAwayMode:        'o' = once (canonical) · 'u' = unlimited
 *   [1] potionsPerRoom:     '1' = one (canonical)  · 'u' = unlimited
 *   [2] weaponDegradation:  'd' = on (canonical)   · 'n' = off
 *
 * Canonical rules encode as `o1d`. Unknown or malformed strings decode to
 * null so callers can fall back to the player's settings.
 */
import type { GameConfig } from '../../engine';

export function encodeConfig(config: GameConfig): string {
  return `${config.runAwayMode === 'once' ? 'o' : 'u'}${
    config.potionsPerRoom === 1 ? '1' : 'u'
  }${config.weaponDegradation ? 'd' : 'n'}`;
}

export function decodeConfig(encoded: string | null): GameConfig | null {
  if (encoded === null || encoded.length !== 3) return null;
  const [run, potions, degradation] = encoded;
  if (run !== 'o' && run !== 'u') return null;
  if (potions !== '1' && potions !== 'u') return null;
  if (degradation !== 'd' && degradation !== 'n') return null;
  return {
    runAwayMode: run === 'o' ? 'once' : 'unlimited',
    potionsPerRoom: potions === '1' ? 1 : Number.POSITIVE_INFINITY,
    weaponDegradation: degradation === 'd',
  };
}

/** The hash portion of a replay link: '#/play?seed=…&config=…'. */
export function replayHash(seed: string, config: GameConfig): string {
  return `#/play?seed=${encodeURIComponent(seed)}&config=${encodeConfig(config)}`;
}

/** Absolute URL for the clipboard (hash router tolerates any base path). */
export function replayUrl(seed: string, config: GameConfig): string {
  return `${window.location.origin}${window.location.pathname}${replayHash(seed, config)}`;
}
