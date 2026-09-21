import { defineConfig, devices } from '@playwright/test';
import type { SeedSettingsFixtures } from './e2e/renderer';

export default defineConfig<SeedSettingsFixtures>({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['line']] : 'line',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // Canvas AA differs slightly across GPU/driver/font stacks; geometry
      // differences (the thing the snapshot guards) far exceed this margin.
      maxDiffPixelRatio: 0.1,
    },
  },
  // One committed snapshot baseline for every OS/GPU — the canvas draws fixed
  // JPEG artwork at seeded, engine-derived positions, so the geometry
  // comparison is meaningful without per-platform variants (fonts in the two
  // tiny canvas Text labels are absorbed by maxDiffPixelRatio).
  snapshotPathTemplate: '{testDir}/snapshots/{arg}{ext}',
  // Single renderer since Phase 4 (docs/phaser-plan.md): Phaser owns the play
  // table. `reducedMotion: 'reduce'` is the deterministic-e2e carrier (tweens
  // jump to end-states); the flourish-gate test overrides it to exercise the
  // animated path, and `motion=off` is covered on the hash-route carrier.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
  ],
  webServer: {
    command: 'pnpm exec vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
