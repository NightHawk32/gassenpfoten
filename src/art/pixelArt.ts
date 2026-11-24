import Phaser from 'phaser';

/**
 * Tiny pixel-art helper: sprites are written as rows of characters, one
 * character per pixel, '.' is transparent and every other character is looked
 * up in a palette. This keeps placeholder art in code (no licence questions)
 * until real sprite sheets replace it.
 */
export type Palette = Record<string, string>;

/** Creates a texture with one frame per entry in `frames` (frame names 0, 1, 2 …). */
export function makePixelTexture(scene: Phaser.Scene, key: string, frames: string[][], palette: Palette): void {
  if (scene.textures.exists(key)) return;
  const h = frames[0].length;
  const w = frames[0][0].length;
  frames.forEach((rows, i) => {
    if (rows.length !== h || rows.some((r) => r.length !== w)) {
      throw new Error(`Sprite "${key}" frame ${i}: every frame must be ${w}×${h} pixels`);
    }
  });

  const tex = scene.textures.createCanvas(key, w * frames.length, h)!;
  const ctx = tex.getContext();
  frames.forEach((rows, f) =>
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) throw new Error(`Sprite "${key}": no colour for '${ch}'`);
        ctx.fillStyle = color;
        ctx.fillRect(f * w + x, y, 1, 1);
      }
    }),
  );
  tex.refresh();
  frames.forEach((_, f) => tex.add(f, 0, f * w, 0, w, h));
}

/** Mirrors a sprite horizontally (e.g. to get the other walking leg). */
export function mirror(rows: string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/** Returns a copy of `rows` with some rows replaced: `{ 15: '....' }`. */
export function withRows(rows: string[], replace: Record<number, string>): string[] {
  return rows.map((r, i) => replace[i] ?? r);
}

/** Deterministic pseudo-random numbers, so procedural art looks the same every run. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
