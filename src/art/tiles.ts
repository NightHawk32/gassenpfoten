import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { seededRandom } from './pixelArt';

/**
 * Procedurally drawn 16×16 placeholder tiles (own work, CC0). They will be
 * replaced by a Tiled tileset later; the tile ids below stay the interface.
 */
export const TILE = {
  VOID: 0,
  COBBLE: 1,
  COBBLE_2: 2,
  COBBLE_3: 3,
  GRASS: 4,
  ROOF: 5,
  ROOF_EDGE: 6,
  WALL: 7,
  WINDOW: 8,
  DOOR: 9,
  RATHAUS: 10,
  RATHAUS_WINDOW: 11,
  ARCADE: 12,
  WATER: 13,
  RIM: 14,
  STEPS: 15,
  CHURCH_ROOF: 16,
  CHURCH_WALL: 17,
  CHURCH_WINDOW: 18,
  CHURCH_DOOR: 19,
  VENT: 20,
  ROOF_SLATE_EDGE: 21,
} as const;
const TILE_COUNT = 22;

type Ctx = CanvasRenderingContext2D;
const S = TILE_SIZE;

function rect(ctx: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function cobble(ctx: Ctx, seed: number): void {
  const rnd = seededRandom(seed);
  rect(ctx, '#6f675f', 0, 0, S, S);
  const stones = ['#a39a8d', '#978e82', '#aca395', '#8f877c'];
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 ? 2 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 4 + offset;
      rect(ctx, stones[Math.floor(rnd() * stones.length)], x, row * 4, 3, 3);
      if (rnd() < 0.3) rect(ctx, '#bcb3a5', x + 1, row * 4, 1, 1);
    }
  }
}

function grass(ctx: Ctx): void {
  const rnd = seededRandom(7);
  rect(ctx, '#5c8a48', 0, 0, S, S);
  for (let i = 0; i < 14; i++) rect(ctx, rnd() < 0.5 ? '#4b7a3c' : '#73a05a', Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 2);
  rect(ctx, '#f0e08a', 4, 9, 1, 1);
}

function roof(ctx: Ctx, edge: boolean): void {
  rect(ctx, '#a8463a', 0, 0, S, S);
  for (let y = 0; y < S; y += 4) {
    rect(ctx, '#7e2f28', 0, y + 3, S, 1);
    const off = (y / 4) % 2 ? 2 : 0;
    for (let x = off; x < S; x += 4) rect(ctx, '#8c362e', x, y, 1, 3);
    rect(ctx, '#c05a4a', 0, y, S, 1);
  }
  if (edge) {
    rect(ctx, '#5a2420', 0, S - 3, S, 3);
    rect(ctx, '#3a1a18', 0, S - 1, S, 1);
  }
}

function slate(ctx: Ctx, edge: boolean): void {
  rect(ctx, '#4e5566', 0, 0, S, S);
  for (let y = 0; y < S; y += 3) {
    const off = (y / 3) % 2 ? 2 : 0;
    for (let x = off; x < S; x += 4) rect(ctx, '#3d4352', x, y + 2, 3, 1);
    rect(ctx, '#5e6678', 0, y, S, 1);
  }
  if (edge) {
    rect(ctx, '#2c303c', 0, S - 3, S, 3);
  }
}

function halfTimbered(ctx: Ctx): void {
  rect(ctx, '#e6dabd', 0, 0, S, S);
  const beam = '#5a3a28';
  rect(ctx, beam, 0, 0, S, 2);
  rect(ctx, beam, 0, S - 2, S, 2);
  rect(ctx, beam, 0, 0, 2, S);
  rect(ctx, beam, S - 2, 0, 2, S);
  for (let i = 2; i < S - 2; i++) rect(ctx, beam, i, i, 1, 1);
}

