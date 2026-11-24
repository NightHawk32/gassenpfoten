import { TILE_SIZE } from '../config';

export interface Point {
  x: number;
  y: number;
}

/** Centre of a tile in world pixels. */
export function tileCenter(t: Point): Point {
  return { x: t.x * TILE_SIZE + TILE_SIZE / 2, y: t.y * TILE_SIZE + TILE_SIZE / 2 };
}

export function toTile(p: Point): Point {
  return { x: Math.floor(p.x / TILE_SIZE), y: Math.floor(p.y / TILE_SIZE) };
}

/** Walkability grid with collision checks and A* pathfinding (8 directions, no corner cutting). */
export class WorldGrid {
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly solid: boolean[],
  ) {}

  isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
    return this.solid[ty * this.width + tx];
  }

  /** True if an axis-aligned box (centre x/y, half sizes) overlaps a solid tile. */
  boxBlocked(x: number, y: number, halfW: number, halfH: number): boolean {
    const x0 = Math.floor((x - halfW) / TILE_SIZE);
    const x1 = Math.floor((x + halfW - 0.001) / TILE_SIZE);
    const y0 = Math.floor((y - halfH) / TILE_SIZE);
    const y1 = Math.floor((y + halfH - 0.001) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
    }
    return false;
  }

  /** Closest walkable tile to `t` (itself if walkable), searching outwards. */
  nearestWalkable(t: Point, maxRadius = 4): Point | null {
    if (!this.isSolid(t.x, t.y)) return t;
    for (let r = 1; r <= maxRadius; r++) {
      let best: Point | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const n = { x: t.x + dx, y: t.y + dy };
          const d = dx * dx + dy * dy;
          if (!this.isSolid(n.x, n.y) && d < bestD) {
            best = n;
            bestD = d;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Tiles from `from` (exclusive) to `to` (inclusive), or null if unreachable. */
  findPath(from: Point, to: Point): Point[] | null {
    const goal = this.nearestWalkable(to);
    if (!goal) return null;
    if (goal.x === from.x && goal.y === from.y) return [];

    const w = this.width;
    const idx = (x: number, y: number) => y * w + x;
    const g = new Map<number, number>();
    const came = new Map<number, number>();
    const open: { i: number; f: number }[] = [];
    const h = (x: number, y: number) => {
      const dx = Math.abs(x - goal.x);
      const dy = Math.abs(y - goal.y);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    const start = idx(from.x, from.y);
    g.set(start, 0);
    open.push({ i: start, f: h(from.x, from.y) });
    const goalI = idx(goal.x, goal.y);
    const closed = new Set<number>();

    while (open.length) {
      // The grid is small (40×30), so a linear scan is fast enough.
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const { i } = open.splice(bi, 1)[0];
      if (i === goalI) break;
      if (closed.has(i)) continue;
      closed.add(i);
      const cx = i % w;
      const cy = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (this.isSolid(nx, ny)) continue;
          if (dx && dy && (this.isSolid(cx + dx, cy) || this.isSolid(cx, cy + dy))) continue;
          const ni = idx(nx, ny);
          const cost = g.get(i)! + (dx && dy ? Math.SQRT2 : 1);
          if (cost < (g.get(ni) ?? Infinity)) {
            g.set(ni, cost);
            came.set(ni, i);
            open.push({ i: ni, f: cost + h(nx, ny) });
          }
        }
      }
    }

    if (!came.has(goalI)) return null;
    const path: Point[] = [];
    for (let i = goalI; i !== start; i = came.get(i)!) path.push({ x: i % w, y: Math.floor(i / w) });
    return path.reverse();
  }
}
