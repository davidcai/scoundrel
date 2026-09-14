import Phaser from 'phaser';
import { t } from '../../i18n';
import { COLORS, FONT, rgb } from '../theme';
import { navigate } from '../router';
import { Button } from '../widgets/Button';
import { installRouter } from './route-map';

/**
 * Play scene stub for stage 3 — placeholder panel so `#/play` routes
 * end-to-end. Replaced by the real table view in stage 4.
 */
export class PlayScene extends Phaser.Scene {
  constructor() {
    super('PlayScene');
  }

  create(): void {
    installRouter(this, '/play');

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const width = 620;
    const height = 220;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, rgb(COLORS.bg)).setOrigin(0, 0);

    const panel = this.add.graphics();
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(cx - width / 2, cy - height / 2, width, height, 16);
    panel
      .lineStyle(1, rgb(COLORS.border), 1)
      .strokeRoundedRect(cx - width / 2 + 0.5, cy - height / 2 + 0.5, width - 1, height - 1, 16);

    this.add
      .text(cx, cy - 30, 'Play scene — stage 4', {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.h1}px`,
        color: COLORS.text,
      })
      .setOrigin(0.5);

    new Button(this, cx, cy + 40, t('backToTitle'), {
      width: 220,
      onClick: () => navigate('#/'),
      debugId: 'btn-back-title',
    });
  }
}
