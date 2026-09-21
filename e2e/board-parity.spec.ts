import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { computeBoardLayout, type BoardMetrics } from '../src/game/board-layout';

/**
 * Phase 2 mid-phase kill checkpoint — the geometry-drift detector
 * (phaser-adoption-plan §Phase 2: "e2e rect assertions green (hit-layer button
 * rects must equal the layout function's output at desktop and mobile
 * widths)").
 *
 * The chain under test: `.room` computed style → shared metrics path
 * (board-metrics.ts) → `computeBoardLayout` → (a) the DOM hit-layer buttons
 * positioned by use-board-layout and (b) the canvas sprites laid out by
 * board-scene. The assertions pin (a) to the pure function node-side and the
 * canvas box to the room box; (b) shares (a)'s inputs verbatim, so the whole
 * chain cannot drift. Tolerance: ≤ 1px per axis.
 */

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const SEED_URL = '/#/play?seed=s20'; // deterministic room: diamond-5, heart-9, spade-8, diamond-9
const TOLERANCE = 1;

interface RoomSnapshot {
  room: { width: number; height: number };
  metrics: BoardMetrics;
  buttons: { id: string; x: number; y: number; width: number; height: number }[];
  canvasBox: { x: number; y: number; width: number; height: number } | null;
  live: boolean;
}

