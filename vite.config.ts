import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Version shown on the title screen: package.json version plus the git commit,
// with "+" for uncommitted changes, so a tester's screenshot says which build it is.
const APP_VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
function gitCommit(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${hash}+` : hash;
  } catch {
    return 'dev'; // no git (e.g. a zip download)
  }
}

// The game is served from https://nighthawk32.github.io/gassenpfoten/ (GitHub Pages),
// so every build uses this base path. `npm run dev` and `npm run preview` use it too,
// which means path bugs show up locally before deployment.
// Keep it in sync with the repository name.
export const BASE_PATH = '/gassenpfoten/';

export default defineConfig({
  base: BASE_PATH,
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
  },
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
