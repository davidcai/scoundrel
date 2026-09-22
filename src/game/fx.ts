import * as Phaser from 'phaser';

/**
 * FX presets for the play-screen canvas (Phase 3 — phaser-adoption-plan).
 *
 * Carries the Phase 1a motion language into shader-grade territory: camera
 * filters (vignette pulses, wipe reveals), per-sprite glow (selection/hover),
 * and one-shot particle bursts (kill sparks, win confetti, defeat embers).
 * The canvas renders ZERO text — every preset is shapes and particles only.
 *
 * Degradation rules (load-bearing):
 * - Phaser 4 filters are WebGL-only and per-object filters need
 *   `enableFilters()`; every helper checks availability at runtime and
 *   returns null / no-ops instead of throwing. `try/catch` wraps controller
 *   construction because the renderer can be mid-teardown when a sync lands.
 * - A preset returning null means "unavailable" — callers must treat that as
 *   "skip this flourish", never "retry".
 * - Transient FX return disposable handles (or a destroyable emitter); the
 *   scene registers them for the motion-policy sweep so a new sync can clear
 *   everything in flight.
 */

/** Palette mirrored from the CSS variables in src/styles.css. */
export const FX_COLOR = {
  gold: 0xf0c169,
  danger: 0xe0564f,
  ember: 0x9c3f39,
  hp: 0x4bb477,
  mist: 0x98a2b8,
  white: 0xffffff,
} as const;

/** Built-in 4×4 white texture — tinted per particle; no new assets needed. */
const PARTICLE_TEXTURE = '__WHITE';

/** Glow strengths per sprite state (0 parks the controller: no draw cost). */
export const GLOW_STRENGTH = { hover: 2.5, selected: 5, pulse: 6.5 } as const;

// ── Per-object glow (selection / hover) ───────────────────────────────────

export interface GlowHandle {
  /** Set the glow strength; 0 parks the controller (disabled, zero cost). */
  set(strength: number): void;
  /** One-shot pulse: baseline → peak → baseline. Returns false when the
   * controller is unavailable (placeholder phase / filters unsupported). */
  pulse(scene: Phaser.Scene, peak: number, durationMs: number, delayMs?: number): boolean;
  /** Kill any tween driving the glow (motion-policy sweep). */
  killTweens(scene: Phaser.Scene): void;
  destroy(): void;
}

/**
 * Lazily attaches a Glow filter controller to a card's face image. Only
 * called for the (at most one) selected / hovered sprite — per-object
 * filters cost a draw call each, so they are created on demand and parked
 * (active=false) when unused.
 */
