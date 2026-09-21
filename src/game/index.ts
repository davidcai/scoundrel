/**
 * Phaser renderer layer for the play screen — mounted by the React lane via a
 * dynamic import (never eagerly: Phaser and this layer must stay out of the
 * RTL-tested import chain and off title/stats routes).
 */
export { DESIGN_HEIGHT, DESIGN_WIDTH, createPlayTable, type PlayTableHandle } from './game';
export type { BridgeCommand, TableSceneApi } from './scene-api';
export type { StoreBridge, StoreView, TableModel } from './store-bridge';
