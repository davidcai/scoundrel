import { defineConfig, devices } from '@playwright/test';

// End-to-end checks run against the production build, served by `pnpm preview`.
// The approved browser/viewport matrix and check inventory live in
// docs/implementation-plan.md §5. `metadata.lane` lets a spec opt into or out
// of a lane (for example touch-only or keyboard-only coverage).
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isCi = Boolean(process.env.CI);

const wide = { viewport: { width: 1440, height: 900 } };
const medium = { viewport: { width: 1024, height: 768 } };
const compact = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};
const narrow = {
  viewport: { width: 320, height: 568 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 2 : undefined,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    // Full-flow coverage: Chromium and WebKit, plus a Firefox smoke lane.
    {
      name: 'chromium-wide',
      metadata: { lane: 'full' },
      use: { ...devices['Desktop Chrome'], ...wide },
    },
    {
      name: 'webkit-wide',
      metadata: { lane: 'full' },
      use: { ...devices['Desktop Safari'], ...wide },
    },
    {
      name: 'firefox-wide',
      metadata: { lane: 'full' },
      use: { ...devices['Desktop Firefox'], ...wide },
    },
    // Layout and visual evidence at the medium breakpoint.
    {
      name: 'chromium-medium',
      metadata: { lane: 'visual' },
      use: { ...devices['Desktop Chrome'], ...medium },
    },
    // Touch composition: full flow on Chromium, touch smoke on WebKit.
    {
      name: 'chromium-compact',
      metadata: { lane: 'touch' },
      use: { ...devices['Desktop Chrome'], ...compact },
    },
    {
      name: 'webkit-compact',
      metadata: { lane: 'touch' },
      use: { ...devices['Desktop Safari'], ...compact },
    },
    // Narrow reflow (320 CSS px) and the metadata fallback.
    {
      name: 'chromium-narrow',
      metadata: { lane: 'narrow' },
      use: { ...devices['Desktop Chrome'], ...narrow },
    },
    {
      name: 'webkit-narrow',
      metadata: { lane: 'narrow' },
      use: { ...devices['Desktop Safari'], ...narrow },
    },
    // Optional local smoke against the branded Chrome installed on this machine.
    ...(isCi
      ? []
      : [
          {
            name: 'chrome-wide-local',
            metadata: { lane: 'local' },
            use: { ...devices['Desktop Chrome'], channel: 'chrome', ...wide },
          },
        ]),
  ],
});
