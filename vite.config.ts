import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

// BASE_URL is provided by the hosting/build environment. Hash routing keeps
// every route on index.html, so no server rewrites are required.
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
});
