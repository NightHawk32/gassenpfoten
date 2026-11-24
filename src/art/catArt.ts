import type { Palette } from './pixelArt';

/**
 * Procedural cat sprites (own work, CC0). Cats are drawn at 32×32 and shown
 * at half scale in the world, so they keep their 16-pixel footprint but have
 * room for faces: ears, eye shapes, mouth, blush, tail and raised fur are
 * separate parameters, which lets one coat produce every mood.
 *
 * Every pixel also remembers which body part it belongs to (head, body,
 * tail …). The petting close-up uses that to find out where you touch.
 *
 * Palette keys: a outline · b fur · s fur shadow · l fur light · d pattern ·
 * g second pattern colour · f white fur · c pink · e iris · k pupil ·
 * h eye highlight · w whiskers
 */
export const CAT_SIZE = 32;

export type Region = 'head' | 'cheek' | 'chin' | 'ear' | 'body' | 'chest' | 'leg' | 'tail';

export type CatPattern = 'plain' | 'tabby' | 'tuxedo' | 'spots' | 'calico' | 'socks';

export interface CatLook {
  pattern: CatPattern;
  /** Fluffy outline and a fuller tail. */
  longhair?: boolean;
  /** Narrow eyes even when relaxed, notched ear: the Rote Bande look. */
  mean?: boolean;
}

/** Frame indices in every cat texture. */
export const CAT_FRAME = {
  sit: 0,
  blink: 1,
  tail: 2,
  happy: 3,
  purr: 4,
  alert: 5,
  annoyed: 6,
  curious: 7,
  meow: 8,
  groom: 9,
  walk1: 10,
  walk2: 11,
  walk3: 12,
  walk4: 13,
  eat1: 14,
  eat2: 15,
  loaf: 16,
  sleep: 17,
} as const;

type Eyes = 'open' | 'half' | 'happy' | 'shut' | 'wide' | 'narrow';
type Ears = 'up' | 'back' | 'perk';
type Tail = 'wrap' | 'up' | 'swish' | 'puff' | 'low';

interface SitPose {
  kind: 'sit';
  eyes: Eyes;
  ears: Ears;
  tail: Tail;
  mouth?: 'open' | 'lick';
  blush?: boolean;
  /** Head tilt in pixels (curious). */
  tilt?: number;
  /** Fur standing up (scared). */
  puff?: boolean;
  /** Paw raised to the mouth (grooming). */
  paw?: boolean;
}

interface SidePose {
  kind: 'side';
  /** Walk phase 0–3. */
  step: number;
  head: 'up' | 'down';
  eyes: Eyes;
  tail: 'up' | 'low';
  chew?: boolean;
}

interface LiePose {
  kind: 'loaf' | 'curl';
  eyes: Eyes;
}

type Pose = SitPose | SidePose | LiePose;

// ------------------------------------------------------------------ raster

type Pt = [number, number];

class Raster {
  readonly px: (string | null)[];
  readonly reg: (Region | null)[];

  constructor(
    readonly w = CAT_SIZE,
    readonly h = CAT_SIZE,
  ) {
    this.px = new Array(w * h).fill(null);
    this.reg = new Array(w * h).fill(null);
  }

  in(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): string | null {
    return this.in(x, y) ? this.px[y * this.w + x] : null;
  }

  region(x: number, y: number): Region | null {
    return this.in(x, y) ? this.reg[y * this.w + x] : null;
  }

  set(x: number, y: number, key: string, region?: Region | null): void {
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.px[i] = key;
    if (region !== undefined) this.reg[i] = region;
  }

  clear(x: number, y: number): void {
    if (!this.in(x, y)) return;
    this.px[y * this.w + x] = null;
    this.reg[y * this.w + x] = null;
  }

