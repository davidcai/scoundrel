import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { enableDebugHandle } from './game/debug';
import './styles.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'root',
  backgroundColor: '#0d0f14',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene],
});

enableDebugHandle(game);

export default game;
