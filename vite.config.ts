import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Canvas-2D map app; nothing exotic in the build. Worker support is on by default
// in Vite and will be used in a later phase for world generation.
// base: repo name for GitHub Pages (https://ribbit56.github.io/ccmapmaker/).
export default defineConfig({
  base: '/ccmapmaker/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