  /** Fills every pixel whose centre passes `test`. */
  fill(test: (cx: number, cy: number) => boolean, key: string, region: Region): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x + 0.5, y + 0.5)) this.set(x, y, key, region);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, key: string, region: Region): void {
    this.fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, key, region);
  }

  tri(a: Pt, b: Pt, c: Pt, key: string, region: Region): void {
    const side = (p: Pt, q: Pt, x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    this.fill(
      (x, y) => {
        const d1 = side(a, b, x, y);
        const d2 = side(b, c, x, y);
        const d3 = side(c, a, x, y);
        return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
      },
      key,
      region,
    );
  }

  /** A thick line through `points` (used for tails and legs). */
  stroke(points: Pt[], radius: number | ((t: number) => number), key: string, region: Region): void {
    const r = typeof radius === 'number' ? () => radius : radius;
    const samples: [number, number, number][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
      for (let k = 0; k <= n; k++) {
        const t = (i + k / n) / (points.length - 1);
        samples.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r(t)]);
      }
    }
    this.fill((x, y) => samples.some(([sx, sy, sr]) => (x - sx) ** 2 + (y - sy) ** 2 <= sr * sr), key, region);
  }

  /** Recolours pixels that match `test` (fur only, unless `any`). */
  paint(test: (x: number, y: number, region: Region | null) => boolean, key: string, any = false): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = this.get(x, y);
        if (!k || (!any && !FUR.has(k))) continue;
        if (test(x, y, this.region(x, y))) this.set(x, y, key);
      }
    }
  }

  /** Grows fur out of the edge of `regions` with a stable pseudo-random pattern. */
  fluff(regions: Region[], chance: number, seed: number): void {
    const add: [number, number, Region][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as Pt[]) {
          const r = this.region(x + dx, y + dy);
          if (r && regions.includes(r) && hash(x, y, seed) < chance) {
            add.push([x, y, r]);
            break;
          }
        }
      }
    }
    for (const [x, y, r] of add) this.set(x, y, 'b', r);
  }

  /** Light from the top left: a highlight on upper edges, shadow on lower edges. */
  shade(): void {
    const changes: [number, number, string][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== 'b') continue;
        if (!this.get(x + 1, y + 1) || !this.get(x, y + 2)) changes.push([x, y, 's']);
        else if (!this.get(x - 1, y - 1) || !this.get(x, y - 1)) changes.push([x, y, 'l']);
      }
    }
    for (const [x, y, k] of changes) this.set(x, y, k);
  }

  /** One-pixel dark outline around the whole silhouette. */
  outline(): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = 'a';
  }

  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let row = '';
      for (let x = 0; x < this.w; x++) row += this.px[y * this.w + x] ?? '.';
      out.push(row);
    }
    return out;
  }
}

const FUR = new Set(['b', 's', 'l']);

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Mirrors an x coordinate (continuous space) around the sprite centre. */
const mx = (x: number) => CAT_SIZE - x;
/** Mirrors a pixel column. */
const mpx = (x: number) => CAT_SIZE - 1 - x;

// ------------------------------------------------------------------ poses

function drawSit(r: Raster, pose: SitPose, look: CatLook): void {
  const tilt = pose.tilt ?? 0;
  const tailR = look.longhair || pose.tail === 'puff' ? 2.3 : 1.5;
  const tails: Record<Tail, Pt[]> = {
    wrap: [[22, 24], [25, 27], [22, 29.4], [16.5, 29.4]],
    up: [[23, 26], [27.5, 22], [28.5, 14], [26.8, 9.5]],
    swish: [[22, 25], [26.5, 24], [28.5, 20], [29.5, 15.5]],
    puff: [[23, 25], [27.5, 20], [28, 11.5], [26.5, 7]],
    low: [[22, 26], [26, 28], [29.5, 28.5]],
  };
  const tailInFront = pose.tail === 'wrap';
  if (!tailInFront) r.stroke(tails[pose.tail], tailR, 'b', 'tail');

  // Body: haunches, torso, chest.
  r.ellipse(16, 24.5, 9, 5.5, 'b', 'body');
  r.ellipse(16, 19.5, 6.5, 7, 'b', 'body');
  r.ellipse(16, 20, 3.4, 4.6, 'b', 'chest');
  // Front legs (the left one is raised when grooming).
  if (!pose.paw) r.fill((x, y) => x >= 12 && x < 15 && y >= 20 && y < 29.5, 'b', 'leg');
  r.fill((x, y) => x >= 17 && x < 20 && y >= 20 && y < 29.5, 'b', 'leg');
  if (tailInFront) r.stroke(tails.wrap, tailR, 'b', 'tail');

  // Head with cheek fluff, then ears.
  const hx = 16 + tilt;
  r.ellipse(hx, 11, 7.5, 6.3, 'b', 'head');
  r.ellipse(hx, 13.2, 8.6, 3.8, 'b', 'cheek');
  r.ellipse(hx, 14.6, 3, 1.8, 'b', 'chin');
  const ears: Record<Ears, [Pt, Pt, Pt, Pt, Pt, Pt]> = {
    up: [[8.5, 9], [9.8, 1.5], [15, 5.6], [10.3, 7.5], [10.8, 3.8], [13.4, 6]],
    perk: [[9, 8], [10.5, 0.4], [15, 5.2], [10.8, 6.8], [11.2, 2.6], [13.6, 5.6]],
    back: [[8, 10], [3.5, 5], [13, 6.4], [8.4, 8.6], [5.8, 6.3], [11.5, 7]],
  };
  const [a, b, c, ia, ib, ic] = ears[pose.ears];
  // A tilted head raises one ear and lowers the other.
  const shift = (p: Pt, side: 1 | -1): Pt => [p[0] + tilt, p[1] - tilt * side * 0.6];
  const right = (p: Pt): Pt => [mx(p[0]), p[1]];
  r.tri(shift(a, 1), shift(b, 1), shift(c, 1), 'b', 'ear');
  r.tri(shift(right(a), -1), shift(right(b), -1), shift(right(c), -1), 'b', 'ear');
  r.tri(shift(ia, 1), shift(ib, 1), shift(ic, 1), 'c', 'ear');
  r.tri(shift(right(ia), -1), shift(right(ib), -1), shift(right(ic), -1), 'c', 'ear');
  // A notch in the left ear.
  if (look.mean) r.clear(Math.round(10 + tilt), pose.ears === 'back' ? 5 : 3);

  // Grooming: the paw comes up in front of the face.
  if (pose.paw) {
    r.stroke([[13, 22], [10.5, 18.5], [11.5, 15.5]], 1.7, 'b', 'leg');
    r.ellipse(11.8, 14.6, 2.2, 1.8, 'b', 'leg');
  }
  if (look.longhair) r.fluff(['body', 'chest', 'cheek', 'tail'], 0.45, 3);
  if (pose.puff) r.fluff(['body', 'tail', 'head', 'cheek'], 0.7, 9);
}

