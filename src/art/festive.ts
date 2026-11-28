import Phaser from 'phaser';
import { makePixelTexture, type Palette } from './pixelArt';

/*
 * Christmas market art (own work, CC0): market stalls in five colours, a
 * decorated fir tree and snowflakes. The shapes are generated in code so
 * every stall shares one outline and only the palette changes.
 */

export const STALL_W = 32;
export const STALL_H = 40;
export const TREE_W = 24;
export const TREE_H = 44;

/** Stall colours: r/R roof stripes, g/G goods. */
export const STALL_VARIANTS: Record<string, Palette> = {
  treats: { r: '#c83a3a', R: '#f4ead8', g: '#f0a0b0', G: '#e8d2a0' },
  gluehwein: { r: '#2e6a3e', R: '#f4ead8', g: '#b8283a', G: '#f4ead8' },
  lebkuchen: { r: '#8a5a2a', R: '#d89a5a', g: '#a0582a', G: '#f4ead8' },
  maronen: { r: '#5a3a6a', R: '#e8d8b0', g: '#6a3a1a', G: '#c89a5a' },
  crafts: { r: '#2a4a8a', R: '#f4ead8', g: '#f0c832', G: '#c8d8f0' },
};

const STALL_BASE: Palette = {
  o: '#2a1a14',
  s: '#f4f8ff',
  S: '#c8d6ea',
  w: '#9a6a40',
  W: '#5e3a22',
  k: '#c08a54',
  K: '#7a4a2a',
  b: '#3a2418',
  n: '#e8d8b0',
  N: '#7a2a1a',
  z: '#2a2228',
  y: '#ffd860',
  L: '#ff7a6a',
  B: '#7ac8ff',
};

/** Fairy-light bulbs on the stall (pixel x, y), for the glow at night. */
export const STALL_BULBS: { x: number; y: number; color: number }[] = [];

function stallRows(): string[] {
  const W = STALL_W;
  const grid = Array.from({ length: STALL_H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < STALL_H) grid[y][x] = c;
  };
  // Roof: a trapezoid from row 2 (narrow) to row 11 (full width), striped.
  const roofEdge = (y: number) => Math.round(8 - ((y - 2) * 7) / 9);
  for (let y = 2; y <= 11; y++) {
    const e = roofEdge(y);
    for (let x = e; x <= W - 1 - e; x++) {
      const edge = x === e || x === W - 1 - e || y === 11;
      set(x, y, edge ? 'o' : (x >> 2) % 2 ? 'R' : 'r');
    }
  }
  // Snow on the roof: a thick cap with an uneven lower edge.
  for (let x = 7; x <= W - 8; x++) set(x, 1, 's');
  for (let y = 2; y <= 4; y++) {
    const e = roofEdge(y);
    for (let x = e; x <= W - 1 - e; x++) {
      if (y < 4 || (x * 7) % 5 < 3) set(x, y, y === 4 || x === e || x === W - 1 - e ? 'S' : 's');
    }
  }
  // Posts.
  for (let y = 12; y < STALL_H - 1; y++) {
    set(1, y, 'o');
    set(2, y, 'W');
    set(3, y, 'W');
    set(W - 4, y, 'W');
    set(W - 3, y, 'W');
    set(W - 2, y, 'o');
  }
  // Back wall with the sign and a shelf of goods.
  for (let y = 12; y <= 25; y++) for (let x = 4; x <= W - 5; x++) set(x, y, 'b');
  for (let y = 14; y <= 17; y++) {
    for (let x = 10; x <= 21; x++) set(x, y, y === 14 || y === 17 || x === 10 || x === 21 ? 'N' : 'n');
  }
  for (let x = 12; x <= 19; x += 2) set(x, 15 + ((x >> 1) % 2), 'N');
  for (let x = 5; x <= W - 6; x++) {
    set(x, 21, 'k');
    if (x % 3 !== 0) set(x, 20, x % 6 < 3 ? 'g' : 'G');
    if (x % 3 === 1) set(x, 19, 'g');
  }
  // Fairy lights along the roof edge: a dark wire with coloured bulbs.
  STALL_BULBS.length = 0;
  const colours: [string, number][] = [['y', 0xffd860], ['L', 0xff7a6a], ['B', 0x7ac8ff]];
  for (let x = 2; x <= W - 3; x++) {
    const sag = Math.abs(((x - 2) % 9) - 4) < 2 ? 1 : 0;
    set(x, 12 + sag, 'z');
    if ((x - 2) % 3 === 1) {
      const [c, hex] = colours[((x - 2) / 3) % 3 | 0];
      set(x, 13 + sag, c);
      STALL_BULBS.push({ x, y: 13 + sag, color: hex });
    }
  }
  // Goods on the counter, the counter top and the planked front.
  for (let x = 4; x <= W - 5; x++) {
    if (x % 4 !== 3) set(x, 25, x % 8 < 4 ? 'g' : 'G');
    if (x % 4 === 1) set(x, 24, 'g');
  }
  for (let x = 1; x <= W - 2; x++) {
    set(x, 26, x === 1 || x === W - 2 ? 'o' : 'k');
    set(x, 27, x === 1 || x === W - 2 ? 'o' : 'K');
  }
  for (let y = 28; y < STALL_H - 1; y++) {
    for (let x = 2; x <= W - 3; x++) set(x, y, (y - 28) % 4 === 3 ? 'W' : 'w');
    set(1, y, 'o');
    set(W - 2, y, 'o');
  }
  for (let x = 1; x <= W - 2; x++) set(x, STALL_H - 1, 'o');
  return grid.map((r) => r.join(''));
}