/** Room box, resolved metrics, hit-layer button rects and canvas box — all relative to the room. */
async function snapshotRoom(page: Page): Promise<RoomSnapshot> {
  return page.evaluate(() => {
    const px = (value: string): number | null => {
      const trimmed = value.trim();
      if (!trimmed.endsWith('px')) return null;
      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const room = document.querySelector('.room');
    if (!(room instanceof HTMLElement)) throw new Error('.room not found');
    const cs = getComputedStyle(room);
    const roomBox = room.getBoundingClientRect();
    const rel = (b: DOMRect) => ({
      x: b.left - roomBox.left,
      y: b.top - roomBox.top,
      width: b.width,
      height: b.height,
    });
    const metrics: BoardMetrics = {};
    const cardW = px(cs.getPropertyValue('--card-w'));
    if (cardW !== null) metrics.cardW = cardW;
    const gap = px(cs.columnGap);
    if (gap !== null) metrics.gap = gap;
    for (const [key, prop] of [
      ['padTop', 'paddingTop'],
      ['padLeft', 'paddingLeft'],
      ['padRight', 'paddingRight'],
      ['padBottom', 'paddingBottom'],
    ] as const) {
      const v = px(cs[prop]);
      if (v !== null) metrics[key] = v;
    }
    const canvas = room.querySelector('.phaser-board canvas');
    return {
      room: { width: roomBox.width, height: roomBox.height },
      metrics,
      buttons: Array.from(room.querySelectorAll('button.card')).map((b) => ({
        id: (b as HTMLElement).dataset.cardId ?? '',
        ...rel((b as HTMLElement).getBoundingClientRect()),
      })),
      canvasBox: canvas instanceof HTMLElement ? rel(canvas.getBoundingClientRect()) : null,
      live: room.classList.contains('canvas-live'),
    };
  });
}

async function attachRoomScreenshot(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  // Visual smoke only — the assertions above are geometric.
  const box = await page.locator('.room').boundingBox();
  if (box === null) return;
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({
    path,
    clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 },
  });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** The full parity assertion for one viewport. */
async function assertBoardParity(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  await page.goto(SEED_URL);
  await page.waitForSelector('.room button.card');
  // Canvas promoted: hit-layer positioned, imgs hidden — the state under test.
  await page.waitForSelector('.room.canvas-live', { timeout: 20_000 });
  await page.waitForTimeout(600); // texture paint settle

  const snap = await snapshotRoom(page);
  expect(snap.live, 'canvas-live engaged').toBe(true);
  expect(snap.buttons, 'the s20 room deals 4 cards').toHaveLength(4);

  const layout = computeBoardLayout(
    snap.room.width,
    snap.room.height,
    snap.buttons.length,
    snap.metrics,
  );
  expect(layout.columns, 'wrap rule for this viewport').toBe(snap.room.width < 640 ? 2 : 4);

  let worst = { axis: '', delta: 0 };
  snap.buttons.forEach((button, index) => {
    const expected = layout.roomRects[index];
    expect(expected, `layout rect for card #${index}`).toBeDefined();
    if (expected === undefined) return; // narrows for TS; expect above already failed
    const deltas = {
      x: Math.abs(button.x - expected.x),
      y: Math.abs(button.y - expected.y),
      width: Math.abs(button.width - expected.width),
      height: Math.abs(button.height - expected.height),
    };
    for (const [axis, delta] of Object.entries(deltas)) {
      if (delta > worst.delta) worst = { axis: `#${index} ${button.id} ${axis}`, delta };
      expect(
        delta,
        `card #${index} (${button.id}) ${axis} Δ=${delta.toFixed(3)}px`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });
  // Budget stays green even when the per-axis assertions already passed.
  expect(
    worst.delta,
    `worst axis ${worst.axis} should be far inside the ${TOLERANCE}px budget`,
  ).toBeLessThanOrEqual(TOLERANCE);

  // The canvas covers the room box exactly (Scale.RESIZE integer rounding may
  // shave a sub-pixel fraction off the height — allowed within tolerance).
  expect(snap.canvasBox, 'canvas is mounted').not.toBeNull();
  const canvas = snap.canvasBox!;
  expect(Math.abs(canvas.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(canvas.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(canvas.width - snap.room.width)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(canvas.height - snap.room.height)).toBeLessThanOrEqual(TOLERANCE);

  await attachRoomScreenshot(page, `room-${label}`, testInfo);
}

test.describe('board parity — canvas scene vs DOM hit-layer vs layout fn', () => {
  test.use({ viewport: DESKTOP });

  test('desktop 1280×800: every hit-layer button sits on its sprite rect', async ({
    page,
  }, testInfo) => {
    await assertBoardParity(page, testInfo, 'desktop-1280');
  });
});

test.describe('board parity — mobile 2×2 wrap', () => {
  test.use({ viewport: MOBILE });

  test('mobile 390×844: wrapped board stays inside the room and on the rects', async ({
    page,
  }, testInfo) => {
    await assertBoardParity(page, testInfo, 'mobile-390');

    // The 2×2 wrap is fully visible: the room height covers both rows.
    const snap = await snapshotRoom(page);
    const lastRect = snap.buttons[snap.buttons.length - 1];
    expect(lastRect).toBeDefined();
    expect(snap.room.height, 'room height fits both rows + padding').toBeGreaterThanOrEqual(
      lastRect!.y + lastRect!.height,
    );
  });
});

test.describe('resume silence — mid-run reload reconciles without lingering FX', () => {
  test.use({ viewport: DESKTOP });

  test('mid-run reload renders the saved room with zero fx-ghosts', async ({ page }) => {
    await page.goto(SEED_URL);
    await page.waitForSelector('.room.canvas-live', { timeout: 20_000 });

    // A couple of actions: equip the weapon, drink the potion → 2 cards left.
    await page.locator('[data-card-id="diamond-5"]').click();
    await page.getByRole('button', { name: /^Equip/ }).click();
    await page.locator('[data-card-id="heart-9"]').click();
    await page.getByRole('button', { name: /drink potion/i }).click();
    await expect(page.locator('.room [data-card-id]')).toHaveCount(2);

    // Mid-run resume path: drop the seed param, reload — the saved run resumes.
    await page.goto('/#/play');
    await page.reload();
    await expect(page.locator('.room [data-card-id]')).toHaveCount(2);
    await page.waitForSelector('.room.canvas-live', { timeout: 20_000 });
    await page.waitForTimeout(1_500); // let any (transient) mount choreography drain

    await expect(page.locator('.fx-ghost')).toHaveCount(0);
    await expect(page.locator('.room .card img')).toHaveCount(2); // DOM room rendered
    await expect(page.locator('.weapon-card')).toHaveAttribute('data-card-id', 'diamond-5');
    await expect(page.locator('.hud-group.hp .hud-value')).toHaveText(/\/20$/);
  });
});
