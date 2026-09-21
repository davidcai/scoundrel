/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture factories call `use(page)`, which is not a React hook. */
import { expect, test as base } from '@playwright/test';

/**
 * Shared e2e fixtures (Phase 4: single renderer — Phaser owns the play table).
 *
 * The `page` fixture seeds the English settings shard before the app boots
 * (most tests assert the English UI; the app defaults to Chinese). Shard shape
 * (src/store/persistence.ts + src/store/settings.ts): each key holds a
 * versioned wrapper `{ version, data }`; SettingsData is `{ config, language }`
 * with `config` a full GameConfig (the validator rejects the shard entirely if
 * it is corrupt, and ignores unknown extra fields). Version 2 is the settings
 * schema (`SETTINGS_SCHEMA_VERSION`, bumped at that call site only — the
 * global SCHEMA_VERSION stays 1 and stamps run/stats shards). The removed
 * `tableRenderer` flag is deliberately NOT seeded: shards from flag-era
 * builds carry the extra field and must still load (covered in the store
 * regression tests), but freshly-seeded shards no longer carry it.
 */

export interface SeedSettingsFixtures {
  /** Set false to boot on app defaults (used by the language-detection tests). */
  seedSettings: boolean;
}

export function settingsShard(): string {
  return JSON.stringify({
    version: 2,
    data: {
      config: { runAwayMode: 'once', potionsPerRoom: 'one', weaponDegradation: true },
      language: 'en',
    },
  });
}

export type AwaitTableReady = () => Promise<void>;

export const test = base.extend<SeedSettingsFixtures & { awaitTableReady: AwaitTableReady }>({
  seedSettings: [true, { option: true }],
  page: async ({ page, seedSettings }, use) => {
    if (seedSettings) {
      const shard = settingsShard();
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
   * Waits for the readiness marker the game stamps on the canvas container
   * (`data-table-ready="true"`, set when the scene + all card textures are
   * ready) so canvas-dependent assertions never race the boot.
   */
  awaitTableReady: async ({ page }, use) => {
    await use(async () => {
      await expect(page.locator('[data-table-ready="true"]')).toBeVisible({ timeout: 15_000 });
    });
  },
});

export { expect };
export type { Page } from '@playwright/test';