function drawSide(r: Raster, pose: SidePose, look: CatLook): void {
  const tailR = look.longhair ? 2.1 : 1.4;
  const tail: Pt[] =
    pose.tail === 'up'
      ? [[25, 17], [28, 13.5], [29, 8.5], [27.2, 5.5]]
      : [[25, 18.5], [28.5, 20.5], [30.5, 24]];
  r.stroke(tail, tailR, 'b', 'tail');

  // Legs: a far pair and a near pair, swinging in opposite directions.
  const swing = [2, 0, -2, 0][pose.step % 4];
  const leg = (hipX: number, off: number, region: Region) => r.stroke([[hipX, 21], [hipX + off * 0.4, 25], [hipX + off, 28.6]], 1.15, 'b', region);
  leg(10.5, -swing, 'leg');
  leg(22.5, swing, 'leg');
  leg(12.5, swing, 'leg');
  leg(24.5, -swing, 'leg');

  const bob = pose.step % 2 ? 0.5 : 0;
  r.ellipse(17.5, 19 + bob, 8.5, 4.8, 'b', 'body');
  r.ellipse(11, 19 + bob, 3.6, 4.4, 'b', 'chest');

  if (pose.head === 'up') {
    r.ellipse(7.8, 13 + bob, 5.6, 4.9, 'b', 'head');
    r.ellipse(6.4, 15 + bob, 3.2, 2.2, 'b', 'chin');
    r.tri([8.6, 10 + bob], [11.3, 4.6 + bob], [12.6, 10.4 + bob], 'b', 'ear');
    r.tri([4, 10 + bob], [5, 4 + bob], [8.6, 9 + bob], 'b', 'ear');
    r.tri([5, 9.2 + bob], [5.5, 5.6 + bob], [7.6, 9 + bob], 'c', 'ear');
  } else {
    r.ellipse(9.5, 18.5, 3.4, 3.4, 'b', 'chest');
    r.ellipse(6.5, 22.5, 4.6, 4, 'b', 'head');
    r.ellipse(4.8, 24.4, 3, 2, 'b', 'chin');
    r.tri([7.5, 19.5], [10.8, 13.6], [11.8, 20.5], 'b', 'ear');
    r.tri([3.2, 19.5], [4.2, 13.4], [8, 18.6], 'b', 'ear');
    r.tri([4.3, 18.8], [4.8, 15.2], [7, 18.6], 'c', 'ear');
  }
  if (look.longhair) r.fluff(['body', 'chest', 'tail'], 0.4, 5);
}

