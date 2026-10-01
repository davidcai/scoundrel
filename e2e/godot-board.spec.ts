import { existsSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Godot board frame smoke tests (godot-plan.md §Test plan, Phase 1 subset).
 *
 * These run ONLY against a build that selected the Godot renderer
 * (VITE_RENDERER=godot) AND a completed export (public/godot/spike/). CI's
 * standard Chromium job keeps Phaser as the production default and skips
 * these; the Godot CI job builds with the renderer switch and runs them.
 * Full parity/fault matrices are Phase 2+ work — this spec pins the Phase 1
 * smoke contract: the frame boots, promotes live without stealing keyboard
 * focus, and the DOM hit-layer keeps working underneath it.
 */

const GODOT_BUILD_ID = 'spike';
const exportPresent = existsSync(
  path.resolve(import.meta.dirname, '..', 'public', 'godot', GODOT_BUILD_ID, 'board.html'),
);
const enabled = process.env.GODOT_E2E === '1' && exportPresent;

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
  await page.route('**/godot/spike/**', (route) => route.abort());
  await page.goto(SEED_URL);

  // Either the frame never mounted (preflight/boot failure) or it mounted and
  // was removed again — either way the game is playable through the DOM.
  await expect(page.locator('.room button.card').first()).toBeVisible({ timeout: 60_000 });
  await page.locator('.room button.card').first().click();
  await expect(page.locator('.action-panel')).toBeVisible();
  const canvasReady = await page.locator('iframe.godot-board[data-canvas-ready="true"]').count();
  expect(canvasReady).toBe(0);
});
