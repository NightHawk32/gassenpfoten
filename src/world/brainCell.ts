import Phaser from 'phaser';
import { isOrange } from '../data/cats';
import type { Cat } from '../entities/Cat';

/**
 * The One Orange Brain Cell 🍊🧠
 *
 * Every orange cat in town shares a single brain cell. Whoever holds it acts
 * normally; the others now and then just stop – mid-step, mid-stare – until
 * it comes back. Every few seconds the cell hops to another orange cat
 * (you can see it fly when both are in view) or leaves the district entirely.
 * Very rarely it goes on a trip and every orange cat freezes at once.
 *
 * Gameplay side effect: a frozen Rote Bande cat doesn't steal, so the brain
 * cell's absence is the player's chance.
 */

export type BrainCellEvent =
  | { type: 'hop'; from: Cat; to: Cat }
  | { type: 'froze'; cat: Cat }
  | { type: 'outage' };

/** Seconds between hops. */
const HOP_EVERY: [number, number] = [7, 15];
/** Chance that a hop leaves the district instead of going to a cat here. */
const HOP_AWAY = 0.25;
/** Freezes per second for a cat without the cell (more while the cell is away). */
const FREEZE_RATE = 0.07;
const FREEZE_RATE_AWAY = 0.16;
const FREEZE_SECONDS: [number, number] = [2.5, 6];
/** Seconds until the rare district-wide outage, and how long it lasts. */
const OUTAGE_EVERY: [number, number] = [240, 600];
const OUTAGE_SECONDS = 8;

let holderName: string | null = null;

/** Name of the orange cat holding the brain cell in the current district, or null if it's elsewhere. */
export function brainCellHolder(): string | null {
  return holderName;
}

export class BrainCell {
  private holder: Cat | null = null;
  private hopTimer = Phaser.Math.FloatBetween(...HOP_EVERY);
  private outageTimer = Phaser.Math.FloatBetween(...OUTAGE_EVERY);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cats: Cat[],
    private readonly onEvent: (e: BrainCellEvent) => void,
  ) {
    holderName = null;
  }

  get current(): Cat | null {
    return this.holder;
  }

  update(dt: number): void {
    const orange = this.cats.filter((c) => isOrange(c.def) && c.present && c.state !== 'leaving' && c.state !== 'fleeing');
    if (this.holder && !orange.includes(this.holder)) this.setHolder(null);
    if (!orange.length) return;

    this.outageTimer -= dt;
    if (this.outageTimer <= 0) {
      this.outageTimer = Phaser.Math.FloatBetween(...OUTAGE_EVERY);
      this.hopTimer = OUTAGE_SECONDS + 1;
      this.setHolder(null);
      for (const cat of orange) cat.freeze(OUTAGE_SECONDS);
      this.onEvent({ type: 'outage' });
      return;
    }

    this.hopTimer -= dt;
    if (this.hopTimer <= 0) {
      this.hopTimer = Phaser.Math.FloatBetween(...HOP_EVERY);
      this.hop(orange);
    }

    const rate = this.holder ? FREEZE_RATE : FREEZE_RATE_AWAY;
    for (const cat of orange) {
      if (cat === this.holder || cat.frozen || Math.random() >= rate * dt) continue;
      this.freeze(cat, Phaser.Math.FloatBetween(...FREEZE_SECONDS));
    }
  }

  private hop(orange: Cat[]): void {
    const from = this.holder;
    const others = orange.filter((c) => c !== from);
    const to = !others.length || Math.random() < HOP_AWAY ? null : Phaser.Utils.Array.GetRandom(others);
    if (to === from) return;
    // The old holder notices the lights going out.
    if (from) this.freeze(from, Phaser.Math.FloatBetween(1.5, 3));
    this.setHolder(to);
    if (!to) return;
    if (from) {
      this.fly(from, to);
    } else {
      to.unfreeze();
      to.showIcon('icon-idea', 1.2);
    }
  }

  /** The cell flies in a little arc from one cat to the other. */
  private fly(from: Cat, to: Cat): void {
    const cam = this.scene.cameras.main.worldView;
    const visible = cam.contains(from.x, from.y) || cam.contains(to.x, to.y);
    const dot = this.scene.add.image(from.x, from.y - 12, 'braincell').setDepth(10002);
    const start = { x: from.x, y: from.y - 12 };
    const height = 18 + Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) * 0.25;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        dot.setPosition(
          Phaser.Math.Linear(start.x, to.x, k),
          Phaser.Math.Linear(start.y, to.y - 12, k) - Math.sin(k * Math.PI) * height,
        );
        dot.setAngle(k * 720);
      },
      onComplete: () => {
        dot.destroy();
        if (this.holder !== to) return;
        to.unfreeze();
        to.showIcon('icon-idea', 1.2);
        if (visible) this.onEvent({ type: 'hop', from, to });
      },
    });
  }

  private freeze(cat: Cat, seconds: number): void {
    cat.freeze(seconds);
    if (cat.frozen) this.onEvent({ type: 'froze', cat });
  }

  private setHolder(cat: Cat | null): void {
    this.holder = cat;
    holderName = cat?.def.name ?? null;
  }
}
