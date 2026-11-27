import Phaser from 'phaser';
import { itemsOfCategory } from '../data/items';
import { buildCatFrames, CAT_FRAME, CAT_SIZE, catPalette, type CatLook, type Region } from './catArt';
import { makePixelTexture, withRows, type Palette } from './pixelArt';

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
  | 'cream-longhair'
  | 'taupe-spotted'
  | 'maine-coon'
  | 'lilac'
  | 'smoke'
  | 'cream-tabby'
  | 'blue-tabby'
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
  // Puschi: a fluffy cream cloud.
  'cream-longhair': {
    look: { pattern: 'plain', longhair: true },
    palette: catPalette({ fur: '#ead7b4', shadow: '#cdb48c', light: '#f8ead0', pattern: '#dcc39a', eyes: '#78b8e0', white: '#fff8ec' }),
  },
  // Fetzi: scruffy taupe with dark patches.
  'taupe-spotted': {
    look: { pattern: 'spots' },
    palette: catPalette({ fur: '#9a8676', shadow: '#7a685a', light: '#b29e8e', pattern: '#3e3430', eyes: '#9ad06a', white: '#efe6da' }),
  },
  // Bello: a big brown Maine Coon with a ruff and a bushy tail.
  'maine-coon': {
    look: { pattern: 'tabby', longhair: true },
    palette: catPalette({ fur: '#8a6a4e', shadow: '#6a4e38', light: '#a8866a', pattern: '#3e2a1e', eyes: '#e0b040', white: '#efe2cc' }),
  },
  // Nepeta: pale lilac-grey with wide, glassy green eyes.
  lilac: {
    look: { pattern: 'plain' },
    palette: catPalette({ fur: '#b8a8b8', shadow: '#968598', light: '#d2c4d0', pattern: '#b8a8b8', eyes: '#7ae05a' }),
  },
  // Rasta: a smoky, shaggy longhair.
  smoke: {
    look: { pattern: 'tabby', longhair: true },
    palette: catPalette({ fur: '#5e5a62', shadow: '#46424a', light: '#7a7680', pattern: '#3a363e', eyes: '#d8c05a', white: '#c8c2ca' }),
  },
  // Dusel: a sleepy cream tabby.
  'cream-tabby': {
    look: { pattern: 'tabby' },
    palette: catPalette({ fur: '#e2c89a', shadow: '#c4a878', light: '#f2dcb4', pattern: '#b8925e', eyes: '#c8a040', white: '#fbf0dc' }),
  },
  // Zappel: a jittery blue-grey tabby.
  'blue-tabby': {
    look: { pattern: 'tabby' },
    palette: catPalette({ fur: '#7a8aa0', shadow: '#5e6c80', light: '#96a4b8', pattern: '#4a566a', eyes: '#f0a030', white: '#e4e8ee' }),
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
const P_BACK = withRows(P_FRONT, {
  3: '....ohhhhhho....',
  4: '....ohhhhhho....',
  5: '....ohhhhhho....',
  7: '....ojjjjjjo....',
});
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

export const PLAYER_FRAME = { down: 0, up: 3, side: 6 } as const;

const PLAYER_PALETTE: Palette = {
  o: '#1e1a24', h: '#5a3a2a', s: '#f0c8a0', e: '#2a2030', w: '#c84a3a', j: '#3d5a80', p: '#4a4458', b: '#2a2430',
};

// ---------------------------------------------------------------- player (detailed)
// The NPCs above are variants of the plain figure; the player gets more detail:
// H/d hair highlight and shadow · c cheeks · x scarf stripe, W scarf shadow ·
// l/J jacket light and shadow side · z zipper · P trouser shadow · B boot highlight.
// Light comes from the top left.
const PD_FRONT = [
  '......oooo......',
  '.....ohHHho.....',
  '....ohHhhhdo....',
  '....ohssssdo....',
  '....osesseso....',
  '....oscsscso....',
  '.....owxwWo.....',
  '....olwxzjJo....',
  '...oljwxzjjJo...',
  '...oljWxzjjJo...',
  '...oljjjzjjJo...',
  '...osljjzjJSo...',
  '....oJJJJJJo....',
  '....opppppPo....',
  '....opppppPo....',
  '....opo..oPo....',
  '....oBo..oBo....',
  '....obo..obo....',
  '....ooo..ooo....',
  '................',
];
/** Legs only, so the scarf and zipper don't flip sides between steps. */
const PD_LEGS_A = {
  15: '....opo..oPo....',
  16: '...oBo....oPo...',
  17: '...ooo....oBo...',
  18: '..........ooo...',
};
const PD_LEGS_B = {
  15: '....opo..oPo....',
  16: '...oPo....oBo...',
  17: '...oBo....ooo...',
  18: '...ooo..........',
};
const PD_BACK = withRows(PD_FRONT, {
  1: '.....ohHHho.....',
  2: '....ohHhhhdo....',
  3: '....ohhhhhdo....',
  4: '....ohhhhhdo....',
  5: '....odhhhhdo....',
  6: '.....owWwWo.....',
  7: '....oljjjjJo....',
  8: '...oljJJJJjJo...',
  9: '...oljjJJjjJo...',
  10: '...oljjjjjjJo...',
  11: '...osljjjjJSo...',
});
const PD_SIDE = [
  '......oooo......',
  '.....ohHHho.....',
  '....ohHhhhho....',
  '....odhsssso....',
  '....odhssseo....',
  '....ohssscso....',
  '....owwxwWo.....',
  '...oWojjjJo.....',
  '.....oljjJo.....',
  '.....oljjJo.....',
  '.....oljsJo.....',
  '.....oljSJo.....',
  '.....oJJJJo.....',
  '.....oppPPo.....',
  '.....opppPo.....',
  '.....oppPo......',
  '.....oBBBo......',
  '.....obbbo......',
  '.....ooooo......',
  '................',
];
const PD_SIDE_WALK = withRows(PD_SIDE, {
  15: '....opo.oPo.....',
  16: '...oBo...oBo....',
  17: '...obbo..obbo...',
  18: '...oooo..oooo...',
});
const PLAYER_DETAIL_PALETTE: Palette = {
  ...PLAYER_PALETTE,
  H: '#7c5238',
  d: '#3e281c',
  S: '#d4a27c',
  c: '#e89a88',
  W: '#963226',
  x: '#f0dcb0',
  l: '#5676a2',
  J: '#2c425f',
  z: '#a4b2c6',
  P: '#363244',
  b: '#6a4428',
  B: '#8c6040',
};

// ---------------------------------------------------------------- NPCs
// Variants of the player figure: own rows where they differ, own palette.
// Frames: 0 front, 1 back, 2 side.
const NPC_LOOKS: Record<string, { patch: Record<number, string>; palette: Palette }> = {
  // Frau Häberle: grey bun, purple cardigan, white apron, blue skirt.
  haeberle: {
    patch: {
      0: '.......oo.......',
      1: '.....ohhhho.....',
      9: '...ojjwwwwjjo...',
      10: '...ojjwwwwjjo...',
      11: '...osjwwwwjso...',
      12: '....ojwwwwjo....',
    },
    palette: { ...PLAYER_PALETTE, h: '#cfcad0', w: '#f0ece0', j: '#7a5a8a', p: '#4a5a7a', b: '#3a2a20' },
  },
  // Jonas: red beanie and scarf, long green coat.
  jonas: {
    patch: {
      1: '.....owwwwo.....',
      2: '....owwwwwwo....',
      13: '....ojjjjjjo....',
    },
    palette: { ...PLAYER_PALETTE, h: '#6a4a2a', w: '#b8443a', j: '#3e5a4a', p: '#3a3a48', b: '#2a2430' },
  },
  // Boris Palmer: short dark hair, glasses, grey suit, tie and the golden chain of office.
  palmer: {
    patch: {
      4: '....ogeggego....',
      6: '.....owrrwo.....',
      7: '....ojkrrkjo....',
      8: '...ojjkrrkjjo...',
      9: '...ojjjkkjjjo...',
    },
    palette: { ...PLAYER_PALETTE, h: '#2e2622', g: '#4a4a5a', w: '#f4f2ee', r: '#3e5f8e', k: '#e8c050', j: '#56565f', p: '#3a3a44', b: '#1e1a20' },
  },
  // Günni: hood up, shades on, a pale face in the shadow. Very shady.
  guenni: {
    patch: {
      1: '.....ojjjjo.....',
      2: '....ojjjjjjo....',
      3: '....ojssssjo....',
      4: '....ojggggjo....',
      5: '....ojssssjo....',
      6: '.....ojjjjo.....',
      7: '....ojjjjjjo....',
    },
    palette: { ...PLAYER_PALETTE, j: '#3a4238', s: '#c8ac90', g: '#0e0e12', w: '#3a4238', p: '#2a3040', b: '#1c1c20' },
  },
  // Dieter Thomas Kuhn: huge blond curls, big shades, frilly shirt, glam jacket, flares.
  kuhn: {
    patch: {
      0: '....oooooooo....',
      1: '...ohhhhhhhho...',
      2: '..ohhhhhhhhhho..',
      3: '..ohhhsssshhho..',
      4: '..ohhggggggghho.',
      5: '..ohhsssssshho..',
      6: '...ohwwwwwwho...',
      7: '....ojwwwwjo....',
      15: '...oppo..oppo...',
      16: '...oppo..oppo...',
      17: '..obbbo..obbbo..',
      18: '..ooooo..ooooo..',
    },
    palette: { ...PLAYER_PALETTE, h: '#f0cc66', g: '#16141c', w: '#fff4ee', j: '#7a2e9a', p: '#e0a040', b: '#f4f0e8' },
  },
  // The demo: linen, knitwear and a lot of conviction.
  'vegan-1': {
    patch: { 1: '.....owwwwo.....', 2: '....owwwwwwo....', 6: '.....ohhhho.....' },
    palette: { ...PLAYER_PALETTE, h: '#b8502c', w: '#5a9a4a', j: '#e2d4ae', p: '#5a6a3a', b: '#6a4a30' },
  },
  'vegan-2': {
    patch: { 2: '...ohhhhhhhho...', 3: '...ohssssssho...', 5: '...ohssssssho...', 6: '...ohwwwwwwho...' },
    palette: { ...PLAYER_PALETTE, h: '#6e5034', w: '#e08a3a', j: '#6a7e52', p: '#44445a', b: '#3a2a20' },
  },
  'vegan-3': {
    patch: { 1: '.....ohhhho.....', 2: '....ohhhhhho....' },
    palette: { ...PLAYER_PALETTE, h: '#9a6ad8', w: '#f0e060', j: '#4a7a8a', p: '#3a3a48', b: '#2a2430' },
  },
};

// ---------------------------------------------------------------- placards (12×14, carried above the head)
const PLACARD_BOARD = [
  'oooooooooooo',
  'offffffffffo',
  'offffffffffo',
  'offffffffffo',
  'offffffffffo',
  'offffffffffo',
  'offffffffffo',
  'oooooooooooo',
  '.....oo.....',
  '.....oo.....',
  '.....oo.....',
  '.....oo.....',
  '.....oo.....',
  '.....oo.....',
];
/** Leaf, carrot and heart: the slogans are in the bubbles. */
const PLACARDS: Record<string, Record<number, string>> = {
  'placard-leaf': { 2: 'offfffxxfffo', 3: 'offffxxxxffo', 4: 'offfxxxxfffo', 5: 'offffyfffffo' },
  'placard-carrot': { 1: 'offffffyyffo', 2: 'offfffzzfffo', 3: 'offffzzzfffo', 4: 'offfzzzffffo', 5: 'offzzffffffo' },
  'placard-heart': { 2: 'offxxffxxffo', 3: 'offxxxxxxffo', 4: 'offfxxxxfffo', 5: 'offffxxffffo' },
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
  // An orange cat without the brain cell: still loading …
  'icon-buffer': {
    palette: { o: '#3a2a10', x: '#f4a45a' },
    rows: ['........', '........', '........', 'oo.oo.oo', 'xo.xo.xo', 'oo.oo.oo', '........', '........'],
  },
  // An orange cat that just received the brain cell.
  'icon-idea': {
    palette: { y: '#ffe680', o: '#3a2a10', l: '#fffbe0' },
    rows: ['..oooo..', '.oylyyo.', '.oylyyo.', '.oyyyyo.', '..oyyo..', '..oooo..', '..oooo..', '........'],
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
    [
      PD_FRONT,
      withRows(PD_FRONT, PD_LEGS_A),
      withRows(PD_FRONT, PD_LEGS_B),
      PD_BACK,
      withRows(PD_BACK, PD_LEGS_A),
      withRows(PD_BACK, PD_LEGS_B),
      PD_SIDE,
      PD_SIDE_WALK,
    ],
    PLAYER_DETAIL_PALETTE,
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

  for (const [look, { patch, palette }] of Object.entries(NPC_LOOKS)) {
    // Patches meant for the front also apply to the back and side where the row exists.
    const sidePatch = Object.fromEntries(Object.entries(patch).filter(([row]) => Number(row) <= 2));
    // The face (rows 3–5) is not seen from behind.
    const backPatch = Object.fromEntries(Object.entries(patch).filter(([row]) => Number(row) < 3 || Number(row) > 5));
    makePixelTexture(scene, `npc-${look}`, [withRows(P_FRONT, patch), withRows(P_BACK, backPatch), withRows(P_SIDE, sidePatch)], palette);
  }

  for (const [key, rows] of Object.entries(PLACARDS)) {
    const palette = { o: '#5a3a22', f: '#e8d8b0', x: key === 'placard-heart' ? '#d84a5a' : '#4e9a40', y: '#4e9a40', z: '#e8822e' };
    makePixelTexture(scene, key, [withRows(PLACARD_BOARD, rows)], palette);
  }

  // The one brain cell all orange cats share (a tiny pink brain).
  makePixelTexture(scene, 'braincell', [['.pp.', 'plpp', 'pppp', '.pp.']], { p: '#f29ab0', l: '#ffd8e2' });

  // Ball of yarn (decoy toy against the Rote Bande).
  makePixelTexture(
    scene,
    'yarn',
    [['..oooo..', '.orrlro.', 'orlrrlro', 'orrlrrro', 'olrrlrro', 'orrrlrlo', '.olrrro.', '..oooo..']],
    { o: '#4a1a2a', r: '#c84a6a', l: '#f08aa4' },
  );

  // Weather particles.
  makePixelTexture(scene, 'raindrop', [['r', 'r', 'r', 'r', 'r']], { r: '#b8d4f0' });
  makePixelTexture(scene, 'splash', [['.rr.', 'r..r']], { r: '#c8def4' });

  // Arrow on exits that lead to another district (points up; rotated per exit).
  makePixelTexture(
    scene,
    'exit-arrow',
    [['...oo...', '..offo..', '.offffo.', 'offffffo', 'ooffffoo', '..offo..', '..offo..', '..oooo..']],
    { o: '#2a2030', f: '#f2d8a7' },
  );

  makePixelTexture(scene, 'lamp', [LAMP], { o: '#15121a', m: '#2e2a36', g: '#ffe9a8' });
}
