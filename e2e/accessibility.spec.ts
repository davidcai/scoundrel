import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2 kill checkpoint — axe scan over the promoted canvas board
 * (phaser-adoption-plan §Phase 2: "axe scan (net-new tooling) zero
 * violations"). The DOM hit-layer keeps every interactive element a real
 * button, so the a11y tree must be identical with and without the canvas.
 *
 * Rule scope: the WCAG 2.1/2.2 A+AA rule set (the conformance core) via
 * `withTags`. This is a scope choice made up front — not a post-hoc disable of
 * a failing rule; axe's `best-practice` tag (e.g. landmark/heading-order
 * preferences) is tracked separately from this gate.
 *
 * State under test: seeded run, canvas-live ENGAGED (we wait for the
 * promotion), plus one interaction state with a card selected (action panel
 * open) — transparent hit-layer buttons, ring, badges and tooltips all in.
 */

const SEED_URL = '/#/play?seed=s20';
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page): Promise<string> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => `${n.target.join('>')}${n.failureSummary ? ` — ${n.failureSummary}` : ''}`)
          .join(' | ')}`,
    )
    .join('\n');
}

test.describe('axe — play screen with the canvas live', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`zero WCAG violations at ${viewport.name} ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(SEED_URL);
      await page.waitForSelector('.room button.card');
      await page.waitForSelector('.room.canvas-live', { timeout: 20_000 });
      await page.waitForTimeout(600); // texture paint settle

      const violations = await scan(page);
      expect(violations, violations || 'axe violations on the live board').toBe('');
    });

    if (viewport.name === 'desktop') {
      test('zero WCAG violations with a card selected (action panel open)', async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(SEED_URL);
        await page.waitForSelector('.room.canvas-live', { timeout: 20_000 });
        await page.locator('[data-card-id="spade-8"]').click();
        await expect(page.locator('.action-panel')).toBeVisible();

        const violations = await scan(page);
        expect(violations, violations || 'axe violations in the selection state').toBe('');
      });
    }
  }
});
