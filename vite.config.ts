import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_URL is provided by the hosting/build environment. Hash routing keeps
// every route on index.html, so no server rewrites are required.
export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react()],
});
