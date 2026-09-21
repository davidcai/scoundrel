import Phaser from 'phaser';
import { buildDeck, cardRank, cardSuit, type CardId, type Suit } from '../engine';
import { cardImageUrl } from '../ui/card-image';

/**
 * Card texture loading: wraps `src/ui/card-image.ts`'s `import.meta.glob` map —
 * the Vite-hashed URLs are fed to the Loader with the texture key equal to the
 * CardId (`${suit}-${rank}`, matching the artwork filenames). 44 textures, no
 * sprite sheets. On load failure a generated placeholder is substituted for
 * parity with CardView's DOM image-failure fallback.
 */

/** Texture key for a card: the CardId itself. */
export function textureKey(cardId: CardId): string {
  return cardId;
}

/** Queues all deck artwork on the Loader; cards missing an asset URL are skipped. */
export function queueCardTextures(loader: Phaser.Loader.LoaderPlugin): void {
  for (const cardId of buildDeck()) {
    const url = cardImageUrl(cardId);
    if (url !== '') loader.image(textureKey(cardId), url);
  }
}

/** Solid 2×2 white texture every tinted decoration (glow, badge shapes) draws from. */
export const WHITE_KEY = 'scoundrel-white';

const SUIT_TONES: Record<Suit, { fill: string; glyph: string }> = {
  // Matches CardView's suit-toned DOM image-failure fallback tones.
  club: { fill: '#1f3d2b', glyph: '♣' },
  spade: { fill: '#1e293b', glyph: '♠' },
  diamond: { fill: '#7f1d1d', glyph: '♦' },
  heart: { fill: '#9f1239', glyph: '♥' },
};

const PLACEHOLDER_W = 240; // 2:3, matching the artwork's 1152×1728 aspect
const PLACEHOLDER_H = 360;

/**
 * After loading completes, generates suit-toned placeholder textures for every
 * deck card whose real texture is absent (missing asset or load error).
 * Returns the substituted CardIds.
 */
export function substituteMissingTextures(scene: Phaser.Scene): CardId[] {
  const substituted: CardId[] = [];
  if (!scene.textures.exists(WHITE_KEY)) {
    const white = document.createElement('canvas');
    white.width = 2;
    white.height = 2;
    const ctx = white.getContext('2d');
    if (ctx !== null) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
    }
    scene.textures.addCanvas(WHITE_KEY, white);
  }
  for (const cardId of buildDeck()) {
    const key = textureKey(cardId);
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, placeholderCanvas(cardId));
    substituted.push(cardId);
  }
  return substituted;
}

function placeholderCanvas(cardId: CardId): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PLACEHOLDER_W;
  canvas.height = PLACEHOLDER_H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;

  const suit = cardSuit(cardId);
  const tone = SUIT_TONES[suit];

  ctx.fillStyle = tone.fill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Rank/suit glyphs only — no gameplay text in canvas (i18n lives in the DOM overlay).
  const rank = cardRank(cardId).toUpperCase();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 72px system-ui, sans-serif';
  ctx.fillText(rank, canvas.width / 2, canvas.height / 2 - 36);
  ctx.font = '700 96px system-ui, sans-serif';
  ctx.fillText(tone.glyph, canvas.width / 2, canvas.height / 2 + 72);

  // Corner pips for the printed-rank look.
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.fillText(rank, 40, 44);
  ctx.fillText(tone.glyph, 40, 92);
  return canvas;
}
