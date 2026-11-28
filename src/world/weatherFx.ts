import Phaser from 'phaser';
import { isSnowSeason } from '../systems/season';
import type { Weather } from '../systems/weather';

/** How much each weather darkens the day (0…1). */
const DIM: Record<Weather, number> = { sunny: 0, cloudy: 0.12, rain: 0.26, fog: 0.1 };
/** Seconds for a full change between weathers. */
const BLEND_SECONDS = 4;
const FOG_BLOBS = 20;
/** Drawn under the night darkness (depth 10000), above everything else. */
const DEPTH = 9990;

/**
 * Weather effects in the world: rain with splashes, drifting fog banks and
 * a darker sky. In December rain falls as snow and clouds bring a few
 * flakes. Intensities blend smoothly when the weather changes.
 */
export class WeatherFx {
  private rain = 0;
  private fog = 0;
  private dim = 0;
  private snow = 0;
  private readonly snowy = isSnowSeason();
  private readonly flakes: Phaser.GameObjects.Particles.ParticleEmitter[];
  private readonly zone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private readonly drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly splashes: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly blobs: { img: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapW: number,
    mapH: number,
    weather: Weather,
  ) {
    this.drops = scene.add
      .particles(0, 0, 'raindrop', {
        emitZone: { type: 'random', source: this.zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedY: { min: 230, max: 290 },
        speedX: { min: -45, max: -30 },
        lifespan: { min: 350, max: 650 },
        alpha: { start: 0.75, end: 0.35 },
        frequency: 16,
        quantity: 3,
        emitting: false,
      })
      .setDepth(DEPTH);
    this.splashes = scene.add
      .particles(0, 0, 'splash', {
        emitZone: { type: 'random', source: this.zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: 260,
        scale: { start: 0.6, end: 1.5 },
        alpha: { start: 0.7, end: 0 },
        frequency: 30,
        quantity: 1,
        emitting: false,
      })
      .setDepth(DEPTH);

    // Snow: small and big flakes, slow and drifting.
    this.flakes = (['snowflake', 'snowflake-big'] as const).map((key, i) =>
      scene.add
        .particles(0, 0, key, {
          emitZone: { type: 'random', source: this.zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          speedY: i ? { min: 28, max: 42 } : { min: 18, max: 32 },
          speedX: { min: -14, max: 6 },
          lifespan: { min: 2500, max: 4500 },
          alpha: { start: i ? 0.95 : 0.8, end: 0, ease: 'Quad.easeIn' },
          frequency: i ? 90 : 45,
          quantity: 1,
          emitting: false,
        })
        .setDepth(DEPTH),
    );

    for (let i = 0; i < FOG_BLOBS; i++) {
      const img = scene.add
        .image(Phaser.Math.Between(-64, mapW + 64), Phaser.Math.Between(0, mapH), 'glow')
        .setScale(Phaser.Math.FloatBetween(4, 7), Phaser.Math.FloatBetween(2.5, 4))
        .setTint(0xdfe6ee)
        .setDepth(DEPTH)
        .setAlpha(0);
      this.blobs.push({ img, speed: Phaser.Math.FloatBetween(3, 8) });
    }

    // Start in the current weather without a fade.
    this.rain = this.rainTarget(weather);
    this.snow = this.snowTarget(weather);
    this.fog = weather === 'fog' ? 1 : 0;
    this.dim = DIM[weather];
  }

  /** Extra darkness from clouds, rain or fog, for the lighting pass. */
  get dimming(): number {
    return this.dim;
  }

  update(dt: number, weather: Weather): void {
    const step = dt / BLEND_SECONDS;
    const toward = (v: number, target: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
    this.rain = toward(this.rain, this.rainTarget(weather));
    this.snow = toward(this.snow, this.snowTarget(weather));
    this.fog = toward(this.fog, weather === 'fog' ? 1 : 0);
    this.dim = toward(this.dim, DIM[weather]);

    // Rain falls in (and a little above) whatever the camera shows.
    const view = this.scene.cameras.main.worldView;
    this.zone.setTo(view.x - 20, view.y - 30, view.width + 40, view.height + 30);
    this.setEmitting(this.drops, this.rain > 0.05);
    this.setEmitting(this.splashes, this.rain > 0.3);
    if (this.rain > 0.05) this.drops.setQuantity(Math.ceil(this.rain * 3));
    for (const f of this.flakes) {
      this.setEmitting(f, this.snow > 0.05);
      if (this.snow > 0.05) f.setQuantity(Math.ceil(this.snow * 3));
    }

    for (const b of this.blobs) {
      b.img.x += b.speed * dt;
      if (b.img.x - b.img.displayWidth / 2 > this.mapW) b.img.x = -b.img.displayWidth / 2;
      b.img.setAlpha(this.fog * 0.42);
    }
  }

  private rainTarget(weather: Weather): number {
    return weather === 'rain' && !this.snowy ? 1 : 0;
  }

  /** Full snowfall instead of rain; a few flakes from grey skies. */
  private snowTarget(weather: Weather): number {
    if (!this.snowy) return 0;
    return weather === 'rain' ? 1 : weather === 'cloudy' ? 0.25 : 0;
  }

  private setEmitting(emitter: Phaser.GameObjects.Particles.ParticleEmitter, on: boolean): void {
    if (on && !emitter.emitting) emitter.start();
    else if (!on && emitter.emitting) emitter.stop();
  }
}