function drawLie(r: Raster, pose: LiePose, look: CatLook): void {
  if (pose.kind === 'loaf') {
    r.stroke([[25.5, 25], [29, 27.5], [25, 29.4], [17, 29.4]], look.longhair ? 2 : 1.4, 'b', 'tail');
    r.ellipse(17, 24, 10, 5.4, 'b', 'body');
    r.ellipse(10.5, 25.5, 4, 3.6, 'b', 'chest');
    r.ellipse(8.2, 19.2, 5.2, 4.6, 'b', 'head');
    r.ellipse(7, 21.3, 3.2, 2.2, 'b', 'chin');
    r.tri([9, 16], [11.6, 10.6], [13, 16.4], 'b', 'ear');
    r.tri([4.2, 16], [5.2, 10.2], [9, 15], 'b', 'ear');
    r.tri([5.2, 15.2], [5.7, 11.8], [7.8, 15], 'c', 'ear');
  } else {
    r.ellipse(16.5, 23.5, 10.5, 6.2, 'b', 'body');
    r.ellipse(9.5, 24.5, 5, 4.2, 'b', 'head');
    r.tri([5, 21.5], [5.4, 16.5], [9.5, 20.5], 'b', 'ear');
    r.tri([9, 20.6], [12, 16.6], [13.2, 21.6], 'b', 'ear');
    r.tri([6, 20.8], [6.2, 18.2], [8.6, 20.6], 'c', 'ear');
    r.stroke([[26, 25.5], [24, 29.3], [14, 29.6], [6.5, 28.6]], look.longhair ? 2.1 : 1.6, 'b', 'tail');
  }
  if (look.longhair) r.fluff(['body', 'tail'], 0.4, 7);
}

// ------------------------------------------------------------------ patterns

