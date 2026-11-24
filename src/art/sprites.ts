import Phaser from 'phaser';
import { itemsOfCategory } from '../data/items';
import { buildCatFrames, CAT_FRAME, CAT_SIZE, catPalette, type CatLook, type Region } from './catArt';
import { makePixelTexture, mirror, withRows, type Palette } from './pixelArt';

/*
 * Placeholder sprites for the M1 prototype (own work, CC0).
 * Cats are 32×32 (shown at half size), the player 16×20, icons 8×8.
 */

// ---------------------------------------------------------------- cats
// Drawn procedurally at 32×32 (see catArt.ts) and shown at half scale.

export { CAT_FRAME } from './catArt';

export type Coat =
  | 'tuxedo'
  | 'brown-tabby'
  | 'grey-tabby'
  | 'silver'
  | 'white-spotted'
  | 'black'
  | 'calico'
  | 'grey-socks'
  | 'orange';

/** Orange is reserved for the Rote Bande (concept §4.7). */
export const COATS: Record<Coat, { look: CatLook; palette: Palette }> = {
  tuxedo: {
    look: { pattern: 'tuxedo' },
    palette: catPalette({ fur: '#26242c', shadow: '#16141a', light: '#3a3842', pattern: '#26242c', eyes: '#d8d05a' }),
  },
  'brown-tabby': {
    look: { pattern: 'tabby' },
    palette: catPalette({ fur: '#a8744a', shadow: '#83593a', light: '#c08c5e', pattern: '#5e3c24', eyes: '#7fc46a', white: '#ecd8b8' }),
  },
  'grey-tabby': {
    look: { pattern: 'tabby' },
    palette: catPalette({ fur: '#8f8c94', shadow: '#6e6b74', light: '#a8a5ac', pattern: '#4c4952', eyes: '#e0a840', white: '#d8d3cc' }),
  },
  silver: {
    look: { pattern: 'tabby', longhair: true },
    palette: catPalette({ fur: '#b4b0ba', shadow: '#918d98', light: '#cecad2', pattern: '#a29ea8', eyes: '#6ab0d8', white: '#efedf2' }),
  },
  'white-spotted': {
    look: { pattern: 'spots' },
    palette: catPalette({ fur: '#f0ebe2', shadow: '#d0c8bc', light: '#fffcf6', pattern: '#3a3236', eyes: '#d8b048', white: '#fffcf6' }),
  },
  black: {
    look: { pattern: 'plain' },
    palette: catPalette({ fur: '#1e1c24', shadow: '#121016', light: '#34323e', pattern: '#1e1c24', eyes: '#f0c832', outline: '#0a080c' }),
  },
  calico: {
    look: { pattern: 'calico' },
    palette: catPalette({ fur: '#f2ece2', shadow: '#d4cabc', light: '#fffaf2', pattern: '#d88a3e', pattern2: '#2a2428', eyes: '#8ac05a' }),
  },
  'grey-socks': {
    look: { pattern: 'socks' },
    palette: catPalette({ fur: '#6e7080', shadow: '#555766', light: '#868898', pattern: '#6e7080', eyes: '#e8c048' }),
  },
  orange: {
    look: { pattern: 'tabby', mean: true },
    palette: catPalette({ fur: '#e8873a', shadow: '#c06a28', light: '#f4a45a', pattern: '#a8501a', eyes: '#9ad04a', white: '#f6dcb8' }),
  },
};

export const catTextureKey = (coat: Coat) => `cat-${coat}`;

const catRegions = new Map<Coat, (Region | null)[][]>();

/** Body part at a pixel of a cat frame (32×32 texture coordinates). */
export function catRegionAt(coat: Coat, frame: number, x: number, y: number): Region | null {
  if (x < 0 || y < 0 || x >= CAT_SIZE || y >= CAT_SIZE) return null;
  return catRegions.get(coat)?.[frame]?.[y * CAT_SIZE + x] ?? null;
}

// ---------------------------------------------------------------- player
// o outline · h hair · s skin · e eyes · w scarf · j jacket · p trousers · b shoes
const P_FRONT = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohssssho....',
  '....osesseso....',
  '....osssssso....',
  '.....owwwwo.....',
  '....ojwwjjjo....',
  '...ojjjjjjjjo...',
  '...ojjjjjjjjo...',
  '...ojjjjjjjjo...',
  '...osjjjjjjso...',
  '....ojjjjjjo....',
  '....oppppppo....',
  '....oppppppo....',
  '....opo..opo....',
  '....opo..opo....',
  '....obo..obo....',
  '....ooo..ooo....',
  '................',
];
const WALK_LEGS = {
  15: '....opo..opo....',
  16: '...obo....opo...',
  17: '...ooo....obo...',
  18: '..........ooo...',
};
const P_FRONT_WALK = withRows(P_FRONT, WALK_LEGS);
const P_BACK = withRows(P_FRONT, {
  3: '....ohhhhhho....',
  4: '....ohhhhhho....',
  5: '....ohhhhhho....',
  7: '....ojjjjjjo....',
});
const P_BACK_WALK = withRows(P_BACK, WALK_LEGS);
const P_SIDE = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohhsssso....',
  '....ohhssseo....',
  '....ohssssso....',
  '.....owwwwo.....',
  '.....ojjjjo.....',
  '.....ojjjjo.....',
  '.....ojjjjo.....',
  '.....ojjsjo.....',
  '.....ojjsjo.....',
  '.....ojjjjo.....',
  '.....oppppo.....',
  '.....oppppo.....',
  '.....opppo......',
  '.....opppo......',
  '.....obbbo......',
  '.....ooooo......',
  '................',
];
const P_SIDE_WALK = withRows(P_SIDE, {
  15: '....opo.opo.....',
  16: '...opo...opo....',
  17: '...obbo..obbo...',
  18: '...oooo..oooo...',
});

