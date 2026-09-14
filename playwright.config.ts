import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Every test boots the Phaser game, which loads 44 card JPEGs through the
  // single preview server; too many concurrent browsers starve that loader
  // past its boot timeout, so keep the fan-out small.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['html'], ['line']] : 'line',
  use: {
    baseURL: 'http://localhost:4173',
    // Matches the game's 1280×720 design size so Scale.FIT renders at a 1:1
    // factor and the debug handle's worldToScreen coordinates click exactly.
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
