import Phaser from 'phaser';

/**
 * Minimal boot scene for the Phaser app shell. Texture loading for the
 * card artwork lands here in a later stage; for now it just starts an
 * empty game loop.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {}

  create() {}
}
