import Phaser from 'phaser';
import { itemsOfCategory } from '../data/items';
import { makePixelTexture, mirror, withRows, type Palette } from './pixelArt';

/*
 * Placeholder sprites for the M1 prototype (own work, CC0).
 * Cats are 16×16, the player 16×20, icons 8×8.
 */

// ---------------------------------------------------------------- cats
// a outline · b fur · d pattern · c pink (ears, nose) · e eyes · f white
const CAT_SIT = [
  '................',
  '..a.......a.....',
  '.aba.....aba....',
  '.acbaaaaabca....',
  '.abbbbbbbbbba...',
  '.abdbbbbbdbba...',
  '.abeabbbaeba....',
  '.abbbbcbbbbba...',
  '..abfffffba.....',
  '..abbbbbbbbaa.a.',
  '.abdbdbdbdbbbaba',
  '.abbbbbbbbbbbba.',
  '.abdbdbdbdbbba..',
  '.abfabbbbafba...',
  '..aa.aaaa.aa....',
  '................',
];

const CAT_TAIL = withRows(CAT_SIT, {
  7: '.abbbbcbbbbba.a.',
  8: '..abfffffba..aba',
  9: '..abbbbbbbbaaba.',
  10: '.abdbdbdbdbbba..',
});

const CAT_BLINK = withRows(CAT_SIT, { 6: '.abddbbbddba....' });

const CAT_WALK_1 = [
  '................',
  '................',
  '................',
  '................',
  '..a.a...........',
  '.abab.........a.',
  '.abbba.......ab.',
  '.aeabaaaaaaaab..',
  '.acbbbdbdbdbba..',
  '..affbbbbbbbba..',
  '...abbbbbbbbba..',
  '...ab.ab..ab.ab.',
  '...aa.aa..aa.aa.',
  '................',
  '................',
  '................',
];
const CAT_WALK_2 = withRows(CAT_WALK_1, {
  11: '....abab...abab.',
  12: '....aaaa...aaaa.',
});

/** Frame indices in every cat texture. */
export const CAT_FRAME = { sit: 0, tail: 1, blink: 2, walk1: 3, walk2: 4 } as const;

export type Coat = 'tuxedo' | 'brown-tabby' | 'grey-tabby' | 'orange';

export const COATS: Record<Coat, Palette> = {
  tuxedo: { a: '#121016', b: '#2b2932', d: '#2b2932', c: '#e08a96', e: '#d8d05a', f: '#f2eee6' },
  'brown-tabby': { a: '#2e1f17', b: '#a8744a', d: '#6e4529', c: '#e08a96', e: '#7fc46a', f: '#ecd8b8' },
  'grey-tabby': { a: '#26242a', b: '#8f8c94', d: '#55525c', c: '#d9909a', e: '#e0a840', f: '#d8d3cc' },
  orange: { a: '#3a1e10', b: '#e8873a', d: '#b85a1e', c: '#f0a0a0', e: '#9ad04a', f: '#f6dcb8' },
};

export const catTextureKey = (coat: Coat) => `cat-${coat}`;

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
    makePixelTexture(scene, key, [CAT_SIT, CAT_TAIL, CAT_BLINK, CAT_WALK_1, CAT_WALK_2], COATS[coat]);
    scene.anims.create({
      key: `${key}-walk`,
      frames: scene.anims.generateFrameNumbers(key, { frames: [CAT_FRAME.walk1, CAT_FRAME.walk2] }),
      frameRate: 6,
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

  makePixelTexture(scene, 'lamp', [LAMP], { o: '#15121a', m: '#2e2a36', g: '#ffe9a8' });
}
