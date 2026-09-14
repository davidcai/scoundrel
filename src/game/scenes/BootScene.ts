import Phaser from 'phaser';
import { buildDeck } from '../../engine';
import { cardImageUrl } from '../card-image';
import { COLORS, FONT, rgb } from '../theme';

/**
 * Boot scene: loads all 44 card artwork textures with a themed progress bar,
 * then hands off to the title screen. A missing texture file is logged and
 * skipped — CardSprite draws a graphics fallback for it later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .text(cx, cy - 24, 'Loading…', {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.h2}px`,
        color: COLORS.gold,
      })
      .setOrigin(0.5);
    this.add.rectangle(cx, cy, 320, 8, rgb(COLORS.panel)).setOrigin(0.5);
    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      bar.clear();
      bar.fillStyle(rgb(COLORS.gold), 1);
      bar.fillRect(cx - 160, cy - 4, 320 * progress, 8);
    });
    // A missing card file must not hang the loader — log and continue.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(
        `[scoundrel] could not load texture "${file.key}" — card will use its fallback art`,
      );
    });

    for (const cardId of buildDeck()) {
      const url = cardImageUrl(cardId);
      if (url !== '') this.load.image(cardId, url);
    }
  }

  create(): void {
    // BootScene is reached before any router-driven transition, so fade out
    // manually before handing off (TitleScene fades itself back in).
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('TitleScene'),
    );
    this.cameras.main.fadeOut(180, 0, 0, 0);
  }
}
