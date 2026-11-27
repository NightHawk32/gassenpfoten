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
  QUAY: 22,
  MAUER: 23,
  TOWER: 24,
  TOWER_WINDOW: 25,
  JETTY: 26,
  BOAT_L: 27,
  BOAT: 28,
  BOAT_R: 29,
  BRIDGE: 30,
  PARAPET: 31,
  PLASTER_A: 32,
  PLASTER_B: 33,
  PLASTER_C: 34,
  PLASTER_WINDOW_A: 35,
  PLASTER_WINDOW_B: 36,
  PLASTER_WINDOW_C: 37,
  GLASS: 38,
  GLASS_ROOF: 39,
  GRAVEL: 40,
  HEDGE: 41,
  BED: 42,
} as const;
const TILE_COUNT = 43;

/** Pastel house fronts along the Neckar (A, B, C). */
const PLASTER = ['#e8c87a', '#d9a0a0', '#a8c4b8'];

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

function plaster(ctx: Ctx, color: string): void {
  rect(ctx, color, 0, 0, S, S);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(0, S - 2, S, 2);
  ctx.fillRect(0, 0, 1, S);
}

/** Wooden planks running across the tile. */
function planks(ctx: Ctx, base: string, dark: string, light: string): void {
  rect(ctx, base, 0, 0, S, S);
  for (let y = 0; y < S; y += 4) {
    rect(ctx, dark, 0, y + 3, S, 1);
    rect(ctx, light, 0, y, S, 1);
    rect(ctx, dark, (y * 5) % S, y, 1, 3);
  }
}

/** Stocherkahn (flat punt), drawn over water. `end` = which end is pointed. */
function boat(ctx: Ctx, end: 'left' | 'right' | null): void {
  water(ctx);
  const hull = '#5a3a24';
  const deck = '#9c6a3c';
  let x0 = 0;
  let x1 = S;
  if (end === 'left') x0 = 3;
  if (end === 'right') x1 = S - 3;
  rect(ctx, hull, x0, 3, x1 - x0, 11);
  rect(ctx, deck, x0 + (end === 'left' ? 1 : 0), 4, x1 - x0 - (end ? 1 : 0), 9);
  for (let x = x0 + 3; x < x1 - 1; x += 4) rect(ctx, '#7e5230', x, 4, 1, 9);
  if (end === 'left') rect(ctx, hull, 1, 6, 2, 5);
  if (end === 'right') rect(ctx, hull, S - 3, 6, 2, 5);
  rect(ctx, '#2a4e6a', 0, 14, S, 1);
}

function tower(ctx: Ctx): void {
  rect(ctx, '#e6c25a', 0, 0, S, S);
  rect(ctx, '#d0aa48', 0, 0, 2, S);
  rect(ctx, '#f0d27a', S - 3, 0, 1, S);
}

// ---------------------------------------------------------------- Botanischer Garten

/** Greenhouse glass: white frames, pale green panes with a reflection and plants behind. */
function glass(ctx: Ctx, roofPane: boolean): void {
  rect(ctx, roofPane ? '#b6dcd0' : '#9cc8b8', 0, 0, S, S);
  if (!roofPane) {
    // Leaves pressing against the glass from inside.
    const rnd = seededRandom(11);
    for (let i = 0; i < 10; i++) rect(ctx, rnd() < 0.5 ? '#4e8a52' : '#6aa860', Math.floor(rnd() * 14), 6 + Math.floor(rnd() * 9), 3, 2);
  }
  rect(ctx, '#e4f2ec', 2, 1, 1, 4);
  rect(ctx, '#e4f2ec', 3, 1, 1, 2);
  const frame = '#f4f6f2';
  rect(ctx, frame, 0, 0, S, 1);
  rect(ctx, frame, 0, 0, 1, S);
  rect(ctx, frame, 8, 0, 1, S);
  if (roofPane) rect(ctx, frame, 0, 8, S, 1);
  else rect(ctx, '#d8dcd6', 0, S - 2, S, 2);
}

