// Fails the build if any file or folder in public/ is not lower-kebab-case.
// GitHub Pages is case-sensitive; Windows and macOS usually are not, so a
// wrongly cased name works locally and breaks once deployed (concept §10.1).
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'public';
const DIR_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE_RE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)+$/;
const bad = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const ok = entry.isDirectory() ? DIR_RE.test(entry.name) : FILE_RE.test(entry.name);
    if (!ok) bad.push(relative('.', full));
    if (entry.isDirectory()) walk(full);
  }
}

try {
  walk(ROOT);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

if (bad.length) {
  console.error('✗ These asset names are not lower-kebab-case (e.g. "orange-cat-idle.png"):');
  bad.forEach((p) => console.error('   ' + p));
  process.exit(1);
}
console.log('✓ Asset names OK');
