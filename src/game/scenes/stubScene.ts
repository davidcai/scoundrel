import Phaser from 'phaser';
import { t, type MessageKey } from '../../i18n';
import { COLORS, FONT, RADIUS, rgb } from '../theme';
import { navigate } from '../router';
import { Button } from '../widgets/Button';
import { installRouter } from './route-map';

/**
 * Factory for the stage-3 placeholder scenes (Stats / Settings / About):
 * centered panel with a title and a back-to-title button. Each shows the real
 * content in a later stage.
 */
export function createStubScene(
  key: string,
  path: string,
  titleKey: MessageKey,
): new () => Phaser.Scene {
  return class extends Phaser.Scene {
    constructor() {
      super(key);
    }

    create(): void {
      installRouter(this, path);

      const cx = this.scale.width / 2;
      const cy = this.scale.height / 2;
      const width = 560;
      const height = 220;

      this.add.rectangle(0, 0, this.scale.width, this.scale.height, rgb(COLORS.bg)).setOrigin(0, 0);

      const panel = this.add.graphics();
      panel
        .fillStyle(rgb(COLORS.panel), 1)
        .fillRoundedRect(cx - width / 2, cy - height / 2, width, height, RADIUS.panel);
      panel
        .lineStyle(1, rgb(COLORS.border), 1)
        .strokeRoundedRect(
          cx - width / 2 + 0.5,
          cy - height / 2 + 0.5,
          width - 1,
          height - 1,
          RADIUS.panel,
        );

      this.add
        .text(cx, cy - 40, t(titleKey), {
          fontFamily: FONT.display,
          fontSize: `${FONT.size.h1}px`,
          color: COLORS.gold,
        })
        .setOrigin(0.5);

      new Button(this, cx, cy + 44, t('backToTitle'), {
        width: 220,
        onClick: () => navigate('#/'),
        debugId: 'btn-back-title',
      });
    }
  };
}
