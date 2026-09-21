import type { BridgeCommand } from './scene-api';

/**
 * Phase 3 juice layer: structured plans derived from existing BridgeCommand
 * payloads and the terminal reconstruction — no new store/engine surface. The
 * scene executes the plan with Phaser (camera shake, particles); the
 * reduced-motion policy lives in the scene (juice is a no-op there), while the
 * plan stays motion-agnostic so unit tests can assert the keying itself.
 */

/** Damage at or above this triggers the camera shake on an attack/lethal blow. */
export const SHAKE_DAMAGE_THRESHOLD = 5;

/** Small camera shake: ~4.2px at the 960px design width, well under 180ms. */
export const CAMERA_SHAKE = { durationMs: 150, intensity: 0.0044 } as const;

/** PotionQuaffed heal burst: tiny mote count for perf; skipped when wasted. */
export const HEAL_BURST = {
  moteCount: 14, // ~10–20 kept intentionally small
  tint: 0x7ed99a, // the DOM hp-fill gradient's highlight green (styles.css)
  baseSize: 4,
  minDistance: 26,
  distanceJitter: 12,
} as const;

/**
 * Backdrop ambience (procedural — no raster art): slow-drifting dust/ember
 * motes at very low alpha, non-interactive, depth behind everything. Only
 * started when motion is enabled.
 */
export const AMBIENCE = {
  moteCount: 14,
  dustTint: 0xe2e8f0,
  emberTint: 0xd9a44a, // --accent: reads as the app's gold, not generic orange
  alphaMin: 0.04,
  alphaMax: 0.09,
  driftPx: 34,
  loopMsMin: 4200,
  loopMsJitter: 1800,
  delayMsMax: 3600,
} as const;

/** Carried-card looping shimmer: gold fill-tint pulse at very low alpha. */
export const CARRIED_SHIMMER = {
  tint: 0xf0c169, // --accent-bright: same gold as the DOM .selected-ring
  alphaMin: 0.05,
  alphaMax: 0.16,
  loopMs: 1400,
  ease: 'Sine.easeInOut',
} as const;

/**
 * Decorative HP bar geometry (canvas coords; the DOM meter stays canonical).
 * The bar sits BESIDE the Phase 1 HP text, which keeps its exact position so
 * the reduced-motion settled frame matches the committed e2e snapshot baseline.
 */
export const HP_BAR = { x: 78, y: 574, width: 140, height: 10 } as const;

export interface JuicePlan {
  cameraShake: { durationMs: number; intensity: number } | null;
  /** Weapon-strain flash on the held weapon sprite (bridge-derived break). */
  weaponStrain: boolean;
  /** Green heal mote burst on the quaffed card (never on wasted potions). */
  healBurst: boolean;
}

const QUIET: JuicePlan = { cameraShake: null, weaponStrain: false, healBurst: false };

/** Keys every juice effect off the existing command payloads. */
export function planJuice(command: BridgeCommand): JuicePlan {
  switch (command.kind) {
    case 'attack':
      return {
        cameraShake: command.damage >= SHAKE_DAMAGE_THRESHOLD ? CAMERA_SHAKE : null,
        weaponStrain: command.weaponBreak,
        healBurst: false,
      };
    case 'terminal': {
      const reconstruction = command.reconstruction;
      const lethal = (reconstruction?.hpDelta ?? 0) <= -SHAKE_DAMAGE_THRESHOLD;
      return {
        cameraShake: lethal ? CAMERA_SHAKE : null,
        weaponStrain: reconstruction?.weaponBreak === true,
        healBurst: false,
      };
    }
    case 'potion':
      return {
        cameraShake: null,
        weaponStrain: false,
        healBurst: !command.wasted && command.healed > 0,
      };
    default:
      return QUIET;
  }
}
