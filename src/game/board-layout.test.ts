import { describe, expect, it } from 'vitest';
import {
  CARD_ASPECT,
  CARD_W_MAX,
  CARD_W_MIN,
  KILL_STEP_X,
  KILL_STEP_Y,
  MAX_ROOM_CARDS,
  ROOM_GAP_MAX,
  ROOM_GAP_MIN,
  cardWidthFor,
  computeBoardLayout,
  killFanOffsets,
  roomGapFor,
} from './board-layout';

describe('cardWidthFor', () => {
  it('clamps to the DOM --card-w bounds', () => {
    expect(cardWidthFor(600)).toBe(CARD_W_MIN); // 19.5% = 117 → clamped up
    expect(cardWidthFor(1000)).toBe(CARD_W_MAX); // 19.5% = 195 → clamped down
  });

  it('follows the ratio inside the clamp', () => {
    expect(cardWidthFor(900)).toBeCloseTo(900 * 0.195, 10); // 175.5
  });
});

describe('roomGapFor', () => {
  it('clamps to the .room gap bounds', () => {
    expect(roomGapFor(300)).toBe(ROOM_GAP_MIN); // 2.5% = 7.5 → clamped up
    expect(roomGapFor(1000)).toBe(ROOM_GAP_MAX); // 2.5% = 25 → clamped down
  });

  it('follows the ratio inside the clamp', () => {
    expect(roomGapFor(600)).toBeCloseTo(15, 10);
  });
});

describe('computeBoardLayout — wrap rule', () => {
  it('lays out one centered row of 4 when 4 cards + gaps fit', () => {
    const layout = computeBoardLayout(1200, 400);
    expect(layout.roomRects).toHaveLength(4);
    expect(layout.columns).toBe(4);
    expect(layout.rows).toBe(1);

    const { cardWidth, gap } = layout;
    expect(cardWidth).toBe(192);
    expect(gap).toBe(22);
    const rowWidth = 4 * cardWidth + 3 * gap;
    const originX = (1200 - rowWidth) / 2;
    layout.roomRects.forEach((rect, i) => {
      expect(rect.x).toBeCloseTo(originX + i * (cardWidth + gap), 10);
      expect(rect.width).toBe(cardWidth);
      expect(rect.height).toBeCloseTo(cardWidth * CARD_ASPECT, 10);
    });
    // Row block centered horizontally and vertically.
    const first = layout.roomRects[0];
    const last = layout.roomRects[3];
    expect(first && last ? first.x + (last.x + last.width) : NaN).toBeCloseTo(1200, 10);
    expect(first?.y).toBeCloseTo((400 - cardWidth * CARD_ASPECT) / 2, 10);
  });

  it('wraps to a centered 2×2 grid when 4 cards + gaps do not fit', () => {
    const layout = computeBoardLayout(500, 600);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.roomRects).toHaveLength(4);
    expect(layout.cardWidth).toBe(CARD_W_MIN);
    expect(layout.gap).toBeCloseTo(12.5, 10);

    // Column centers: 2 cards + 1 gap centered in 500px.
    const colX = (500 - (2 * layout.cardWidth + layout.gap)) / 2;
    const expectedX = [colX, colX + layout.cardWidth + layout.gap];
    const expectedY = [
      (600 - (2 * layout.cardHeight + layout.gap)) / 2,
      (600 - (2 * layout.cardHeight + layout.gap)) / 2 + layout.cardHeight + layout.gap,
    ];
    layout.roomRects.forEach((rect, i) => {
      expect(rect.x).toBeCloseTo(expectedX[i % 2] ?? NaN, 10);
      expect(rect.y).toBeCloseTo(expectedY[Math.floor(i / 2)] ?? NaN, 10);
    });
    // All rects stay inside the container.
    for (const rect of layout.roomRects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(500);
      expect(rect.y + rect.height).toBeLessThanOrEqual(600);
    }
  });
});

describe('computeBoardLayout — rooms with fewer than 4 cards', () => {
  it('centers 3 cards in a single row on a wide board', () => {
    const layout = computeBoardLayout(1200, 400, 3);
    expect(layout.roomRects).toHaveLength(3);
    expect(layout.columns).toBe(3);
    expect(layout.rows).toBe(1);
    const { cardWidth, gap } = layout;
    const rowWidth = 3 * cardWidth + 2 * gap;
    const originX = (1200 - rowWidth) / 2;
    layout.roomRects.forEach((rect, i) => {
      expect(rect.x).toBeCloseTo(originX + i * (cardWidth + gap), 10);
    });
  });

  it('splits 3 cards 2+1 across two centered rows on a narrow board', () => {
    const layout = computeBoardLayout(500, 600, 3);
    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.roomRects).toHaveLength(3);
    const containerMid = 500 / 2;
    // Third card sits alone on row 2, centered.
    const lone = layout.roomRects[2];
    expect(lone && lone.x + lone.width / 2).toBeCloseTo(containerMid, 10);
  });

  it('handles an empty room and stays deterministic', () => {
    const empty = computeBoardLayout(1200, 400, 0);
    expect(empty.roomRects).toHaveLength(0);
    expect(empty.rows).toBe(0);
    expect(computeBoardLayout(1200, 400, MAX_ROOM_CARDS)).toEqual(computeBoardLayout(1200, 400));
  });
});

describe('kill-stack fan offsets', () => {
  it('exposes the absorbed WeaponStack fan step', () => {
    const layout = computeBoardLayout(1200, 400);
    expect(layout.killFanStep).toEqual({ x: KILL_STEP_X, y: KILL_STEP_Y });
    expect(KILL_STEP_X).toBe(40);
    expect(KILL_STEP_Y).toBe(16);
  });

  it('fans older kills left+down with index 0 = last kill on top', () => {
    expect(killFanOffsets(0)).toEqual([]);
    expect(killFanOffsets(3)).toEqual([
      { x: 0, y: 0 },
      { x: -40, y: 16 },
      { x: -80, y: 32 },
    ]);
  });
});
