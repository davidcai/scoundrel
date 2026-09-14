import type Phaser from 'phaser';
import { useGameStore } from '../store/game-store';

/**
 * Debug seam for the Phaser build, activated only by a `?debug` query param.
 * Exposes `window.__SCOUNDREL__` with the game instance, the zustand store,
 * and a `worldToScreen(cardId)` helper (page-space coordinates of a tracked
 * scene object) for browser-console poking and tooling.
 */

/**
 * Anything the debug registry can track: a GameObject that knows its scene
 * and can report its world-space center. `getCenter` matches Phaser's
 * Components signature (e.g. Sprite/Image/Text); plain `x`/`y` works too.
 */
export interface TrackableObject {
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
  readonly scene: Phaser.Scene;
  getCenter<O extends Phaser.Types.Math.Vector2Like>(output?: O, includeParent?: boolean): O;
}

const registry = new Map<string, TrackableObject>();

/** Register a scene object under a stable id (e.g. a CardId). */
export function registerSceneObject(id: string, object: TrackableObject): void {
  registry.set(id, object);
}

/** Remove a previously registered object. */
export function unregisterSceneObject(id: string): void {
  registry.delete(id);
}

/** Convenience wrappers for card sprites, keyed by CardId. */
export function registerCardSprite(cardId: string, sprite: TrackableObject): void {
  registerSceneObject(cardId, sprite);
}

export function unregisterCardSprite(cardId: string): void {
  unregisterSceneObject(cardId);
}

export interface ScoundrelDebugHandle {
  game: Phaser.Game;
  store: typeof useGameStore;
  worldToScreen(id: string): { x: number; y: number } | null;
}

declare global {
  interface Window {
    __SCOUNDREL__?: ScoundrelDebugHandle;
  }
}

function centerOf(object: TrackableObject): { x: number; y: number } {
  if (typeof object.getCenter === 'function') {
    const center = object.getCenter({ x: 0, y: 0 });
    if (typeof center?.x === 'number' && typeof center?.y === 'number') {
      return { x: center.x, y: center.y };
    }
  }
  return { x: object.x, y: object.y };
}

/**
 * Page-space coordinates of a tracked object's center, assuming Scale.FIT
 * with no camera scroll (the current game configuration). Returns null when
 * the id is unknown, the scene is shut down, or the canvas is not mounted.
 */
function makeWorldToScreen(game: Phaser.Game): (id: string) => { x: number; y: number } | null {
  return (id: string) => {
    const object = registry.get(id);
    if (!object || !object.active || !object.scene.scene.isActive()) return null;

    const camera = object.scene.cameras.main;
    if (!camera) return null;

    const center = centerOf(object);
    const worldX = (center.x - camera.scrollX) * camera.zoom;
    const worldY = (center.y - camera.scrollY) * camera.zoom;

    const canvas = game.canvas;
    if (!canvas || !canvas.isConnected) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: rect.left + (worldX / game.scale.gameSize.width) * rect.width,
      y: rect.top + (worldY / game.scale.gameSize.height) * rect.height,
    };
  };
}

/** Install `window.__SCOUNDREL__` when the URL has a `debug` param; no-op otherwise. */
export function enableDebugHandle(game: Phaser.Game): void {
  if (!new URLSearchParams(window.location.search).has('debug')) return;

  window.__SCOUNDREL__ = {
    game,
    store: useGameStore,
    worldToScreen: makeWorldToScreen(game),
  };
}
