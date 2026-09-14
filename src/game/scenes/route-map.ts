import Phaser from 'phaser';
import { RouteController } from '../router';

/**
 * Hash-routing glue for Phaser scenes: path → scene key mapping and a shared
 * installer that wires each scene to the RouteController.
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
 * Subscribe the scene to hash routing. On every route change whose path
 * differs from `myPath`, starts the scene mapped for it (`scene.start` stops
 * the current scene, whose shutdown handler stops the controller). The
 * initial/current route matching `myPath` is ignored.
 */
export function installRouter(scene: Phaser.Scene, myPath: string): RouteController {
  const controller = new RouteController((route) => {
    if (route.path !== myPath) scene.scene.start(sceneForPath(route.path));
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => controller.stop());
  controller.start();
  return controller;
}
