import type { DistrictDef } from '../district';

/**
 * District 3: the Botanischer Garten ("Bota"). The big Tropenhaus and a small
 * greenhouse at the top, gravel paths, a pond, herb beds and, behind the
 * hedges in the bottom-right corner, the shady spot where Günni sells
 * catnip to anyone (and any cat) who asks. Unlocked by the catnip quest.
 * Legend: see ../district.ts.
 */
export const bota: DistrictDef = {
  id: 'bota',
  requiresFlag: 'bota-open',
  map: [
    '########################################',
    '#XXXXXXXXXXXqqqqqqqqqqqqqqqqXXXXXXXXXXX#',
    '#XggggggggggqqqqqqqqqqqqqqqqggggggggggX#',
    '#XgqqqqqqgggqqqqqqqqqqqqqqqqggTggggTggX#',
    '#XgGGGGGGgggGGGGGGGGGGGGGGGGgggggTggggX#',
    '#XgGGGGGGgggGGGGGGGGGGGGGGGGggggggggggX#',
    '#X,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,X#',
    '#X,gggggggggggggggL,,gggggggggggggggg,X#',
    '#X,gggggggggggggTgg,,gggggggggggggggg,X#',
    '#X,ggoooooooooggggg,,ggeeeeeeeeeeeegg,X#',
    '#X,ggo~~~~~~~oggggg,,ggeeeeeeeeeeeegg,X#',
    '#X,ggo~~~~~~~oggggg,,gggggggggggggggg,X#',
    '#,,ggo~~~~~~~oggggg,,gggggggggggggggg,,#',
    '#X,ggo~~~~~~~oggggg,,ggeeeeeeeeeeeegg,X#',
    '#X,ggoooooooooggggg,,ggeeeeeeeeeeeegg,X#',
    '#X,gTgggggggggggBgg,,gggggggggggggggg,X#',
    '#X,gggggggBgggggggg,,LggggggggggggggL,X#',
    '#X,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,X#',
    '#XgggggggggTggggggg,,gggggggggggggggg,X#',
    '#Xggggggggggggggggg,,gggggggggggggggg,X#',
    '#Xggeeeeeeeeeeeeggg,,gggggggXXXXXXXXX,X#',
    '#Xggeeeeeeeeeeeeggg,,gggTgggXgggggggg,X#',
    '#XgggggggggggggggTg,,gggggggXggggBgTg,X#',
    '#Xggggggggggggggggg,,gggggggXgggggggg,X#',
    '#Xggeeeeeeeeeeeeggg,,gggggggXgggggggg,X#',
    '#Xggeeeeeeeeeeeeggg,,LggggggggTgggggg,X#',
    '#Xggggggggggggggggg,,,,,,,,,,,,,,,,,,,X#',
    '#Xggggggggggggggggg,,gggggggggggggggggX#',
    '#XXXXXXXXXXXXXXXXXX,,XXXXXXXXXXXXXXXXXX#',
    '########################################',
  ],
  spots: {
    greenhouse: [
      { x: 16, y: 6 },
      { x: 24, y: 7 },
    ],
    pond: [
      { x: 4, y: 12 },
      { x: 9, y: 15 },
    ],
    beds: [
      { x: 28, y: 11 },
      { x: 22, y: 15 },
    ],
    'dealer-corner': [
      { x: 31, y: 22 },
      { x: 34, y: 24 },
    ],
    guenni: [{ x: 33, y: 25 }],
  },
  exits: [
    { x: 19, y: 28, to: { district: 'marktplatz', entry: 'from-bota' } },
    { x: 1, y: 12 },
    { x: 38, y: 12 },
  ],
  entries: {
    start: { x: 20, y: 19 },
    'from-marktplatz': { x: 19, y: 26 },
  },
};
