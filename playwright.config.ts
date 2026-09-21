import { defineConfig, devices } from '@playwright/test';
import type { RendererFixtures } from './e2e/renderer';

export default defineConfig<RendererFixtures>({
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Dual-path CI until Phase 4 (docs/phaser-plan.md §4 Phase 1): the same
      // spec against the canvas renderer. `reducedMotion: 'reduce'` is the
      // Phase 2 hook for animation-disabled e2e; Phase 1 is static.
      name: 'chromium-phaser',
      use: { ...devices['Desktop Chrome'], tableRenderer: 'phaser', reducedMotion: 'reduce' },
    },
  ],
  webServer: {
    command: 'pnpm exec vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
