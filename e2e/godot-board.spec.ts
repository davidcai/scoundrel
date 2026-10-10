import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { GODOT_BUILD_ID } from '../src/game/godot-build-id';

/**
 * Godot board frame smoke tests (godot-plan.md §Test plan, Phase 1 subset).
 *
 * These run ONLY against a build that selected the Godot renderer
 * (VITE_RENDERER=godot) AND a completed export (public/godot/<build-id>/). CI's
 * standard Chromium job keeps Phaser as the production default and skips
 * these; the Godot CI job builds with the renderer switch and runs them.
 * Full parity/fault matrices are Phase 2+ work — this spec pins the Phase 1
 * smoke contract: the frame boots, promotes live without stealing keyboard
 * focus, and the DOM hit-layer keeps working underneath it.
 */

const exportPresent = existsSync(
  path.resolve(import.meta.dirname, '..', 'public', 'godot', GODOT_BUILD_ID, 'board.html'),
);
const enabled = process.env.GODOT_E2E === '1' && exportPresent;

declare global {
  interface Window {
    /** Sprite-parity diagnostics, mirrored by GodotBoard when the
     * `godot-diagnostics` query flag is present (frame-rendered bounds). */
    __godotParity?: {
      revision: number;
      runGeneration: number;
      layoutRevision: number;
      rects: Array<{ cardId: string; x: number; y: number; width: number; height: number }>;
    };
  }
}

test.skip(
  !enabled,
  'Godot export not built or GODOT_E2E not set (run pnpm godot:export, then GODOT_E2E=1 pnpm e2e)',
);

const SEED_URL = '/#/play?seed=s20'; // deterministic room: diamond-5, heart-9, spade-8, diamond-9

test('frame boots, promotes live, and leaves the DOM hit-layer functional', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(SEED_URL);
  const iframe = page.locator('iframe.godot-board');
  await expect(iframe).toBeVisible();

  // Promotion: the frame rendered the current session (PhaserBoard's probe
  // contract — e2e waits on the attribute, not the class flip).
  await expect(iframe).toHaveAttribute('data-canvas-ready', 'true', { timeout: 60_000 });

  // The frame must not own interaction: it is hidden from a11y and the DOM
  // hit-layer still selects a card and opens the action panel above it.
  await expect(iframe).toHaveAttribute('aria-hidden', 'true');
  await expect(iframe).not.toBeNull();
  await page.locator('.room button.card').first().click();
  await expect(page.locator('.action-panel')).toBeVisible();

  // Keyboard stays with the parent DOM (no frame focus trap).
  await page.keyboard.press('ArrowRight');
  const focused = await page.evaluate(() => document.activeElement?.className ?? '');
  expect(focused).toContain('card');

  expect(pageErrors).toEqual([]);
});

