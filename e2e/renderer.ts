/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture factories call `use(page)`, which is not a React hook. */
import { expect, test as base } from '@playwright/test';

/**
 * Dual-renderer fixtures (docs/phaser-plan.md §4 Phase 1): every test runs
 * once per Playwright project — `chromium` (DOM renderer, app defaults) and
 * `chromium-phaser` (canvas renderer, seeded via the settings shard).
 *
 * The `tableRenderer` flag is per-device appearance and deliberately does NOT
 * round-trip through share URLs (§3), so the phaser path is seeded through
 * `localStorage` (`scoundrel:settings`) before the app boots — a query param
 * would leak the flag into the shareable-URL space.
 *
 * Shard shape (src/store/persistence.ts + src/store/settings.ts): each key
 * holds a versioned wrapper `{ version, data }`; SettingsData is
 * `{ config, language, tableRenderer }` with `config` a full GameConfig (the
 * validator rejects the shard entirely if it is corrupt). Version 2 is the
 * settings schema (`SETTINGS_SCHEMA_VERSION`, bumped at that call site only —
 * the global SCHEMA_VERSION stays 1 and stamps run/stats shards).
 */

export type TableRenderer = 'dom' | 'phaser';

export interface RendererFixtures {
  tableRenderer: TableRenderer;
  /** Set false to boot on app defaults (used by the language-detection tests). */
  seedSettings: boolean;
}

export function settingsShard(tableRenderer: TableRenderer): string {
  return JSON.stringify({
    version: 2,
    data: {
      config: { runAwayMode: 'once', potionsPerRoom: 'one', weaponDegradation: true },
      language: 'en',
      tableRenderer,
    },
  });
}

export type AwaitTableReady = () => Promise<void>;

export const test = base.extend<RendererFixtures & { awaitTableReady: AwaitTableReady }>({
  tableRenderer: ['dom', { option: true }],
  seedSettings: [true, { option: true }],
  page: async ({ page, tableRenderer, seedSettings }, use) => {
    if (seedSettings) {
      const shard = settingsShard(tableRenderer);
      await page.addInitScript((settings) => {
        try {
          localStorage.setItem('scoundrel:settings', settings);
        } catch {
          // about:blank and other opaque origins have no usable storage — the
          // app falls back to defaults until the next real navigation.
        }
      }, shard);
    }
    await use(page);
  },
  /**
   * No-op on the DOM path; on the phaser path waits for the readiness marker
   * the game stamps on the canvas container (`data-table-ready="true"`, set
   * when the scene + all card textures are ready) so canvas-dependent
   * assertions never race the boot.
   */
  awaitTableReady: async ({ page, tableRenderer }, use) => {
    await use(async () => {
      if (tableRenderer !== 'phaser') return;
      await expect(page.locator('[data-table-ready="true"]')).toBeVisible({ timeout: 15_000 });
    });
  },
});

export { expect };
export type { Page } from '@playwright/test';
