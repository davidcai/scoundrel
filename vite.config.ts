/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is env-driven so CI can build for GitHub Pages (BASE_URL=/scoundrel/).
// The hash router tolerates any base.
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Default node env (engine tests run without a DOM). UI/persistence test
    // files opt into jsdom via a `// @vitest-environment jsdom` docblock as
    // the first line of the test file.
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
})
