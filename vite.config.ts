/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Card artwork (`assets/*.jpg`) is bundled via `import.meta.glob` in
// src/ui/card-image.ts so image URLs are hashed and base-correct in every
// serving setup (dev, preview, GitHub Pages subpath).
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react()],
  server: {
    watch: {
      // The Godot frame's import cache, toolchain, and import staging churn
      // temp files that crash the watcher on Windows (EBUSY — including the
      // importer's .tmp rewrites inside godot/assets/cards/) — none of it is
      // app source.
      ignored: [
        '**/godot/.godot/**',
        '**/godot/assets/cards/**',
        '**/.toolchain/**',
        '**/public/godot/**',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
});