const TREE_PALETTE: Palette = {
  o: '#0e2a1a',
  g: '#2e6a3e',
  G: '#1e4a2c',
  s: '#f4f8ff',
  y: '#ffd860',
  r: '#d83a3a',
  b: '#5aa8f0',
  W: '#5e3a22',
  p: '#a83a3a',
  P: '#e8c050',
};

/** Ornaments on the tree (pixel x, y), for the glow at night. */
export const TREE_LIGHTS: { x: number; y: number; color: number }[] = [];

function treeRows(): string[] {
  const W = TREE_W;
  const grid = Array.from({ length: TREE_H }, () => Array<string>(W).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < W && y >= 0 && y < TREE_H) grid[y][x] = c;
  };
  const mid = W / 2;
  // Star.
  for (const [x, y] of [[0, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [-1, 3], [0, 3], [1, 3], [-1, 4], [1, 4]]) {
    set(Math.floor(mid) + x - 1, y, 'y');
  }
  // Three tiers, each widening downwards, with snow on the tips.
  const tiers = [
    [5, 14, 1, 6],
    [12, 24, 3, 9],
    [21, 36, 4, 11],
  ];
  for (const [top, bottom, from, to] of tiers) {
    for (let y = top; y <= bottom; y++) {
      const half = from + ((to - from) * (y - top)) / (bottom - top);
      const x0 = Math.round(mid - half);
      const x1 = Math.round(mid + half) - 1;
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || x === x1;
        set(x, y, edge ? 'o' : x < mid ? 'g' : 'G');
      }
      if (y === bottom) for (let x = x0; x <= x1; x++) set(x, y, (x + y) % 3 ? 's' : 'o');
    }
  }
  // Baubles and lights.
  TREE_LIGHTS.length = 0;
  const balls: [number, number, string, number][] = [
    [11, 9, 'r', 0xff6a5a], [13, 12, 'y', 0xffd860], [9, 16, 'b', 0x7ac8ff], [14, 18, 'r', 0xff6a5a],
    [11, 21, 'y', 0xffd860], [7, 27, 'r', 0xff6a5a], [12, 26, 'b', 0x7ac8ff], [16, 29, 'y', 0xffd860],
    [9, 32, 'y', 0xffd860], [14, 33, 'r', 0xff6a5a], [5, 34, 'b', 0x7ac8ff], [18, 34, 'b', 0x7ac8ff],
  ];
  for (const [x, y, c, hex] of balls) {
    set(x, y, c);
    TREE_LIGHTS.push({ x, y, color: hex });
  }
  // Trunk and a wrapped present at the foot.
  for (let y = 37; y <= 39; y++) for (let x = 10; x <= 13; x++) set(x, y, 'W');
  for (let y = 39; y <= 43; y++) {
    for (let x = 4; x <= 9; x++) set(x, y, x === 6 || y === 41 ? 'P' : 'p');
    for (let x = 15; x <= 19; x++) set(x, y, x === 17 || y === 41 ? 'y' : 'b');
  }
  return grid.map((r) => r.join(''));
}

export function registerFestive(scene: Phaser.Scene): void {
  const rows = stallRows();
  for (const [variant, colours] of Object.entries(STALL_VARIANTS)) {
    makePixelTexture(scene, `stall-${variant}`, [rows], { ...STALL_BASE, ...colours });
  }
  makePixelTexture(scene, 'xmas-tree', [treeRows()], TREE_PALETTE);
  makePixelTexture(scene, 'snowflake', [['s']], { s: '#ffffff' });
  makePixelTexture(scene, 'snowflake-big', [['.s.', 'sss', '.s.']], { s: '#f4f8ff' });
}
