import { TILE } from '../art/tiles';
import { WorldGrid, type Point } from './grid';

/**
 * A district (area) is pure data: an ASCII map plus named spots and exits.
 * The engine builds tiles, collision and scenery from it. Add new districts
 * in src/world/districts/ and register them in districts/index.ts
 * (see docs/EXTENDING.md). Later this can be swapped for Tiled JSON maps
 * without changing the District interface.
 *
 * Map legend:
 *   # edge · . cobbles · g grass · R roof · W wall · w window · D door
 *   H Rathaus · h Rathaus window · A arcade · ~ water · o fountain rim
 *   s steps · c church roof · C church wall · i church window · d church door
 *   V vent (warm) · L street lamp · T tree · B bench
 *   Neckar: m quay (Neckarmauer, walkable) · M river wall · Z plaster house
 *   z plaster window · Y tower wall · y tower window · P tower roof
 *   j jetty · K Stocherkahn (walkable) · b bridge deck · N bridge parapet
 */
export interface Exit extends Point {
  /** Where this exit leads. Omitted = a dead end where cats come and go. */
  to?: { district: string; entry: string };
}

export interface DistrictDef {
  id: string;
  /** Rows of map characters, all the same length. */
  map: string[];
  /** Named places where cats sit, NPCs stand or quest things happen (tile coordinates). */
  spots: Record<string, Point[]>;
  /** Alleys out of the district. */
  exits: Exit[];
  /** Named arrival points; 'start' is used for a new game. */
  entries: Record<string, Point>;
  /** Optional: district stays locked until this story flag is set. */
  requiresFlag?: string;
}

export interface District {
  def: DistrictDef;
  width: number;
  height: number;
  tiles: number[][];
  grid: WorldGrid;
  /** Window tiles, lit at night. */
  windows: Point[];
  lamps: Point[];
  trees: Point[];
  benches: Point[];
}

const WALKABLE = new Set(['.', 'g', 'A', 's', 'V', 'm', 'j', 'K', 'b']);

const BASE_TILE: Record<string, number> = {
  '#': TILE.VOID,
  g: TILE.GRASS,
  R: TILE.ROOF,
  W: TILE.WALL,
  w: TILE.WINDOW,
  D: TILE.DOOR,
  H: TILE.RATHAUS,
  h: TILE.RATHAUS_WINDOW,
  A: TILE.ARCADE,
  '~': TILE.WATER,
  o: TILE.RIM,
  s: TILE.STEPS,
  c: TILE.CHURCH_ROOF,
  C: TILE.CHURCH_WALL,
  i: TILE.CHURCH_WINDOW,
  d: TILE.CHURCH_DOOR,
  V: TILE.VENT,
  T: TILE.GRASS,
  m: TILE.QUAY,
  M: TILE.MAUER,
  Y: TILE.TOWER,
  y: TILE.TOWER_WINDOW,
  P: TILE.CHURCH_ROOF,
  j: TILE.JETTY,
  K: TILE.BOAT,
  b: TILE.BRIDGE,
  N: TILE.PARAPET,
};

const PLASTER_WALLS = [TILE.PLASTER_A, TILE.PLASTER_B, TILE.PLASTER_C];
const PLASTER_WINDOWS = [TILE.PLASTER_WINDOW_A, TILE.PLASTER_WINDOW_B, TILE.PLASTER_WINDOW_C];

/**
 * Plaster houses cycle through three colours. A house is a run of Z/z in a
 * row; give neighbouring houses a gap (another tile) so they count as two.
 */
function plasterColour(row: string, x: number): number {
  let runs = 0;
  for (let i = 0; i <= x; i++) if ('Zz'.includes(row[i]) && !'Zz'.includes(row[i - 1] ?? '')) runs++;
  return (runs - 1) % 3;
}

const COBBLES = [TILE.COBBLE, TILE.COBBLE_2, TILE.COBBLE_3];

export function buildDistrict(def: DistrictDef): District {
  const { map } = def;
  const height = map.length;
  const width = map[0].length;
  if (map.some((r) => r.length !== width)) throw new Error(`District "${def.id}": map rows differ in length`);

  const tiles: number[][] = [];
  const solid: boolean[] = [];
  const windows: Point[] = [];
  const lamps: Point[] = [];
  const trees: Point[] = [];
  const benches: Point[] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const ch = map[y][x];
      let id = BASE_TILE[ch] ?? COBBLES[(x * 7 + y * 13) % 3];
      // Roof rows above a wall get a gutter edge.
      const below = map[y + 1]?.[x];
      if (ch === 'R' && below !== 'R') id = TILE.ROOF_EDGE;
      if ((ch === 'c' || ch === 'P') && below !== ch) id = TILE.ROOF_SLATE_EDGE;
      if (ch === 'Z') id = PLASTER_WALLS[plasterColour(map[y], x)];
      if (ch === 'z') id = PLASTER_WINDOWS[plasterColour(map[y], x)];
      if (ch === 'K' && map[y][x - 1] !== 'K') id = TILE.BOAT_L;
      else if (ch === 'K' && map[y][x + 1] !== 'K') id = TILE.BOAT_R;
      row.push(id);

      solid.push(!WALKABLE.has(ch));
      if ('whizy'.includes(ch)) windows.push({ x, y });
      if (ch === 'L') lamps.push({ x, y });
      if (ch === 'T') trees.push({ x, y });
      if (ch === 'B') benches.push({ x, y });
    }
    tiles.push(row);
  }

  const grid = new WorldGrid(width, height, solid);
  const check = (what: string, p: Point) => {
    if (grid.isSolid(p.x, p.y)) throw new Error(`District "${def.id}": ${what} at ${p.x},${p.y} is not walkable`);
  };
  for (const [name, points] of Object.entries(def.spots)) points.forEach((p) => check(`spot "${name}"`, p));
  def.exits.forEach((p) => check('exit', p));
  for (const [name, p] of Object.entries(def.entries)) check(`entry "${name}"`, p);

  return { def, width, height, tiles, grid, windows, lamps, trees, benches };
}
