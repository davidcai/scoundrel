/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Card artwork (`assets/*.jpg`) is bundled via `import.meta.glob` in
// src/ui/card-image.ts so image URLs are hashed and base-correct in every
// serving setup (dev, preview, GitHub Pages subpath).
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Phaser (~345 KB gzip, not tree-shakeable) gets its own chunk so
        // title/stats routes never load it; the renderer layer is reached
        // exclusively through the play screen's dynamic import.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
