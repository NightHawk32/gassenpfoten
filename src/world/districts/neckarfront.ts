import type { DistrictDef } from '../district';

/**
 * District 2: Neckarfront (concept §5). Pastel and half-timbered houses on
 * top, the Hölderlinturm with its garden on the left, the Neckarmauer with
 * steps down to a jetty and two moored Stocherkähne, the Eberhardsbrücke on
 * the right and the tip of the Neckarinsel across the water.
 * Unlocked by the first quest. Legend: see ../district.ts.
 */
export const neckarfront: DistrictDef = {
  id: 'neckarfront',
  requiresFlag: 'tutorial-done',
  map: [
    '########################################',
    '#RRRRRRRRRRRRRRRRRR..RRRRRRRRRRRRRRRRRR#',
    '#RRRRRRRRRRRRRRRRRR..RRRRRRRRRRRRRRRRRR#',
    '#RRRRRRRRRRRRRRRRRR..RRRRRRRRRRRRRRRRRR#',
    '#ZzZzZWwWwWzZZzWwwW..ZzZzZWwwWzZzZzWwwW#',
    '#ZZZZZWWDWWZZZZWDWW..ZZZZZWDWWZZZZZWWDW#',
    '#......................................#',
    '#..L..........L..........L..........L..#',
    '#......................................#',
    '#gggggggggg............................#',
    '#gTggggggTg.......B..........B.........#',
    '#gggggBgggg............................#',
    '#gggggggggg....T........T........T.....#',
    '#gggPPPPPgg............................#',
    '#gggPPPPPgg............................#',
    '#gggYyYyYggmmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
    '#gggYYYYYggmmmmmmmmmmmmmmmmmmmmmmmmmmmm#',
    '#MMMYYYYYMMMMMMMMMMMssMMMMMMMMMMMNbbNMM#',
    '#~~~~~~~~~~~~~~~~~~~jj~~~~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~KKKjjKKK~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~~~~jj~~~~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~NbbN~~#',
    '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~NbbN~~#',
    '#gggggggggggggggggggggggggggg~~~~NbbN~~#',
    '#ggTgggggggTgggggggTggggggTgg~~~~NbbN~~#',
    '#gggggggggggggggggggggggggggg~~~~NbbN~~#',
    '#ggggggTgggggggTgggggggTggggg~~~~NbbN~~#',
    '########################################',
  ],
  spots: {
    'hoelderlin-garden': [
      { x: 5, y: 10 },
      { x: 9, y: 12 },
    ],
    neckarmauer: [
      { x: 14, y: 16 },
      { x: 27, y: 15 },
    ],
    stocherkahn: [
      { x: 18, y: 19 },
      { x: 23, y: 19 },
    ],
    'riverside-doorsteps': [
      { x: 8, y: 6 },
      { x: 31, y: 6 },
    ],
    eberhardsbruecke: [
      { x: 34, y: 21 },
      { x: 35, y: 24 },
    ],
  },
  exits: [
    { x: 19, y: 1, to: { district: 'marktplatz', entry: 'from-neckarfront' } },
    { x: 1, y: 7 },
    // Later: over the bridge to the Neckarinsel.
    { x: 34, y: 28 },
  ],
  entries: {
    start: { x: 19, y: 8 },
    'from-marktplatz': { x: 19, y: 4 },
  },
};
