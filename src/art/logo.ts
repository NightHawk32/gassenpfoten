import Phaser from 'phaser';
import { makePixelTexture, type Palette } from './pixelArt';

/*
 * The "Gassenpfoten" logo as pixel art (own work, CC0): chunky hand-drawn
 * letters, "GASSEN" in cream and "PFOTEN" in warm orange, each with a
 * top-to-bottom gradient, a dark outline and a drop shadow, plus a little
 * black cat sitting on the final N. Drawn in code like the other art, so it
 * stays crisp at any whole-number scale and needs no font.
 */

/** 9 rows tall; strokes are two pixels wide. */
const GLYPHS: Record<string, string[]> = {
  G: ['.#####.', '##...##', '##.....', '##.....', '##..###', '##...##', '##...##', '##...##', '.#####.'],
  A: ['.#####.', '##...##', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##'],
  S: ['.#####.', '##...##', '##.....', '###....', '.#####.', '....###', '.....##', '##...##', '.#####.'],
  E: ['#######', '##.....', '##.....', '##.....', '######.', '##.....', '##.....', '##.....', '#######'],
  N: ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##', '##...##', '##...##'],
  P: ['######.', '##...##', '##...##', '##...##', '######.', '##.....', '##.....', '##.....', '##.....'],
  F: ['#######', '##.....', '##.....', '##.....', '######.', '##.....', '##.....', '##.....', '##.....'],
  O: ['.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
};

/** Sitting cat (k body, y eyes, w white chest), drawn on top of the last letter. */
const CAT = [
  '.k...k...',
  '.kk.kk...',
  '.kkkkk...',
  '.kykyk...',
  '.kkkkk..k',
  '..kwk...k',
  '.kkwkk.k.',
  '.kkkkkkk.',
  '.kk.kk...',
];

const GLYPH_HEIGHT = 9;
const GAP = 1;
/** Outline (1 px) and drop shadow (2 px down) around the letters. */
const MARGIN = 1;
const SHADOW = 2;

// Gradients, one colour per glyph row (top light, bottom darker).
const CREAM = ['#fffaf0', '#fff2d2', '#ffeac0', '#fde0aa', '#f8d598', '#f2c886', '#ecbb78', '#e4ad6a', '#d89c5c'];
const ORANGE = ['#ffd2a0', '#ffc08a', '#ffb078', '#fca068', '#f6925c', '#ee8452', '#e4764a', '#d86842', '#c85c3c'];
const ROW_CHARS_A = '012345678';
const ROW_CHARS_B = 'ABCDEFGHI';

const PALETTE: Palette = {
  o: '#2a1626',
  z: '#0e0810',
  k: '#1a141e',
  y: '#f0c832',
  w: '#f4ece0',
  r: '#f2d8a7',
  ...Object.fromEntries(CREAM.map((c, i) => [ROW_CHARS_A[i], c])),
  ...Object.fromEntries(ORANGE.map((c, i) => [ROW_CHARS_B[i], c])),
};

export const LOGO_KEY = 'logo';

/** Builds the logo rows: word, outline, shadow and the cat. */
function logoRows(): string[] {
  const words = ['GASSEN', 'PFOTEN'];
  const letters = words.flatMap((word, wi) => [...word].map((ch) => ({ glyph: GLYPHS[ch], word: wi })));
  const textW = letters.reduce((sum, l) => sum + l.glyph[0].length, 0) + GAP * (letters.length - 1);
  const catH = CAT.length;
  const catW = CAT[0].length;
  // The cat sits on the top edge of the letters (its feet on their outline), with a 1 px rim around it.
  const top = catH + 1;
  const lastLetterX = MARGIN + textW - letters[letters.length - 1].glyph[0].length;
  const catX = lastLetterX - 1;
  const width = Math.max(textW + MARGIN * 2, catX + catW + 1);
  const height = top + GLYPH_HEIGHT + MARGIN + SHADOW;
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill('.'));

  // Letters.
  let x = MARGIN;
  for (const { glyph, word } of letters) {
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] === '#') grid[top + gy][x + gx] = (word ? ROW_CHARS_B : ROW_CHARS_A)[gy];
      }
    });
    x += glyph[0].length + GAP;
  }
  const isLetter = (c: string | undefined) => !!c && c !== '.' && c !== 'o' && c !== 'z';

  // Outline around every letter pixel (8 neighbours), then the shadow below.
  const filled = grid.map((row) => row.map(isLetter));
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      if (filled[yy][xx]) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (filled[yy + dy]?.[xx + dx]) near = true;
      if (near) grid[yy][xx] = 'o';
    }
  }
  // Shadow only under the baseline, so the open parts of E, F and G stay clean.
  const solid = grid.map((row) => row.map((c) => c !== '.'));
  const baseline = top + GLYPH_HEIGHT;
  for (let yy = baseline; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      if (solid[yy][xx]) continue;
      if (solid[yy - 1]?.[xx] || solid[yy - 2]?.[xx]) grid[yy][xx] = 'z';
    }
  }

  // The cat on the last N, with a light rim so it shows against the night sky.
  const catY = top - catH;
  const catPixel = (cx: number, cy: number) => CAT[cy]?.[cx] !== undefined && CAT[cy][cx] !== '.';
  for (let cy = -1; cy <= catH; cy++) {
    for (let cx = -1; cx <= CAT[0].length; cx++) {
      const gx = catX + cx;
      const gy = catY + cy;
      if (gy < 0 || gx < 0 || gx >= width || gy >= height) continue;
      if (catPixel(cx, cy)) grid[gy][gx] = CAT[cy][cx];
      else if (grid[gy][gx] === '.' && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => catPixel(cx + dx, cy + dy))) {
        grid[gy][gx] = 'r';
      }
    }
  }
  return grid.map((row) => row.join(''));
}

export function registerLogo(scene: Phaser.Scene): void {
  makePixelTexture(scene, LOGO_KEY, [logoRows()], PALETTE);
}

/** Logo rows for tools (e.g. generating the favicon). */
export const LOGO_ROWS = logoRows;
