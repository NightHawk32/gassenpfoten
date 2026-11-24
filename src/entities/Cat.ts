import Phaser from 'phaser';
import { CAT_FRAME, catTextureKey } from '../art/sprites';
import type { CatDef } from '../data/cats';
import { tileCenter, toTile, type Point, type WorldGrid } from '../world/grid';
import type { Player } from './Player';

/**
 * absent   – not in the district
 * arriving – walking in from an alley to its spot
 * idle     – sitting around; can be fed or petted
 * waiting  – a bowl was put down; waits until the player steps back
 * toBowl / eating
 * petting  – the petting overlay is open
 * leaving / fleeing – walking (or running) to the nearest alley
 */
export type CatState = 'absent' | 'arriving' | 'idle' | 'waiting' | 'toBowl' | 'eating' | 'petting' | 'leaving' | 'fleeing';

export type CatEvent = 'fled' | 'ate' | 'gone' | null;

const WALK_SPEED = 18;
const FLEE_SPEED = 80;
const EAT_TIME = 2.6;

export class Cat {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly icon: Phaser.GameObjects.Image;
  state: CatState = 'absent';
  /** 0 … 1; at 1 the cat runs away. Rises when the player moves nearby. */
  alert = 0;
  fedThisVisit = false;
  pettedThisVisit = false;

  private home: Point = { x: 0, y: 0 };
  private path: Point[] = [];
  private speed = WALK_SPEED;
  private afterWalk: (() => void) | null = null;
  private idleTimer = 2;
  private poseTimer = 0;
  private iconTimer = 0;
  private eatTimer = 0;
  private readonly textureKey: string;

  constructor(
    scene: Phaser.Scene,
    readonly def: CatDef,
    private readonly grid: WorldGrid,
    private readonly exits: Point[],
  ) {
    this.textureKey = catTextureKey(def.coat);
    this.sprite = scene.add.sprite(0, 0, this.textureKey, CAT_FRAME.sit).setOrigin(0.5, 0.85).setVisible(false);
    // Generous hit area so cats are easy to tap on a phone.
    this.sprite.setInteractive(new Phaser.Geom.Rectangle(-8, -8, 32, 32), Phaser.Geom.Rectangle.Contains);
    this.sprite.setData('cat', this);
    this.icon = scene.add.image(0, 0, 'icon-alert').setOrigin(0.5, 1).setDepth(10002).setVisible(false);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get present(): boolean {
    return this.state !== 'absent';
  }

  /** Can the player interact with the cat right now? */
  get approachable(): boolean {
    return this.state === 'idle';
  }

  /** Places the cat directly on a spot (used when the game starts). */
  appearAt(tile: Point): void {
    const p = tileCenter(tile);
    this.home = p;
    this.sprite.setPosition(p.x, p.y).setVisible(true).setFrame(CAT_FRAME.sit);
    this.resetVisit();
    this.state = 'idle';
  }

  /** Walks in from the nearest alley to a spot. */
  arrive(tile: Point): void {
    const target = tileCenter(tile);
    const exit = tileCenter(this.nearestExit(target));
    this.sprite.setPosition(exit.x, exit.y).setVisible(true);
    this.resetVisit();
    this.home = target;
    this.state = 'arriving';
    this.walkTo(target, WALK_SPEED * 1.5, () => (this.state = 'idle'));
  }

  /** Walks (or runs, if scared) to the nearest alley and disappears. */
  leave(scared: boolean): void {
    this.state = scared ? 'fleeing' : 'leaving';
    if (scared) this.showIcon('icon-alert', 1.2);
    const exit = tileCenter(this.nearestExit(this.sprite));
    this.walkTo(exit, scared ? FLEE_SPEED : WALK_SPEED * 1.5, () => {
      this.state = 'absent';
      this.sprite.setVisible(false);
      this.icon.setVisible(false);
    });
  }

  /** The player put a bowl down: wait for them to step back, then go and eat. */
  waitForBowl(): void {
    this.state = 'waiting';
    this.path = [];
  }

  goToBowl(bowl: Point): void {
    this.state = 'toBowl';
    this.walkTo(bowl, WALK_SPEED * 1.3, () => {
      this.state = 'eating';
      this.eatTimer = EAT_TIME;
      this.home = { x: this.sprite.x, y: this.sprite.y };
    });
  }

  showIcon(key: string, seconds: number): void {
    this.icon.setTexture(key).setVisible(true);
    this.iconTimer = seconds;
  }

  update(dt: number, player: Player, trustLevel: number): CatEvent {
    if (this.state === 'absent') return null;
    let event: CatEvent = null;

    // Noticing the player: movement close by makes the cat nervous (concept §4.1 shyness).
    if (this.state === 'idle' || this.state === 'waiting' || this.state === 'toBowl' || this.state === 'eating') {
      const radius = (1.5 + this.def.shyness) * 16;
      const d = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y);
      if (player.moving && d < radius) {
        const closeness = 1 + (radius - d) / radius;
        const trust = Math.max(0.25, 1 - 0.2 * trustLevel);
        this.alert += dt * 0.3 * this.def.shyness * (player.sneaking ? 0.2 : 1) * trust * closeness;
      } else {
        this.alert = Math.max(0, this.alert - dt * 0.35);
      }
      if (this.alert >= 1) {
        this.alert = 0;
        this.leave(true);
        return 'fled';
      }
    }

    // Movement along a path.
    if (this.path.length) {
      const next = this.path[0];
      const dx = next.x - this.sprite.x;
      const dy = next.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx > 0);
      this.sprite.anims.play(`${this.textureKey}-walk`, true);
      this.sprite.anims.timeScale = this.speed > WALK_SPEED * 2 ? 2.5 : 1;
      if (dist <= step) {
        this.sprite.setPosition(next.x, next.y);
        this.path.shift();
        if (!this.path.length) {
          this.sprite.anims.stop();
          this.sprite.setFrame(CAT_FRAME.sit);
          const done = this.afterWalk;
          this.afterWalk = null;
          done?.();
          // afterWalk may have changed the state.
          if ((this.state as CatState) === 'absent') event = 'gone';
        }
      } else {
        this.sprite.x += (dx / dist) * step;
        this.sprite.y += (dy / dist) * step;
      }
    } else if (this.state === 'eating') {
      this.eatTimer -= dt;
      // Chewing: alternate between sitting and closed eyes.
      this.sprite.setFrame(Math.floor(this.eatTimer * 4) % 2 ? CAT_FRAME.blink : CAT_FRAME.sit);
      if (this.eatTimer <= 0) {
        this.state = 'idle';
        this.sprite.setFrame(CAT_FRAME.sit);
        event = 'ate';
      }
    } else if (this.state === 'idle' || this.state === 'waiting') {
      this.idleBehaviour(dt);
    }

