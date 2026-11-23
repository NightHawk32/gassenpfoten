import { defineConfig } from 'vite';

// The game is served from https://nighthawk32.github.io/gassenpfoten/ (GitHub Pages),
// so every build uses this base path. `npm run dev` and `npm run preview` use it too,
// which means path bugs show up locally before deployment.
// Keep it in sync with the repository name.
export const BASE_PATH = '/gassenpfoten/';

export default defineConfig({
  base: BASE_PATH,
  build: {
    outDir: 'dist',
    assetsDir: 'bundle', // JS/CSS bundles; game assets live in public/assets/
    assetsInlineLimit: 0, // keep pixel-art assets as real files
    chunkSizeWarningLimit: 2000, // Phaser itself is ~1.2 MB
  },
  server: {
    open: BASE_PATH,
  },
});
