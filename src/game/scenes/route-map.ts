import Phaser from 'phaser';
import { RouteController } from '../router';

/**
 * Hash-routing glue for Phaser scenes: path → scene key mapping, a shared
 * installer that wires each scene to the RouteController, and fade-based
 * scene transitions.
 *
 * Anti-loop detail: when a scene swap is triggered by a hashchange, the new
 * scene's controller sees the already-current hash. Each scene therefore only
 * reacts when the route differs from the path it owns.
 */

export function sceneForPath(path: string): string {
  switch (path) {
    case '/':
      return 'TitleScene';
    case '/play':
      return 'PlayScene';
    case '/stats':
      return 'StatsScene';
    case '/settings':
      return 'SettingsScene';
    case '/about':
      return 'AboutScene';
    default:
      return 'TitleScene';
  }
}

/**
 * Fade duration for scene transitions (each way), kept fast so navigation
 * never feels blocked.
 */
const FADE_MS = 180;

/**
 * Navigate to another scene with a subtle camera fade: fade the current
 * camera out, swap scenes, and let the new scene fade its camera back in
 * (via `fadeInOnCreate`). Falls back to an immediate `scene.start` when the
 * camera is missing (e.g. mid-shutdown).
 */
export function transitionTo(scene: Phaser.Scene, key: string): void {
  const camera = scene.cameras.main;
  if (!camera) {
    scene.scene.start(key);
    return;
  }
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key));
  camera.fadeOut(FADE_MS, 0, 0, 0);
}

/** Fade the scene's camera in from black — call at the top of `create`. */
export function fadeInOnCreate(scene: Phaser.Scene): void {
  scene.cameras.main?.fadeIn(FADE_MS, 0, 0, 0);
}

/**
 * Subscribe the scene to hash routing. On every route change whose path
 * differs from `myPath`, transitions to the scene mapped for it (a fade-out
 * then `scene.start`, which stops the current scene, whose shutdown handler
 * stops the controller). The initial/current route matching `myPath` is
 * ignored.
 */
export function installRouter(scene: Phaser.Scene, myPath: string): RouteController {
  const controller = new RouteController((route) => {
    if (route.path !== myPath) transitionTo(scene, sceneForPath(route.path));
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => controller.stop());
  controller.start();
  return controller;
}