function windowOn(ctx: Ctx, frame: string, glass: string): void {
  rect(ctx, frame, 4, 3, 8, 9);
  rect(ctx, glass, 5, 4, 6, 7);
  rect(ctx, frame, 7, 4, 2, 7);
  rect(ctx, frame, 5, 7, 6, 1);
  rect(ctx, '#7aa0c0', 5, 4, 2, 1);
  // flower box
  rect(ctx, '#6b4a2e', 4, 12, 8, 2);
  rect(ctx, '#d84a4a', 5, 11, 1, 1);
  rect(ctx, '#e8a03a', 8, 11, 1, 1);
  rect(ctx, '#d84a4a', 10, 11, 1, 1);
}

function door(ctx: Ctx): void {
  rect(ctx, '#3a2618', 4, 4, 8, 12);
  rect(ctx, '#6b4a2e', 5, 5, 6, 11);
  rect(ctx, '#5a3a24', 7, 5, 1, 11);
  rect(ctx, '#d8b04a', 9, 10, 1, 1);
}

function rathaus(ctx: Ctx): void {
  rect(ctx, '#d6a55a', 0, 0, S, S);
  rect(ctx, '#b07a3a', 0, 0, S, 1);
  rect(ctx, '#3d5a8c', 0, 13, S, 2);
  rect(ctx, '#e8c88a', 0, 12, S, 1);
  for (let x = 1; x < S; x += 5) rect(ctx, '#a84a3a', x, 14, 2, 1);
}

function arcade(ctx: Ctx): void {
  cobble(ctx, 99);
  ctx.fillStyle = 'rgba(20, 14, 24, 0.45)';
  ctx.fillRect(0, 0, S, S);
  rect(ctx, '#b88a4a', 0, 0, S, 3);
  rect(ctx, '#b88a4a', 0, 0, 3, 8);
  rect(ctx, '#8a6234', 3, 3, 1, 5);
  rect(ctx, '#e0b878', 0, 0, S, 1);
}

function water(ctx: Ctx): void {
  rect(ctx, '#3f7ea8', 0, 0, S, S);
  rect(ctx, '#6aa6cc', 2, 4, 5, 1);
  rect(ctx, '#6aa6cc', 9, 10, 5, 1);
  rect(ctx, '#356c92', 4, 13, 6, 1);
}

function stone(ctx: Ctx, base: string, dark: string, light: string): void {
  rect(ctx, base, 0, 0, S, S);
  for (let y = 0; y < S; y += 5) {
    rect(ctx, dark, 0, y + 4, S, 1);
    const off = (y / 5) % 2 ? 4 : 0;
    for (let x = off; x < S; x += 8) rect(ctx, dark, x, y, 1, 4);
    rect(ctx, light, 0, y, S, 1);
  }
}

function steps(ctx: Ctx): void {
  for (let y = 0; y < S; y += 4) {
    rect(ctx, '#c9b48e', 0, y, S, 3);
    rect(ctx, '#9c8866', 0, y + 3, S, 1);
  }
}

function churchWindow(ctx: Ctx): void {
  stone(ctx, '#c2a878', '#a08658', '#d4bc90');
  rect(ctx, '#5a4a38', 5, 2, 6, 14);
  rect(ctx, '#3a4a6a', 6, 4, 4, 12);
  rect(ctx, '#3a4a6a', 7, 3, 2, 1);
  rect(ctx, '#8a6aa8', 6, 8, 4, 1);
  rect(ctx, '#c8a040', 7, 5, 2, 2);
}

function churchDoor(ctx: Ctx): void {
  stone(ctx, '#c2a878', '#a08658', '#d4bc90');
  rect(ctx, '#3a2618', 3, 3, 10, 13);
  rect(ctx, '#3a2618', 4, 2, 8, 1);
  rect(ctx, '#6b4a2e', 4, 4, 8, 12);
  rect(ctx, '#4a3220', 8, 4, 1, 12);
}

function vent(ctx: Ctx): void {
  cobble(ctx, 41);
  rect(ctx, '#3a3a42', 3, 4, 10, 8);
  for (let x = 4; x < 13; x += 2) rect(ctx, '#6a6a74', x, 5, 1, 6);
  rect(ctx, '#7a7a84', 3, 4, 10, 1);
}