test('DOM fallback still plays the game when the frame fails to boot', async ({ page }) => {
  // Block the Godot artifacts: the board must fall back to DOM without
  // touching the run (plan: "Graphics support cannot be a prerequisite").
  await page.route(`**/godot/${GODOT_BUILD_ID}/**`, (route) => route.abort());
  await page.goto(SEED_URL);

  // Either the frame never mounted (preflight/boot failure) or it mounted and
  // was removed again — either way the game is playable through the DOM.
  await expect(page.locator('.room button.card').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('.room button.card').first().click();
  await expect(page.locator('.action-panel')).toBeVisible();
  const canvasReady = await page.locator('iframe.godot-board[data-canvas-ready="true"]').count();
  expect(canvasReady).toBe(0);
});

test('sprite parity: rendered frame rects match DOM hit-layer rects within 1 CSS px', async ({
  page,
}) => {
  await page.goto(`${SEED_URL}&godot-diagnostics=1`);
  const iframe = page.locator('iframe.godot-board');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('data-canvas-ready', 'true', { timeout: 60_000 });

  // The frame reports rendered sprite bounds per applied revision; the host
  // mirrors the current ordered triple onto window.__godotParity (diagnostics
  // opt-in via the query flag).
  const parity = await page.evaluate(() => window.__godotParity);
  expect(parity).not.toBeNull();

  const result = await page.evaluate(() => {
    const parity = window.__godotParity;
    const room = document.querySelector('.room')?.getBoundingClientRect();
    if (!parity || !room) return { error: 'missing parity or room' };
    const domRects = Array.from(document.querySelectorAll('.room > .tooltip-wrap')).map((wrap) => {
      const btn = wrap.querySelector<HTMLElement>('button.card');
      const el = (btn ?? wrap) as HTMLElement;
      const r = el.getBoundingClientRect();
      return {
        cardId: btn?.dataset.cardId,
        x: r.left - room.left,
        y: r.top - room.top,
        width: r.width,
        height: r.height,
      };
    });
    const byId = new Map(domRects.map((r) => [r.cardId, r]));
    const deltas = parity.rects.map((pr) => {
      const dr = byId.get(pr.cardId);
      if (!dr) return { cardId: pr.cardId, missing: true };
      return {
        cardId: pr.cardId,
        dx: Math.abs(pr.x - dr.x),
        dy: Math.abs(pr.y - dr.y),
        dw: Math.abs(pr.width - dr.width),
        dh: Math.abs(pr.height - dr.height),
      };
    });
    return { deltas };
  });
  if ('error' in result) throw new Error(result.error);
  // Plan gate: "every axis within 1 CSS pixel at rest".
  for (const d of result.deltas) {
    expect(d.missing, `frame rendered a card the DOM lacks: ${d.cardId}`).toBeFalsy();
    expect(d.dx).toBeLessThanOrEqual(1);
    expect(d.dy).toBeLessThanOrEqual(1);
    expect(d.dw).toBeLessThanOrEqual(1);
    expect(d.dh).toBeLessThanOrEqual(1);
  }
});

test('carry-forward room deals on the canvas (RoomDealt with carriedFrom)', async ({ page }) => {
  const scriptErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /script error|invalid get index/i.test(msg.text())) {
      scriptErrors.push(msg.text());
    }
  });

  await page.goto(`${SEED_URL}&godot-diagnostics=1`);
  const iframe = page.locator('iframe.godot-board');
  await expect(iframe).toHaveAttribute('data-canvas-ready', 'true', { timeout: 60_000 });

  // seed s20 room 1 (this deck: diamonds = weapons, hearts = potions,
  // clubs/spades = monsters): diamond-5, heart-9, spade-8, diamond-9. Equip,
  // fight, drink, then enter carrying the last card — the trace that used to
  // crash the frame's carry deal (deal_in indexed a filtered-away entry and no
  // `applied` ack was ever sent, stranding the canvas on the old room).
  await page.locator('[data-card-id="diamond-5"]').click();
  await page.getByRole('button', { name: /^Equip/ }).click();
  await page.locator('[data-card-id="spade-8"]').click();
  await page.getByRole('button', { name: /fight with/i }).click();
  await page.locator('[data-card-id="heart-9"]').click();
  await page.getByRole('button', { name: /drink potion/i }).click();

  const enter = page.getByRole('button', { name: /enter next room/i });
  await expect(enter).toHaveAttribute('aria-disabled', 'false', { timeout: 15_000 });
  await enter.click();

  // The canvas must reconcile the new room: the carried card plus the three
  // dealt cards, still promoted, with no GDScript script error on the console.
  // Pre-fix, parity could never grow past the 1-card carry state (no `applied`
  // ack → no diagnostics), so polling on LENGTH is the actual discriminator.
  await expect
    .poll(
      async () => {
        const parity = await page.evaluate(() => window.__godotParity ?? null);
        return parity === null ? 0 : parity.rects.length;
      },
      { timeout: 15_000 },
    )
    .toBe(4);
  const carriedIds = await page.evaluate(() =>
    (window.__godotParity?.rects ?? []).map((rect) => rect.cardId),
  );
  expect(carriedIds).toContain('diamond-9');
  await expect(iframe).toHaveAttribute('data-canvas-ready', 'true');
  expect(scriptErrors).toEqual([]);
});
