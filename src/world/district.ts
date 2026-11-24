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

const WALKABLE = new Set(['.', 'g', 'A', 's', 'V']);

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
};

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
      if (ch === 'c' && below !== 'c') id = TILE.ROOF_SLATE_EDGE;
      row.push(id);

      solid.push(!WALKABLE.has(ch));
      if (ch === 'w' || ch === 'h' || ch === 'i') windows.push({ x, y });
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