function gravel(ctx: Ctx): void {
  const rnd = seededRandom(23);
  rect(ctx, '#cbb894', 0, 0, S, S);
  for (let i = 0; i < 26; i++) rect(ctx, rnd() < 0.5 ? '#b3a07c' : '#ddd0b0', Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1);
}

function hedge(ctx: Ctx): void {
  const rnd = seededRandom(31);
  rect(ctx, '#2c5a2e', 0, 0, S, S);
  for (let i = 0; i < 22; i++) rect(ctx, rnd() < 0.5 ? '#3c7240' : '#24482a', Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 2);
  rect(ctx, '#1c3a20', 0, S - 2, S, 2);
}

/** A bed of herbs and flowers on dark soil. */
function bed(ctx: Ctx): void {
  const rnd = seededRandom(47);
  rect(ctx, '#4a3626', 0, 0, S, S);
  const flowers = ['#e86a8a', '#f0d050', '#b88ae8', '#f4f0f0'];
  for (let y = 1; y < S; y += 5) {
    for (let x = 1; x < S; x += 4) {
      rect(ctx, '#4e8a40', x, y + 1, 3, 3);
      rect(ctx, '#6aa850', x + 1, y, 1, 2);
      if (rnd() < 0.6) rect(ctx, flowers[Math.floor(rnd() * flowers.length)], x + 1, y, 1, 1);
    }
  }
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
    [TILE.QUAY]: (c) => {
      stone(c, '#b9a07a', '#9a8260', '#ccb690');
      rect(c, '#8a7254', 0, S - 2, S, 2);
    },
    [TILE.MAUER]: (c) => {
      stone(c, '#8f7a60', '#6e5c46', '#a28c70');
      rect(c, '#4a6a5a', 0, S - 3, S, 3);
    },
    [TILE.TOWER]: tower,
    [TILE.TOWER_WINDOW]: (c) => {
      tower(c);
      rect(c, '#5a4a38', 5, 3, 6, 10);
      rect(c, '#2c3a4f', 6, 4, 4, 8);
      rect(c, '#5a4a38', 7, 4, 2, 8);
    },
    [TILE.JETTY]: (c) => planks(c, '#8a6a48', '#5e4630', '#a6845c'),
    [TILE.BOAT_L]: (c) => boat(c, 'left'),
    [TILE.BOAT]: (c) => boat(c, null),
    [TILE.BOAT_R]: (c) => boat(c, 'right'),
    [TILE.BRIDGE]: (c) => stone(c, '#a89a88', '#8a7e6e', '#bcae9a'),
    [TILE.PARAPET]: (c) => {
      water(c);
      stone(c, '#9a8a74', '#76685a', '#b4a48c');
      rect(c, '#c4b49a', 0, 0, S, 2);
    },
    [TILE.PLASTER_A]: (c) => plaster(c, PLASTER[0]),
    [TILE.PLASTER_B]: (c) => plaster(c, PLASTER[1]),
    [TILE.PLASTER_C]: (c) => plaster(c, PLASTER[2]),
    [TILE.PLASTER_WINDOW_A]: (c) => {
      plaster(c, PLASTER[0]);
      windowOn(c, '#f4ead4', '#2c3a4f');
    },
    [TILE.PLASTER_WINDOW_B]: (c) => {
      plaster(c, PLASTER[1]);
      windowOn(c, '#f4ead4', '#2c3a4f');
    },
    [TILE.PLASTER_WINDOW_C]: (c) => {
      plaster(c, PLASTER[2]);
      windowOn(c, '#f4ead4', '#2c3a4f');
    },
    [TILE.GLASS]: (c) => glass(c, false),
    [TILE.GLASS_ROOF]: (c) => glass(c, true),
    [TILE.GRAVEL]: gravel,
    [TILE.HEDGE]: hedge,
    [TILE.BED]: bed,
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