export function createGlow(image: Phaser.GameObjects.Image, color: number): GlowHandle | null {
  try {
    image.enableFilters();
  } catch {
    return null;
  }
  const lists = image.filters;
  if (lists === null) return null;
  const list = lists.external; // halo draws after the object transform
  let glow: Phaser.Filters.Glow;
  try {
    glow = list.addGlow(color, 0, 0, 1, false, 4, 8);
  } catch {
    return null;
  }
  glow.active = false;
  return {
    set(strength: number): void {
      if (strength <= 0) {
        glow.outerStrength = 0;
        glow.active = false;
        return;
      }
      glow.outerStrength = strength;
      glow.active = true;
      image.renderFilters = true;
    },
    pulse(scene: Phaser.Scene, peak: number, durationMs: number, delayMs = 0): boolean {
      if (glow.active === false && glow.outerStrength <= 0) {
        // From-dark pulses return to dark; from-lit ones (selected) yoyo back.
        glow.outerStrength = 0;
      }
      glow.active = true;
      image.renderFilters = true;
      scene.tweens.add({
        targets: glow,
        outerStrength: peak,
        duration: Math.max(60, durationMs / 2),
        delay: Math.max(0, delayMs),
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
      return true;
    },
    killTweens(scene: Phaser.Scene): void {
      scene.tweens.killTweensOf(glow);
    },
    destroy(): void {
      try {
        list.remove(glow);
      } catch {
        /* filter list already torn down */
      }
    },
  };
}

// ── Camera filters ────────────────────────────────────────────────────────

/** A transient camera effect the motion-policy sweep must be able to clear. */
export interface CameraFxHandle {
  /** Kill the driving tween (if any) and remove the controller. Idempotent. */
  dispose(): void;
}

function cameraFilterList(
  camera: Phaser.Cameras.Scene2D.Camera,
): Phaser.GameObjects.Components.FilterList | null {
  try {
    return camera.filters?.internal ?? null;
  } catch {
    return null;
  }
}

function trackedHandle(
  scene: Phaser.Scene,
  list: Phaser.GameObjects.Components.FilterList,
  controller: Phaser.Filters.Controller,
): CameraFxHandle {
  return {
    dispose(): void {
      scene.tweens.killTweensOf(controller);
      try {
        list.remove(controller);
      } catch {
        /* camera already torn down */
      }
    },
  };
}

/**
 * Red damage pulse (MonsterDefeated): a colored vignette that rises to its
 * peak and yoyos back to nothing. DOM keeps the HP-bar flash; this is the
 * shader-grade layer on top.
 */
export function pulseVignette(
  scene: Phaser.Scene,
  color: number,
  peak: number,
  durationMs: number,
): CameraFxHandle | null {
  const list = cameraFilterList(scene.cameras.main);
  if (list === null) return null;
  let vignette: Phaser.Filters.Vignette;
  try {
    vignette = list.addVignette(0.5, 0.5, 0.75, 0, color, Phaser.BlendModes.ADD);
  } catch {
    return null;
  }
  vignette.strength = 0;
  scene.tweens.add({
    targets: vignette,
    strength: peak,
    duration: Math.max(60, durationMs / 2),
    yoyo: true,
    ease: 'Sine.easeInOut',
  });
  return trackedHandle(scene, list, vignette);
}

/**
 * Defeat vignette (GameLost): rises to its strength and HOLDS — the board
 * stays mounted under the GameOver overlay, so the mood lingers.
 */
export function settleVignette(
  scene: Phaser.Scene,
  color: number,
  strength: number,
  durationMs: number,
): CameraFxHandle | null {
  const list = cameraFilterList(scene.cameras.main);
  if (list === null) return null;
  let vignette: Phaser.Filters.Vignette;
  try {
    vignette = list.addVignette(0.5, 0.5, 0.78, 0, color, Phaser.BlendModes.ADD);
  } catch {
    return null;
  }
  vignette.strength = 0;
  scene.tweens.add({
    targets: vignette,
    strength,
    duration: Math.max(60, durationMs),
    ease: 'Sine.easeOut',
  });
  return trackedHandle(scene, list, vignette);
}

/**
 * Room wipe reveal (RoomDealt): unveils the scene from the deck edge
 * (right-to-left) as the cards deal. Progress is driven by a tween —
 * the Wipe controller is removed by the handle's dispose.
 */
export function wipeReveal(scene: Phaser.Scene, durationMs: number): CameraFxHandle | null {
  const list = cameraFilterList(scene.cameras.main);
  if (list === null) return null;
  let wipe: Phaser.Filters.Wipe;
  try {
    // direction 1 + axis 0 = right-to-left; reveal = 1 (uncover).
    wipe = list.addWipe(0.22, 1, 0, 1);
  } catch {
    return null;
  }
  wipe.progress = 0;
  scene.tweens.add({
    targets: wipe,
    progress: 1,
    duration: Math.max(60, durationMs),
    ease: 'Sine.easeOut',
  });
  return trackedHandle(scene, list, wipe);
}

/**
 * Reduced-motion celebration: a single soft full-canvas fade in the
 * outcome's color — opacity only, no particles.
 */
export function softFade(
  scene: Phaser.Scene,
  color: number,
  durationMs: number,
  peakAlpha: number,
): CameraFxHandle | null {
  try {
    const rect = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, color, 0);
    rect.setOrigin(0, 0);
    rect.setScrollFactor(0);
    rect.setDepth(1000);
    rect.setAlpha(0);
    scene.tweens.add({
      targets: rect,
      alpha: peakAlpha,
      duration: Math.max(60, durationMs / 2),
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    return {
      dispose(): void {
        scene.tweens.killTweensOf(rect);
        rect.destroy();
      },
    };
  } catch {
    return null;
  }
}

// ── Particles ─────────────────────────────────────────────────────────────

/**
 * Kill spark (MonsterDefeated): a short radial burst of gold/white sparks
 * with a few danger-colored flecks, gravity-pulled so they fall as they fade.
 */
export function killSpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Particles.ParticleEmitter | null {
  try {
    const emitter = scene.add.particles(x, y, PARTICLE_TEXTURE, {
      speed: { min: 70, max: 230 },
      angle: { min: 200, max: 340 }, // upward-biased burst
      lifespan: { min: 220, max: 430 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [FX_COLOR.gold, FX_COLOR.white, FX_COLOR.danger],
      gravityY: 380,
      quantity: 4,
      frequency: 24,
      emitting: false,
    });
    emitter.setDepth(900);
    emitter.explode(18, x, y);
    return emitter;
  } catch {
    return null;
  }
}

/**
 * Victory confetti (GameWon): gold/green/white pieces raining from the top
 * edge. Emission self-stops; the scene destroys the emitter on COMPLETE or
 * on the next policy sweep, whichever comes first.
 */
export function confettiFall(
  scene: Phaser.Scene,
  width: number,
): Phaser.GameObjects.Particles.ParticleEmitter | null {
  try {
    const emitter = scene.add.particles(width / 2, -12, PARTICLE_TEXTURE, {
      x: { min: 0, max: width },
      angle: { min: 80, max: 100 },
      speed: { min: 40, max: 120 },
      lifespan: { min: 900, max: 1600 },
      scale: { start: 1.6, end: 1 },
      alpha: { start: 1, end: 0.7 },
      tint: [FX_COLOR.gold, FX_COLOR.white, FX_COLOR.hp, FX_COLOR.danger],
      gravityY: 260,
      rotate: { min: -180, max: 180 }, // particle spin, not a sprite tween
      frequency: 16,
      quantity: 2,
    });
    emitter.setDepth(900);
    emitter.particleBringToTop = false;
    scene.time.delayedCall(800, () => emitter.stop());
    return emitter;
  } catch {
    return null;
  }
}

/**
 * Defeat embers (GameLost): slow dark-red embers drifting down the canvas
 * while the vignette settles. Emission self-stops like the confetti.
 */
export function emberFall(
  scene: Phaser.Scene,
  width: number,
): Phaser.GameObjects.Particles.ParticleEmitter | null {
  try {
    const emitter = scene.add.particles(width / 2, -8, PARTICLE_TEXTURE, {
      x: { min: 0, max: width },
      angle: { min: 75, max: 105 },
      speed: { min: 18, max: 55 },
      lifespan: { min: 1400, max: 2400 },
      scale: { start: 1.2, end: 0.3 },
      alpha: { start: 0.85, end: 0 },
      tint: [FX_COLOR.ember, FX_COLOR.danger],
      gravityY: 60,
      frequency: 42,
      quantity: 1,
    });
    emitter.setDepth(900);
    scene.time.delayedCall(1400, () => emitter.stop());
    return emitter;
  } catch {
    return null;
  }
}
