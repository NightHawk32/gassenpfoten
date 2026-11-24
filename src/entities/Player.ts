import Phaser from 'phaser';
import { PLAYER_FRAME } from '../art/sprites';
import { tileCenter, toTile, type Point, type WorldGrid } from '../world/grid';

const WALK_SPEED = 56; // px/s = 3.5 tiles/s
const SNEAK_SPEED = 24;
/** Collision box around the feet. */
const HALF_W = 4;
const HALF_H = 3;

type Facing = 'down' | 'up' | 'side';

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  sneaking = false;
  /** True while the player moved this frame (cats notice movement). */
  moving = false;
  private path: Point[] = [];
  private facing: Facing = 'down';

  constructor(
    scene: Phaser.Scene,
    private readonly grid: WorldGrid,
    start: Point,
  ) {
    const p = tileCenter(start);
    this.sprite = scene.add.sprite(p.x, p.y, 'player', PLAYER_FRAME.down).setOrigin(0.5, 0.9);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get hasPath(): boolean {
    return this.path.length > 0;
  }

  /** Walks along a path to a world position. Returns false if it can't be reached. */
  walkTo(target: Point): boolean {
    const tiles = this.grid.findPath(toTile(this.sprite), toTile(target));
    if (!tiles) return false;
    this.path = tiles.map(tileCenter);
    return true;
  }

  stop(): void {
    this.path = [];
  }

  /** `dir` is the keyboard direction (-1…1 per axis); it overrides any path. */
  update(dt: number, dir: Point): void {
    const speed = this.sneaking ? SNEAK_SPEED : WALK_SPEED;
    let vx = 0;
    let vy = 0;

    if (dir.x || dir.y) {
      this.path = [];
      const len = Math.hypot(dir.x, dir.y);
      vx = (dir.x / len) * speed;
      vy = (dir.y / len) * speed;
      // Move each axis separately so the player slides along walls.
      const nx = this.sprite.x + vx * dt;
      if (!this.grid.boxBlocked(nx, this.sprite.y, HALF_W, HALF_H)) this.sprite.x = nx;
      const ny = this.sprite.y + vy * dt;
      if (!this.grid.boxBlocked(this.sprite.x, ny, HALF_W, HALF_H)) this.sprite.y = ny;
    } else if (this.path.length) {
      const next = this.path[0];
      const dx = next.x - this.sprite.x;
      const dy = next.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step) {
        this.sprite.setPosition(next.x, next.y);
        this.path.shift();
      } else {
        this.sprite.x += (dx / dist) * step;
        this.sprite.y += (dy / dist) * step;
      }
      if (dist > 0.01) {
        vx = dx;
        vy = dy;
      }
    }

    this.moving = vx !== 0 || vy !== 0;
    this.animate(vx, vy);
    this.sprite.setDepth(this.sprite.y);
  }

  private animate(vx: number, vy: number): void {
    if (!this.moving) {
      this.sprite.anims.stop();
      this.sprite.setFrame(PLAYER_FRAME[this.facing]);
      return;
    }
    if (Math.abs(vx) > Math.abs(vy)) {
      this.facing = 'side';
      this.sprite.setFlipX(vx < 0);
    } else {
      this.facing = vy < 0 ? 'up' : 'down';
      this.sprite.setFlipX(false);
    }
    this.sprite.anims.play(`player-walk-${this.facing}`, true);
    this.sprite.anims.timeScale = this.sneaking ? 0.5 : 1;
  }
}