/** Draws the tileset into a canvas texture called 'tiles' (one row of tiles). */
export function registerTiles(scene: Phaser.Scene): void {
  if (scene.textures.exists('tiles')) return;
  const tex = scene.textures.createCanvas('tiles', S * TILE_COUNT, S)!;
  const ctx = tex.getContext();
  const draws: Record<number, (c: Ctx) => void> = {
    [TILE.VOID]: (c) => rect(c, '#141018', 0, 0, S, S),
    [TILE.COBBLE]: (c) => cobble(c, 1),
    [TILE.COBBLE_2]: (c) => cobble(c, 2),
    [TILE.COBBLE_3]: (c) => cobble(c, 3),
    [TILE.GRASS]: grass,
    [TILE.ROOF]: (c) => roof(c, false),
    [TILE.ROOF_EDGE]: (c) => roof(c, true),
    [TILE.WALL]: halfTimbered,
    [TILE.WINDOW]: (c) => {
      halfTimbered(c);
      windowOn(c, '#5a3a28', '#2c3a4f');
    },
    [TILE.DOOR]: (c) => {
      halfTimbered(c);
      door(c);
    },
    [TILE.RATHAUS]: rathaus,
    [TILE.RATHAUS_WINDOW]: (c) => {
      rathaus(c);
      windowOn(c, '#f0e0c0', '#2c3a4f');
    },
    [TILE.ARCADE]: arcade,
    [TILE.WATER]: water,
    [TILE.RIM]: (c) => stone(c, '#b8a58a', '#8e7c62', '#d2c2a6'),
    [TILE.STEPS]: steps,
    [TILE.CHURCH_ROOF]: (c) => slate(c, false),
    [TILE.ROOF_SLATE_EDGE]: (c) => slate(c, true),
    [TILE.CHURCH_WALL]: (c) => stone(c, '#c2a878', '#a08658', '#d4bc90'),
    [TILE.CHURCH_WINDOW]: churchWindow,
    [TILE.CHURCH_DOOR]: churchDoor,
    [TILE.VENT]: vent,
  };
  for (let id = 0; id < TILE_COUNT; id++) {
    ctx.save();
    ctx.translate(id * S, 0);
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.clip();
    draws[id](ctx);
    ctx.restore();
  }
  tex.refresh();

  registerObjects(scene);
}

/** Larger scenery objects: tree crown, bench, soft light glow. */
function registerObjects(scene: Phaser.Scene): void {
  // Tree: 32×40, trunk at the bottom centre.
  const tree = scene.textures.createCanvas('tree', 32, 40)!;
  const t = tree.getContext();
  rect(t, '#4a3020', 14, 28, 4, 10);
  rect(t, '#2a1a12', 13, 37, 6, 2);
  const blobs: [number, number, number, string][] = [
    [16, 16, 13, '#2f5a30'],
    [10, 18, 8, '#36683a'],
    [22, 18, 8, '#36683a'],
    [16, 11, 9, '#3f7a42'],
    [12, 9, 5, '#4c8c4c'],
    [20, 13, 4, '#4c8c4c'],
  ];
  for (const [cx, cy, r, color] of blobs) {
    t.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      t.fillRect(cx - half, cy + y, half * 2, 1);
    }
  }
  tree.refresh();

  // Bench: 16×16, seen from above-front.
  const bench = scene.textures.createCanvas('bench', 16, 16)!;
  const b = bench.getContext();
  rect(b, '#3a2618', 1, 6, 14, 2);
  rect(b, '#8a5a32', 1, 4, 14, 2);
  rect(b, '#9c6a3c', 1, 8, 14, 3);
  rect(b, '#6b4424', 1, 11, 14, 1);
  rect(b, '#2a2430', 2, 12, 1, 3);
  rect(b, '#2a2430', 13, 12, 1, 3);
  bench.refresh();

  // Glow: soft white radial gradient, tinted per use.
  const glow = scene.textures.createCanvas('glow', 64, 64)!;
  const g = glow.getContext();
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glow.refresh();
  glow.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