export const PLAYER_FRAME = { down: 0, up: 3, side: 6 } as const;

const PLAYER_PALETTE: Palette = {
  o: '#1e1a24', h: '#5a3a2a', s: '#f0c8a0', e: '#2a2030', w: '#c84a3a', j: '#3d5a80', p: '#4a4458', b: '#2a2430',
};

// ---------------------------------------------------------------- icons (8×8)
const ICONS: Record<string, { rows: string[]; palette: Palette }> = {
  'icon-heart': {
    palette: { h: '#e8506a', l: '#ff9aaa' },
    rows: ['.hh.hh..', 'hlhhhhh.', 'hhhhhhh.', '.hhhhh..', '..hhh...', '...h....', '........', '........'],
  },
  'icon-alert': {
    palette: { x: '#ffd24a', o: '#3a2a10' },
    rows: ['..oooo..', '..oxxo..', '..oxxo..', '..oxxo..', '..oooo..', '..oxxo..', '..oooo..', '........'],
  },
  'icon-note': {
    palette: { n: '#fff0b0' },
    rows: ['....nn..', '....n.n.', '....n...', '....n...', '..nnn...', '.nnnn...', '..nn....', '........'],
  },
  'icon-question': {
    palette: { q: '#bfe3ff' },
    rows: ['..qqqq..', '.qq..qq.', '.....qq.', '....qq..', '...qq...', '........', '...qq...', '........'],
  },
  'icon-zzz': {
    palette: { z: '#c9c3e6' },
    rows: ['zzzz....', '...z....', '..z.....', '.z......', 'zzzz....', '........', '........', '........'],
  },
};

// ---------------------------------------------------------------- bowls (8×8)
const BOWL = ['........', '........', '........', '.ffffff.', 'obbbbbbo', '.obbbbo.', '..oooo..', '........'];

// ---------------------------------------------------------------- lamp (16×32)
const LAMP = [
  '................',
  '.....oooooo.....',
  '....ommmmmmo....',
  '....oggggggo....',
  '....oggggggo....',
  '....oggggggo....',
  '.....ommmmo.....',
  '......omo.......',
  ...Array<string>(21).fill('......omo.......'),
  '.....ommmo......',
  '....ommmmmo.....',
  '................',
];

/** Creates every sprite texture and animation. Called once from BootScene. */
export function registerSprites(scene: Phaser.Scene): void {
  for (const coat of Object.keys(COATS) as Coat[]) {
    const key = catTextureKey(coat);
    const { frames, regions } = buildCatFrames(COATS[coat].look);
    catRegions.set(coat, regions);
    makePixelTexture(scene, key, frames, COATS[coat].palette);
    scene.anims.create({
      key: `${key}-walk`,
      frames: scene.anims.generateFrameNumbers(key, {
        frames: [CAT_FRAME.walk1, CAT_FRAME.walk2, CAT_FRAME.walk3, CAT_FRAME.walk4],
      }),
      frameRate: 8,
      repeat: -1,
    });
    scene.anims.create({
      key: `${key}-eat`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [CAT_FRAME.eat1, CAT_FRAME.eat2] }),
      frameRate: 4,
      repeat: -1,
    });
  }

  makePixelTexture(
    scene,
    'player',
    [P_FRONT, P_FRONT_WALK, mirror(P_FRONT_WALK), P_BACK, P_BACK_WALK, mirror(P_BACK_WALK), P_SIDE, P_SIDE_WALK],
    PLAYER_PALETTE,
  );
  const walk = (name: string, frames: number[], rate: number) =>
    scene.anims.create({
      key: `player-walk-${name}`,
      frames: scene.anims.generateFrameNumbers('player', { frames }),
      frameRate: rate,
      repeat: -1,
    });
  walk('down', [1, 0, 2, 0], 8);
  walk('up', [4, 3, 5, 3], 8);
  walk('side', [7, 6], 6);

  for (const [key, { rows, palette }] of Object.entries(ICONS)) makePixelTexture(scene, key, [rows], palette);

  // One bowl per treat item, filled with the item's colour.
  for (const item of itemsOfCategory('treat')) {
    makePixelTexture(scene, `bowl-${item.id}`, [BOWL], { o: '#2a2a38', b: '#5a7ab0', f: item.color });
  }

  // Arrow on exits that lead to another district (points up; rotated per exit).
  makePixelTexture(
    scene,
    'exit-arrow',
    [['...oo...', '..offo..', '.offffo.', 'offffffo', 'ooffffoo', '..offo..', '..offo..', '..oooo..']],
    { o: '#2a2030', f: '#f2d8a7' },
  );

  makePixelTexture(scene, 'lamp', [LAMP], { o: '#15121a', m: '#2e2a36', g: '#ffe9a8' });
}
