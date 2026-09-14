/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Card artwork (`assets/*.jpg`) will be bundled via `import.meta.glob` in a
// game asset module so image URLs are hashed and base-correct in every
// serving setup (dev, preview, GitHub Pages subpath).
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  // Phaser's ESM build has only named exports (no default), so it must be
  // pre-bundled by Vite in dev for `import Phaser from 'phaser'` to resolve —
  // do not exclude it from optimizeDeps.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
