import Phaser from 'phaser';
import type { NpcDef } from '../data/npcs';
import { tileCenter, type Point } from '../world/grid';

/** A local standing at their spot during their hours. They fade in and out instead of walking. */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  private present = false;

  constructor(
    scene: Phaser.Scene,
    readonly def: NpcDef,
    spot: Point,
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
}