function applyPattern(r: Raster, pose: Pose, look: CatLook): void {
  const front = pose.kind === 'sit';
  const p = look.pattern;

  if (p === 'tabby') {
    r.paint((x, y, reg) => {
      if (reg === 'body' || reg === 'leg') return front ? Math.abs(x - 15.5) > 3 && y % 3 === 0 : x % 3 === 0 && y < 27;
      if (reg === 'tail') return (x + y) % 3 === 0;
      if (reg === 'head') return front ? y <= 8 && [12, 14, 17, 19].includes(x) : x % 3 === 1 && y < 18;
      if (reg === 'cheek') return front && (y === 12 || y === 14) && Math.abs(x - 15.5) > 6;
      return false;
    }, 'd');
  }
  if (p === 'spots') {
    r.paint((x, y, reg) => {
      if (reg === 'chest' || reg === 'chin' || reg === 'ear') return false;
      const cx = Math.floor(x / 5);
      const cy = Math.floor(y / 5);
      if (hash(cx, cy, 11) > 0.42) return false;
      const ox = cx * 5 + 1 + hash(cx, cy, 12) * 3;
      const oy = cy * 5 + 1 + hash(cx, cy, 13) * 3;
      return (x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2 <= 3.2;
    }, 'd');
  }
  if (p === 'calico') {
    for (const [key, seed] of [['d', 21], ['g', 22]] as [string, number][]) {
      r.paint((x, y, reg) => {
        if (reg === 'chest' || reg === 'chin') return false;
        const cx = Math.floor(x / 7);
        const cy = Math.floor(y / 7);
        if (hash(cx, cy, seed) > 0.32) return false;
        const ox = cx * 7 + 3.5 + (hash(cx, cy, seed + 5) - 0.5) * 3;
        const oy = cy * 7 + 3.5 + (hash(cx, cy, seed + 6) - 0.5) * 3;
        return (x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2 <= 14;
      }, key);
    }
    // A patch over one eye gives every calico a face.
    if (front) r.paint((x, y, reg) => (reg === 'head' || reg === 'cheek' || reg === 'ear') && x < 15 && y < 13, 'd');
  }
  if (p === 'tuxedo' || p === 'socks' || p === 'calico') {
    // White chest (tuxedo), white paws (tuxedo, socks), white muzzle (all three).
    if (p === 'tuxedo' || p === 'calico') r.paint((_x, _y, reg) => reg === 'chest', 'f');
    r.paint((_x, y, reg) => reg === 'leg' && y >= (front ? 26 : 26), 'f');
    r.paint((_x, _y, reg) => reg === 'chin', 'f');
  }
  if (look.longhair) r.paint((_x, _y, reg) => reg === 'chest', 'l');
}

// ------------------------------------------------------------------ faces

function eye(r: Raster, x0: number, y0: number, eyes: Eyes): void {
  // x0 is the eye's outer column; 3 pixels wide towards the nose.
  const set = (i: number, y: number, k: string) => r.set(x0 + i, y, k);
  switch (eyes) {
    case 'open':
      for (let i = 0; i < 3; i++) for (let y = 0; y < 3; y++) set(i, y0 + y, 'e');
      for (let y = 0; y < 3; y++) set(1, y0 + y, 'k');
      set(0, y0, 'h');
      break;
    case 'wide':
      for (let i = 0; i < 3; i++) for (let y = -1; y < 3; y++) set(i, y0 + y, 'e');
      for (let i = 0; i < 3; i++) for (let y = 0; y < 3; y++) set(i, y0 + y, 'k');
      set(0, y0, 'h');
      break;
    case 'half':
      for (let i = 0; i < 3; i++) set(i, y0, 'a');
      for (let i = 0; i < 3; i++) set(i, y0 + 1, 'e');
      set(1, y0 + 1, 'k');
      break;
    case 'narrow':
      for (let i = 0; i < 3; i++) set(i, y0, 'a');
      set(0, y0 + 1, 'e');
      set(1, y0 + 1, 'k');
      set(2, y0 + 1, 'e');
      // Lowered brow towards the nose.
      set(2, y0 - 1, 'a');
      break;
    case 'happy':
      set(0, y0 + 1, 'a');
      set(1, y0, 'a');
      set(2, y0 + 1, 'a');
      break;
    case 'shut':
      set(0, y0 + 1, 'a');
      set(1, y0 + 2, 'a');
      set(2, y0 + 1, 'a');
      break;
  }
}

function drawSitFace(r: Raster, pose: SitPose, look: CatLook): void {
  const t = pose.tilt ?? 0;
  const eyes = pose.eyes === 'open' && look.mean ? 'narrow' : pose.eyes;
  eye(r, 11 + t, 10, eyes);
  // Mirror the right eye around the tilted head centre.
  const right = (x: number) => mpx(x) + 2 * t;
  const tmp = new Raster();
  eye(tmp, 11, 10, eyes);
  for (let y = 0; y < CAT_SIZE; y++) for (let x = 0; x < 16; x++) {
    const k = tmp.get(x, y);
    if (k) r.set(right(x), y, k === 'h' ? 'e' : k);
  }
  // Highlight on the right eye sits on its outer edge too.
  if (eyes === 'open' || eyes === 'wide') r.set(right(11), 10, 'h');

  // Nose and mouth.
  r.set(15 + t, 13, 'c');
  r.set(16 + t, 13, 'c');
  if (pose.mouth === 'open') {
    for (const [x, y, k] of [[15, 14, 'a'], [16, 14, 'a'], [14, 15, 'a'], [15, 15, 'k'], [16, 15, 'k'], [17, 15, 'a'], [15, 16, 'c'], [16, 16, 'c']] as [number, number, string][]) r.set(x + t, y, k);
  } else if (pose.mouth === 'lick') {
    r.set(14 + t, 14, 'a');
    r.set(15 + t, 15, 'c');
  } else {
    r.set(14 + t, 14, 'a');
    r.set(15 + t, 15, 'a');
    r.set(16 + t, 15, 'a');
    r.set(17 + t, 14, 'a');
  }
  if (pose.blush) {
    r.set(10 + t, 13, 'c');
    r.set(21 + t, 13, 'c');
  }
  // Whiskers.
  for (const [x, y] of [[5, 13], [6, 13], [7, 13], [5, 15], [6, 14]] as Pt[]) {
    if (!r.get(x + t, y) || r.get(x + t, y) === 'a') r.set(x + t, y, 'w');
    if (!r.get(mpx(x) + t, y) || r.get(mpx(x) + t, y) === 'a') r.set(mpx(x) + t, y, 'w');
  }
}

function drawSideFace(r: Raster, pose: SidePose | LiePose, look: CatLook): void {
  const eyes = pose.eyes === 'open' && look.mean ? 'narrow' : pose.eyes;
  let ex: number;
  let ey: number;
  let nose: Pt;
  if (pose.kind === 'side') {
    const bob = pose.step % 2 ? 1 : 0;
    const down = pose.head === 'down';
    ex = down ? 4 : 5;
    ey = down ? 21 : 11 + bob;
    nose = down ? [2, 24] : [3, 14 + bob];
  } else if (pose.kind === 'loaf') {
    ex = 5;
    ey = 17;
    nose = [3, 20];
  } else {
    ex = 6;
    ey = 22;
    nose = [5, 26];
  }
  // Side view: one eye, two pixels wide.
  switch (eyes) {
    case 'open':
    case 'wide':
      r.set(ex, ey, 'e');
      r.set(ex + 1, ey, 'e');
      r.set(ex, ey + 1, 'k');
      r.set(ex + 1, ey + 1, 'e');
      r.set(ex + 1, ey, 'h');
      break;
    case 'half':
    case 'narrow':
      r.set(ex, ey, 'a');
      r.set(ex + 1, ey, 'a');
      r.set(ex, ey + 1, 'k');
      r.set(ex + 1, ey + 1, 'e');
      break;
    default:
      r.set(ex, ey + 1, 'a');
      r.set(ex + 1, ey + 1, 'a');
  }
  r.set(nose[0], nose[1], 'c');
  if (pose.kind === 'side' && pose.chew) r.set(nose[0] + 1, nose[1] + 2, 'k');
  else r.set(nose[0] + 1, nose[1] + 1, 'a');
  r.set(nose[0] - 1, nose[1] + 1, 'w');
  r.set(nose[0] - 2, nose[1] + 1, 'w');
}

// ------------------------------------------------------------------ frames

const POSES: Pose[] = [
  { kind: 'sit', eyes: 'open', ears: 'up', tail: 'wrap' }, // sit
  { kind: 'sit', eyes: 'shut', ears: 'up', tail: 'wrap' }, // blink
  { kind: 'sit', eyes: 'open', ears: 'up', tail: 'swish' }, // tail
  { kind: 'sit', eyes: 'happy', ears: 'up', tail: 'up', blush: true }, // happy
  { kind: 'sit', eyes: 'half', ears: 'up', tail: 'up', blush: true }, // purr
  { kind: 'sit', eyes: 'wide', ears: 'back', tail: 'puff', puff: true }, // alert
  { kind: 'sit', eyes: 'narrow', ears: 'back', tail: 'swish' }, // annoyed
  { kind: 'sit', eyes: 'open', ears: 'perk', tail: 'low', tilt: 1 }, // curious
  { kind: 'sit', eyes: 'half', ears: 'up', tail: 'up', mouth: 'open' }, // meow
  { kind: 'sit', eyes: 'shut', ears: 'up', tail: 'wrap', paw: true, mouth: 'lick', tilt: -1 }, // groom
  { kind: 'side', step: 0, head: 'up', eyes: 'open', tail: 'up' }, // walk1
  { kind: 'side', step: 1, head: 'up', eyes: 'open', tail: 'up' }, // walk2
  { kind: 'side', step: 2, head: 'up', eyes: 'open', tail: 'up' }, // walk3
  { kind: 'side', step: 3, head: 'up', eyes: 'open', tail: 'up' }, // walk4
  { kind: 'side', step: 1, head: 'down', eyes: 'shut', tail: 'low' }, // eat1
  { kind: 'side', step: 1, head: 'down', eyes: 'half', tail: 'low', chew: true }, // eat2
  { kind: 'loaf', eyes: 'half' }, // loaf
  { kind: 'curl', eyes: 'shut' }, // sleep
];

export interface CatFrames {
  frames: string[][];
  /** Body part per pixel, per frame (null = empty or outline). */
  regions: (Region | null)[][];
}

export function buildCatFrames(look: CatLook): CatFrames {
  const frames: string[][] = [];
  const regions: (Region | null)[][] = [];
  for (const pose of POSES) {
    const r = new Raster();
    if (pose.kind === 'sit') drawSit(r, pose, look);
    else if (pose.kind === 'side') drawSide(r, pose, look);
    else drawLie(r, pose, look);
    r.shade();
    applyPattern(r, pose, look);
    r.outline();
    if (pose.kind === 'sit') drawSitFace(r, pose, look);
    else drawSideFace(r, pose, look);
    frames.push(r.rows());
    regions.push([...r.reg]);
  }
  return { frames, regions };
}

/** Builds a full palette from a few base colours. */
export function catPalette(c: {
  fur: string;
  shadow: string;
  light: string;
  pattern: string;
  pattern2?: string;
  white?: string;
  eyes: string;
  outline?: string;
}): Palette {
  return {
    a: c.outline ?? '#1e1820',
    b: c.fur,
    s: c.shadow,
    l: c.light,
    d: c.pattern,
    g: c.pattern2 ?? c.pattern,
    f: c.white ?? '#f4f0ea',
    c: '#e8909c',
    e: c.eyes,
    k: '#141018',
    h: '#ffffff',
    w: '#d8d4dc',
  };
}