    // Icons: a timed icon wins; otherwise show "!" while nervous.
    if (this.iconTimer > 0) {
      this.iconTimer -= dt;
      if (this.iconTimer <= 0) this.icon.setVisible(false);
    } else if (this.alert > 0.45) {
      this.icon.setTexture('icon-alert').setVisible(true);
    } else {
      this.icon.setVisible(false);
    }

    this.sprite.setDepth(this.sprite.y);
    this.icon.setPosition(Math.round(this.x), Math.round(this.y - 15));
    return event;
  }

  private idleBehaviour(dt: number): void {
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) this.sprite.setFrame(CAT_FRAME.sit);
      return;
    }
    this.idleTimer -= dt;
    if (this.idleTimer > 0) return;
    this.idleTimer = Phaser.Math.FloatBetween(2, 5);

    const roll = Math.random();
    if (roll < 0.4) {
      this.sprite.setFrame(CAT_FRAME.tail);
      this.poseTimer = 0.5;
    } else if (roll < 0.7) {
      this.sprite.setFrame(CAT_FRAME.blink);
      this.poseTimer = 0.25;
    } else if (this.state === 'idle') {
      // Stretch the legs a little around the home spot.
      const home = toTile(this.home);
      const target = this.grid.nearestWalkable({
        x: home.x + Phaser.Math.Between(-1, 1),
        y: home.y + Phaser.Math.Between(-1, 1),
      });
      if (target) this.walkTo(tileCenter(target), WALK_SPEED);
    }
  }

  private walkTo(target: Point, speed: number, then?: () => void): void {
    const tiles = this.grid.findPath(toTile(this.sprite), toTile(target)) ?? [];
    this.path = tiles.map(tileCenter);
    // End exactly on the target (e.g. a bowl between tiles).
    if (this.path.length) this.path[this.path.length - 1] = { ...target };
    else this.path = [{ ...target }];
    this.speed = speed;
    this.afterWalk = then ?? null;
  }

  private nearestExit(from: Point): Point {
    let best = this.exits[0];
    let bestD = Infinity;
    for (const e of this.exits) {
      const c = tileCenter(e);
      const d = Phaser.Math.Distance.Squared(from.x, from.y, c.x, c.y);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private resetVisit(): void {
    this.fedThisVisit = false;
    this.pettedThisVisit = false;
    this.alert = 0;
    this.path = [];
    this.afterWalk = null;
  }
}
