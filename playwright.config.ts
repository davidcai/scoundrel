import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    locale: 'en-US',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: 'pnpm preview --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
  },
});
