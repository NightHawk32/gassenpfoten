import Phaser from 'phaser';
import { CAT_FRAME, catTextureKey } from '../art/sprites';

/** Cat textures are 32×32; in the world they take up one 16-pixel tile. */
export const CAT_WORLD_SCALE = 0.5;
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
/** Companion (best friend following the player): starts walking when further than this (px), stops when this close. */
const FOLLOW_START = 36;
const FOLLOW_STOP = 20;
/** Trots to catch up when far behind; teleports (comes running from an alley) when hopelessly lost. */
const FOLLOW_SPEED = 46;
const FOLLOW_CATCH_UP = 64;
const FOLLOW_LOST = 14 * 16;

/** Frames that are a resting pose rather than a short gesture. */
const RESTING: number[] = [CAT_FRAME.loaf, CAT_FRAME.sleep];

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
  private iconTimer = 0;
  private eatTimer = 0;
  private readonly textureKey: string;
  private readonly size: number;
  /** Pose shown while idle (sitting, loafing or asleep). */
  private restFrame: number = CAT_FRAME.sit;
  /** A gesture or mood (happy, annoyed …) that overrides the idle pose for a while. */
  private emoteTimer = 0;
  /** Orange cats without the brain cell sometimes just … stop (src/world/brainCell.ts). */
  private frozenTimer = 0;
  /** Set while the cat is the player's companion: it follows them everywhere. */
  companionOf: Player | null = null;
  private followTimer = 0;

  constructor(
    scene: Phaser.Scene,
    readonly def: CatDef,
    private readonly grid: WorldGrid,
    private readonly exits: Point[],
  ) {
    this.textureKey = catTextureKey(def.coat);
    this.size = def.size ?? 1;
    this.sprite = scene.add
      .sprite(0, 0, this.textureKey, CAT_FRAME.sit)
      .setOrigin(0.5, 0.92)
      .setScale(CAT_WORLD_SCALE * this.size)
      .setVisible(false);
    // Generous hit area (texture pixels) so cats are easy to tap on a phone.
    this.sprite.setInteractive(new Phaser.Geom.Rectangle(-16, -16, 64, 64), Phaser.Geom.Rectangle.Contains);
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

  /** Stuck mid-thought (or mid-step) because the brain cell is elsewhere. */
  get frozen(): boolean {
    return this.frozenTimer > 0;
  }

  /** Stops dead for a while: no walking, no gestures, just a blank stare. */
  freeze(seconds: number): void {
    if (this.state === 'absent' || this.state === 'petting' || this.state === 'leaving' || this.state === 'fleeing') return;
    this.frozenTimer = Math.max(this.frozenTimer, seconds);
    this.sprite.anims.pause();
    // Sitting cats stare into the void; walking ones freeze mid-step.
    if (!this.path.length && this.state !== 'eating') this.sprite.setFrame(CAT_FRAME.curious);
    this.icon.setTexture('icon-buffer').setVisible(true);
    this.iconTimer = 0;
  }

  unfreeze(): void {
    if (!this.frozen) return;
    this.frozenTimer = 0;
    this.sprite.anims.resume();
    this.icon.setVisible(false);
    if (!this.path.length && this.state !== 'eating') this.sprite.setFrame(this.restFrame);
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

  /** Moves to a different spot in the district (e.g. shelter from the rain). */
  moveTo(tile: Point): void {
    const target = tileCenter(tile);
    this.home = target;
    this.restFrame = CAT_FRAME.sit;
    this.emoteTimer = 0;
    this.state = 'arriving';
    this.walkTo(target, WALK_SPEED * 1.6, () => (this.state = 'idle'));
  }

  /** Walks (or runs, if scared) to the nearest alley and disappears. */
  leave(scared: boolean): void {
    this.unfreeze();
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

  goToBowl(bowl: Point, speed = WALK_SPEED * 1.3): void {
    this.state = 'toBowl';
    this.emoteTimer = 0;
    this.walkTo(bowl, speed, () => {
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

    if (this.frozenTimer > 0) {
      this.frozenTimer -= dt;
      if (this.frozenTimer > 0) {
        this.icon.setPosition(Math.round(this.x), Math.round(this.y - 15 * this.size));
        return null;
      }
      this.frozenTimer = 1e-6; // let unfreeze() do the clean-up
      this.unfreeze();
    }

    if (this.companionOf) this.follow(dt, this.companionOf);

    // Noticing the player: movement close by makes the cat nervous (concept §4.1 shyness).
    // A companion trusts the player completely.
    if (!this.companionOf && (this.state === 'idle' || this.state === 'waiting' || this.state === 'toBowl' || this.state === 'eating')) {
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
          this.restFrame = CAT_FRAME.sit;
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
      this.sprite.anims.play(`${this.textureKey}-eat`, true);
      if (this.eatTimer <= 0) {
        this.state = 'idle';
        this.sprite.anims.stop();
        this.sprite.setFrame(CAT_FRAME.sit);
        event = 'ate';
      }
    } else if (this.state === 'idle' || this.state === 'waiting') {
      this.idleBehaviour(dt);
      this.bodyLanguage();
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
    this.icon.setPosition(Math.round(this.x), Math.round(this.y - 15 * this.size));
    return event;
  }

  /** Shows a mood for a while (happy after a favourite treat, annoyed after a bad one …). */
  emote(frame: number, seconds: number): void {
    if (this.path.length || this.frozen) return;
    this.sprite.anims.stop();
    this.sprite.setFrame(frame);
    this.emoteTimer = seconds;
  }

  /** Lies down (content after petting, or at night). */
  rest(sleep: boolean): void {
    this.restFrame = sleep ? CAT_FRAME.sleep : CAT_FRAME.loaf;
    if (!this.path.length && this.emoteTimer <= 0) this.sprite.setFrame(this.restFrame);
  }

  /** Ears and fur show how nervous the cat is, so the player can read it and slow down. */
  private bodyLanguage(): void {
    if (this.alert > 0.55) {
      this.restFrame = CAT_FRAME.sit;
      this.emoteTimer = 0;
      this.sprite.setFrame(CAT_FRAME.alert);
    } else if (this.alert > 0.2 && this.emoteTimer <= 0) {
      // Noticed you: ears up, head tilted, wakes up.
      this.restFrame = CAT_FRAME.sit;
      this.sprite.setFrame(CAT_FRAME.curious);
    } else if (this.emoteTimer <= 0 && Number(this.sprite.frame.name) === CAT_FRAME.curious) {
      this.sprite.setFrame(this.restFrame);
    }
  }

  private idleBehaviour(dt: number): void {
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.sprite.setFrame(this.restFrame);
      return;
    }
    this.idleTimer -= dt;
    if (this.idleTimer > 0) return;
    this.idleTimer = Phaser.Math.FloatBetween(2, 5);

    // Lying cats mostly stay down and only blink now and then.
    if (RESTING.includes(this.restFrame)) {
      if (Math.random() < 0.15) this.restFrame = CAT_FRAME.sit;
      this.sprite.setFrame(this.restFrame);
      return;
    }

    const roll = Math.random();
    if (this.companionOf && roll < 0.35) this.emote(roll < 0.1 ? CAT_FRAME.happy : CAT_FRAME.tail, 0.8);
    else if (roll < 0.25) this.emote(CAT_FRAME.tail, 0.6);
    else if (roll < 0.45) this.emote(CAT_FRAME.blink, 0.25);
    else if (roll < 0.6) this.emote(CAT_FRAME.groom, 1.6);
    else if (roll < 0.66) this.emote(CAT_FRAME.meow, 0.7);
    else if (roll < 0.78 && this.state === 'idle') this.rest(false);
    else if (this.state === 'idle' && !this.companionOf) {
      // Stretch the legs a little around the home spot.
      const home = toTile(this.home);
      const target = this.grid.nearestWalkable({
        x: home.x + Phaser.Math.Between(-1, 1),
        y: home.y + Phaser.Math.Between(-1, 1),
      });
      if (target) this.walkTo(tileCenter(target), WALK_SPEED);
    }
  }

  /** Companion: keep up with the player, then sit down nearby. */
  private follow(dt: number, player: Player): void {
    if (this.state !== 'idle') return;
    const d = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y);
    if (this.path.length && d <= FOLLOW_STOP) {
      // Close enough: stop and sit next to them.
      this.path = [];
      this.afterWalk = null;
      this.sprite.anims.stop();
      this.restFrame = CAT_FRAME.sit;
      this.sprite.setFrame(CAT_FRAME.sit);
      this.home = { x: this.x, y: this.y };
      return;
    }
    if (d > FOLLOW_LOST) {
      // Lost: pops out next to the player again.
      const tile = this.grid.nearestWalkable(toTile(player));
      if (tile) this.sprite.setPosition(tileCenter(tile).x + 6, tileCenter(tile).y);
      this.path = [];
      return;
    }
    this.followTimer -= dt;
    if (d <= FOLLOW_START || this.followTimer > 0) return;
    this.followTimer = 0.4;
    this.emoteTimer = 0;
    this.restFrame = CAT_FRAME.sit;
    this.walkTo({ x: player.x, y: player.y }, d > 4 * 16 ? FOLLOW_CATCH_UP : FOLLOW_SPEED, () => {
      this.home = { x: this.x, y: this.y };
    });
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
    this.restFrame = CAT_FRAME.sit;
    this.emoteTimer = 0;
    this.fedThisVisit = false;
    this.pettedThisVisit = false;
    this.alert = 0;
    this.path = [];
    this.afterWalk = null;
  }
}
