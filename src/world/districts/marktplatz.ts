import type { DistrictDef } from '../district';

/**
 * District 1: Marktplatz (stylised, concept §5). Rathaus with arcades at the
 * top, Neptunbrunnen in the middle, the bakery on the left, the Stiftskirche
 * with its steps bottom right. Legend: see ../district.ts.
 */
export const marktplatz: DistrictDef = {
  id: 'marktplatz',
  map: [
    '########################################',
    '#RRRRRRRRR..RRRRRRRRRRRRRRRR..RRRRRRRRR#',
    '#RRRRRRRRR..RRRRRRRRRRRRRRRR..RRRRRRRRR#',
    '#RRRRRRRRR..RRRRRRRRRRRRRRRR..RRRRRRRRR#',
    '#WwWwWwWwW..HhHhHhHHhHhHhHhH..WwWwWwWwW#',
    '#WwWDWwWwW..HHHHHHHHHHHHHHHH..WwWDWwWwW#',
    '#...........AAAAAAAAAAAAAAAA...........#',
    '#.L........L................L.......L..#',
    '#......................................#',
    '#RRRRRRR...............................#',
    '#RRRRRRR...............................#',
    '#RRRRRRR........B..........B...........#',
    '#WwWWwWW.........oooooo................#',
    '#WwDWwWW.....L...o~~~~o.....L..........#',
    '#...V............o~~~~o................#',
    '#................oooooo................#',
    '#..........................ccccccccccc.#',
    '#...............B..........ccccccccccc.#',
    '#.....L....................ccccccccccc.#',
    '#..........................ccccccccccc.#',
    '#RRRRRRRRR...T.............CCiCCCCCiCC.#',
    '#RRRRRRRRR.................CCiCCdCCiCC.#',
    '#WwWwWwWwW.........L........sssssssss..#',
    '#WwWDWwWwW.................gsssssssssg.#',
    '#...........................gg.....gg..#',
    '#....T.......................T.........#',
    '#......................................#',
    '#RRRR....RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
    '#RRRR....RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR#',
    '########################################',
  ],
  spots: {
    'stiftskirche-steps': [
      { x: 30, y: 22 },
      { x: 34, y: 23 },
    ],
    'bakery-vent': [{ x: 4, y: 14 }],
    'rathaus-arcade': [
      { x: 14, y: 6 },
      { x: 24, y: 6 },
    ],
    fountain: [
      { x: 16, y: 14 },
      { x: 23, y: 13 },
    ],
    'north-alley': [
      { x: 10, y: 2 },
      { x: 29, y: 2 },
    ],
    'south-alley': [{ x: 6, y: 27 }],
    'church-garden': [
      { x: 28, y: 24 },
      { x: 36, y: 24 },
    ],
  },
  exits: [
    { x: 10, y: 1 },
    { x: 29, y: 1 },
    { x: 6, y: 28, to: { district: 'neckarfront', entry: 'from-marktplatz' } },
  ],
  entries: {
    start: { x: 20, y: 9 },
    'from-neckarfront': { x: 6, y: 26 },
  },
};
