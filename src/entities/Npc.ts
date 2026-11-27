import Phaser from 'phaser';
import type { NpcDef } from '../data/npcs';
import { uiScale } from '../systems/viewport';
import { attachBackdrop, BACKDROP } from '../ui/backdrop';
import { tileCenter, toTile, type Point, type WorldGrid } from '../world/grid';

const WALK_SPEED = 20;
/** Seconds a roaming NPC lingers at a spot before moving on. */
const LINGER: [number, number] = [5, 11];
/** Seconds a muttered line stays above the head. */
const BARK_SECONDS = 4.5;
/** Font size of muttered lines at the 640×360 design size (scaled like the HUD). */
const BARK_FONT = 11;

/**
 * A local during their hours. Most stand at their spot; NPCs with `roam`
 * stroll between several spots. They fade in and out instead of walking off.
 */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private present = false;
  /** Stands still while the player talks to them. */
  hold = false;
  private path: Point[] = [];
  private roamIndex = 0;
  private linger = Phaser.Math.FloatBetween(...LINGER);
  private bubble: Phaser.GameObjects.Text | null = null;
  private bubbleTimer = 0;
  /** Carried above the head (a demo placard), if the NPC has a `prop`. */
  private readonly prop: Phaser.GameObjects.Image | null;

  constructor(
    scene: Phaser.Scene,
    readonly def: NpcDef,
    spot: Point,
    private readonly grid: WorldGrid,
    /** Roaming targets (tiles); empty for NPCs that stay put. */
    private readonly roam: Point[] = [],
  ) {
    const p = tileCenter(spot);
    this.sprite = scene.add
      .sprite(p.x, p.y, `npc-${def.look}`, 0)
      .setOrigin(0.5, 0.9)
      .setDepth(p.y)
      .setAlpha(0)
      .setVisible(false);
    this.sprite.setInteractive(new Phaser.Geom.Rectangle(-4, -4, 24, 28), Phaser.Geom.Rectangle.Contains);
    this.sprite.setData('npc', this);
    this.prop = def.prop ? scene.add.image(p.x, p.y, def.prop).setOrigin(0.5, 1).setVisible(false) : null;
    // Placards bob up and down while marching.
    if (this.prop) scene.tweens.add({ targets: this.prop, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1 });
    // A little life: shifting weight now and then.
    scene.tweens.add({
      targets: this.sprite,
      scaleY: 0.97,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Phaser.Math.Between(0, 1400),
    });
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get here(): boolean {
    return this.present;
  }

  setPresent(on: boolean, instant = false): void {
    if (on === this.present) return;
    this.present = on;
    const scene = this.sprite.scene;
    if (on) this.sprite.setVisible(true);
    else this.hideBubble();
    if (instant) {
      this.sprite.setAlpha(on ? 1 : 0).setVisible(on);
      return;
    }
    scene.tweens.add({
      targets: this.sprite,
      alpha: on ? 1 : 0,
      duration: 800,
      onComplete: () => this.sprite.setVisible(this.present),
    });
  }

  /** Turns to face the player. */
  face(p: Point): void {
    this.sprite.setFrame(Math.abs(p.x - this.x) > Math.abs(p.y - this.y) ? 2 : p.y < this.y ? 1 : 0);
    this.sprite.setFlipX(p.x < this.x && Math.abs(p.x - this.x) > Math.abs(p.y - this.y));
  }

  update(dt: number): void {
    if (this.prop) {
      this.prop
        .setPosition(Math.round(this.x + 3), Math.round(this.y - 10))
        .setDepth(this.sprite.depth + 1)
        .setAlpha(this.sprite.alpha)
        .setVisible(this.sprite.visible);
    }
    if (this.bubble) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.hideBubble();
      else this.bubble.setPosition(Math.round(this.x), Math.round(this.y - (this.prop ? 26 : 22)));
    }
    if (!this.present || this.hold || this.roam.length < 2) return;

    if (!this.path.length) {
      this.linger -= dt;
      if (this.linger > 0) return;
      this.linger = Phaser.Math.FloatBetween(...LINGER);
      this.roamIndex = (this.roamIndex + Phaser.Math.Between(1, this.roam.length - 1)) % this.roam.length;
      this.path = (this.grid.findPath(toTile(this.sprite), this.roam[this.roamIndex]) ?? []).map(tileCenter);
      return;
    }

    const next = this.path[0];
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt;
    // Walking direction: side view left/right, otherwise front or back.
    if (Math.abs(dx) > Math.abs(dy)) this.sprite.setFrame(2).setFlipX(dx < 0);
    else this.sprite.setFrame(dy < 0 ? 1 : 0).setFlipX(false);
    if (dist <= step) {
      this.sprite.setPosition(next.x, next.y);
      this.path.shift();
      if (!this.path.length) this.sprite.setFrame(0).setFlipX(false);
    } else {
      this.sprite.x += (dx / dist) * step;
      this.sprite.y += (dy / dist) * step;
    }
    this.sprite.setDepth(this.sprite.y);
  }

  /** Says something aloud in a small bubble above the head. */
  mutter(text: string): void {
    this.hideBubble();
    const scene = this.sprite.scene;
    // Rendered at screen resolution, then shrunk by the camera zoom so it stays crisp.
    const ui = uiScale(scene.scale.width, scene.scale.height);
    this.bubble = scene.add
      .text(Math.round(this.x), Math.round(this.y - (this.prop ? 26 : 22)), text, {
        fontFamily: 'Georgia, serif',
        fontSize: `${Math.round(BARK_FONT * ui)}px`,
        color: '#fff6d5',
        padding: { x: Math.round(6 * ui), y: Math.round(4 * ui) },
        align: 'center',
        wordWrap: { width: Math.round(190 * ui), useAdvancedWrap: true },
      })
      .setOrigin(0.5, 1)
      .setScale(1 / scene.cameras.main.zoom)
      .setDepth(10003);
    attachBackdrop(this.bubble, BACKDROP.bubble, ui);
    this.bubbleTimer = BARK_SECONDS;
  }

  get muttering(): boolean {
    return !!this.bubble;
  }

  private hideBubble(): void {
    this.bubble?.destroy();
    this.bubble = null;
  }
}
