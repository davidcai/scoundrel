/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Card artwork (`assets/*.jpg`) will be bundled via `import.meta.glob` in a
// game asset module so image URLs are hashed and base-correct in every
// serving setup (dev, preview, GitHub Pages subpath).
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  optimizeDeps: {
    exclude: ['phaser'],
  },
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
