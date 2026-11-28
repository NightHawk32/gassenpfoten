import Phaser from 'phaser';
import { CAT_SIZE, type Region } from '../art/catArt';
import { CAT_FRAME, catRegionAt, catTextureKey } from '../art/sprites';
import { catDef, zoneReaction, type CatDef, type PetZone } from '../data/cats';
import { t, type TextKey } from '../i18n/i18n';
import { bus, EV, type PetResult } from '../systems/events';
import { gameState } from '../systems/gameState';
import { uiScale } from '../systems/viewport';
import { makeButton, type Button } from '../ui/button';

/**
 * Petting zones come from the body part under the finger in the current
 * frame (see catArt.ts), so they follow the tail and the head as the cat moves.
 * The back is the side of the body; the belly is the middle of the front.
 */
function zoneFor(region: Region | null, x: number): PetZone | null {
  switch (region) {
    case 'head':
    case 'ear':
      return 'head';
    case 'cheek':
      return 'cheeks';
    case 'chin':
      return 'chin';
    case 'chest':
      return 'belly';
    case 'body':
      return Math.abs(x - CAT_SIZE / 2) <= 4 ? 'belly' : 'back';
    case 'tail':
      return 'tail';
    default:
      return null;
  }
}

const FAVOURITE_RATE = 0.12;
const NEUTRAL_RATE = 0.04;
const STROKE_BONUS = 1.5;
const BOREDOM_RATE = 0.02;
/** Seconds on a no-go spot before the cat has had enough. */
const NO_GO_PATIENCE = 0.7;

/**
 * Close-up petting (concept §4.5). Hold and stroke the cat; favourite spots
 * make it purr, no-go spots make it flatten its ears and leave.
 */
export class PetScene extends Phaser.Scene {
  private def!: CatDef;
  private mood = 0;
  private warn = 0;
  private finished = false;
  private noteTimer = 0;
  private vibeTimer = 0;
  private poseTimer = 0;
  private last = { x: 0, y: 0 };
  private catScale = 1;

  private dim!: Phaser.GameObjects.Rectangle;
  private cat!: Phaser.GameObjects.Sprite;
  private alertIcon!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private barBg!: Phaser.GameObjects.Rectangle;
  private barFill!: Phaser.GameObjects.Rectangle;
  private closeBtn!: Button;

  constructor() {
    super('Pet');
  }

  init(data: { catId: string }): void {
    this.def = catDef(data.catId);
  }

  create(): void {
    const level = gameState().cat(this.def.id).level;
    this.mood = 0.3 + 0.05 * level;
    this.warn = 0;
    this.finished = false;

    this.dim = this.add.rectangle(0, 0, 1, 1, 0x0a0812, 0.72).setOrigin(0).setInteractive();
    this.cat = this.add.sprite(0, 0, catTextureKey(this.def.coat), CAT_FRAME.sit);
    this.alertIcon = this.add.image(0, 0, 'icon-alert').setVisible(false);
    const style = { fontFamily: 'Georgia, serif', color: '#fff6d5', align: 'center' };
    this.nameText = this.add.text(0, 0, this.def.name, style).setOrigin(0.5, 0);
    this.hintText = this.add.text(0, 0, t('pet.hint', { name: this.def.name }), { ...style, color: '#c9c3d6' }).setOrigin(0.5, 0);
    this.feedbackText = this.add.text(0, 0, '', { ...style, color: '#f2d8a7' }).setOrigin(0.5, 0);
    this.barBg = this.add.rectangle(0, 0, 1, 1, 0x3a2f3a).setOrigin(0, 0.5);
    this.barFill = this.add.rectangle(0, 0, 1, 1, 0xe8506a).setOrigin(0, 0.5);
    this.closeBtn = makeButton(this, () => t('pet.close'), () => this.finish('cancel'));

    this.input.keyboard?.on('keydown-ESC', () => this.finish('cancel'));
    this.input.setDefaultCursor('pointer');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    // The HUD would show through the dimmed world and collide with the name and hint.
    this.scene.setVisible(false, 'Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.setVisible(true, 'Hud');
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.input.setDefaultCursor('default');
    });
    this.layout();
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const s = uiScale(w, h);
    const m = Math.round(10 * s);
    this.cameras.main.setSize(w, h);
    this.dim.setSize(w, h);

    // catScale = screen pixels per texture pixel (the texture is 32×32).
    this.catScale = Math.max(2, Math.floor((Math.min(w, h * 0.75) * 0.6) / CAT_SIZE));
    this.cat.setScale(this.catScale).setPosition(Math.round(w / 2), Math.round(h * 0.52));
    this.alertIcon.setScale(this.catScale).setPosition(this.cat.x + this.catScale * 12, this.cat.y - this.catScale * 16);

    const wrap = Math.min(w * 0.9, 480 * s);
    this.nameText.setFontSize(Math.round(22 * s)).setPosition(w / 2, m);
    this.hintText.setFontSize(Math.round(11 * s)).setWordWrapWidth(wrap, true).setPosition(w / 2, m + this.nameText.height);

    const barW = Math.min(w * 0.6, 220 * s);
    const barY = this.cat.y + this.catScale * 17 + Math.round(10 * s);
    this.barBg.setSize(barW, Math.round(8 * s)).setPosition(w / 2 - barW / 2, barY);
    this.barFill.setPosition(w / 2 - barW / 2, barY);
    this.feedbackText.setFontSize(Math.round(13 * s)).setWordWrapWidth(wrap, true).setPosition(w / 2, barY + Math.round(10 * s));

    this.closeBtn.style(s);
    this.closeBtn.obj.setOrigin(1, 1).setPosition(w - m, h - m);
    this.updateBar();
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const dt = Math.min(deltaMs, 100) / 1000;
    const p = this.input.activePointer;
    const zone = p.isDown ? this.zoneAt(p.x, p.y) : null;
    const stroking = Math.hypot(p.x - this.last.x, p.y - this.last.y) > 1;
    this.last = { x: p.x, y: p.y };

    this.cat.setX(Math.round(this.scale.width / 2));
    if (zone && zoneReaction(this.def, zone) === 'noGo') {
      // Ears back, narrowed eyes, then fur up and "!" – let go quickly or the cat leaves.
      this.warn += dt;
      this.cat.setFrame(this.warn > NO_GO_PATIENCE * 0.5 ? CAT_FRAME.alert : CAT_FRAME.annoyed);
      this.cat.setX(this.cat.x + Math.sin(this.time.now / 25) * this.catScale * 0.3);
      this.alertIcon.setVisible(true);
      if (this.warn >= NO_GO_PATIENCE) this.finish('left');
      return;
    }

    this.warn = Math.max(0, this.warn - dt * 2);
    this.alertIcon.setVisible(false);
    const bonus = stroking ? STROKE_BONUS : 1;

    if (zone && zoneReaction(this.def, zone) === 'favourite') {
      this.mood += dt * FAVOURITE_RATE * bonus;
      this.purr(dt);
      if (gameState().learnSpot(this.def.id, zone)) {
        this.feedbackText.setText(t('pet.spot', { zone: t(`zone.${zone}` as TextKey) }));
      }
    } else if (zone) {
      this.mood += dt * NEUTRAL_RATE * bonus;
      this.pose(dt, CAT_FRAME.blink, 0.9);
    } else if (this.mood < 0.2) {
      // Getting bored: the tail starts to swish.
      this.mood -= dt * BOREDOM_RATE;
      this.pose(dt, CAT_FRAME.tail, 0.5);
    } else {
      this.mood -= dt * BOREDOM_RATE;
      this.pose(dt, CAT_FRAME.sit, 0);
    }

    this.mood = Phaser.Math.Clamp(this.mood, 0, 1);
    this.updateBar();
    if (this.mood >= 1) this.finish('happy');
    else if (this.mood <= 0) this.finish('left');
  }

  private zoneAt(x: number, y: number): PetZone | null {
    const half = (CAT_SIZE / 2) * this.catScale;
    const lx = Math.floor((x - (this.cat.x - half)) / this.catScale);
    const ly = Math.floor((y - (this.cat.y - half)) / this.catScale);
    // Look a pixel around the finger too, so the outline and thin tails count.
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const zone = zoneFor(catRegionAt(this.def.coat, Number(this.cat.frame.name), lx + dx, ly + dy), lx);
      if (zone) return zone;
    }
    return null;
  }

  /** Purring: slow blinks, floating notes and a gentle vibration on phones. */
  private purr(dt: number): void {
    this.pose(dt, CAT_FRAME.happy, 0.8, CAT_FRAME.purr);
    this.noteTimer -= dt;
    if (this.noteTimer <= 0) {
      this.noteTimer = 0.35;
      this.floatIcon('icon-note');
    }
    this.vibeTimer -= dt;
    if (this.vibeTimer <= 0) {
      this.vibeTimer = 0.3;
      navigator.vibrate?.(15);
    }
  }

  /** Shows `frame` now and then (every `every` seconds), otherwise `base`. */
  private pose(dt: number, frame: number, every: number, base: number = CAT_FRAME.sit): void {
    const current = Number(this.cat.frame.name);
    // Switching mood (e.g. from purring back to sitting) happens at once.
    if (current !== frame && current !== base) this.poseTimer = 0;
    this.poseTimer -= dt;
    if (this.poseTimer > 0) return;
    if (every <= 0) {
      this.cat.setFrame(base);
      return;
    }
    const showing = current === frame;
    this.cat.setFrame(showing ? base : frame);
    this.poseTimer = showing ? every : 0.45;
  }

  private floatIcon(key: string): void {
    const x = this.cat.x + Phaser.Math.Between(-12, 12) * this.catScale;
    const y = this.cat.y - 14 * this.catScale;
    const icon = this.add.image(x, y, key).setScale(this.catScale / 1.25);
    this.tweens.add({
      targets: icon,
      y: y - 12 * this.catScale,
      alpha: 0,
      duration: 1100,
      onComplete: () => icon.destroy(),
    });
  }

  private updateBar(): void {
    this.barFill.setSize(this.barBg.width * this.mood, this.barBg.height);
  }

  private finish(result: PetResult): void {
    if (this.finished) return;
    this.finished = true;
    this.alertIcon.setVisible(false);
    navigator.vibrate?.(0);

    let delay = 0;
    if (result === 'happy') {
      this.cat.setFrame(CAT_FRAME.happy);
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 120, () => this.floatIcon('icon-heart'));
      this.feedbackText.setText(t('toast.petHappy', { name: this.def.name }));
      delay = 1400;
    } else if (result === 'left') {
      this.cat.setFrame(CAT_FRAME.walk1).setFlipX(true);
      this.cat.play(`${catTextureKey(this.def.coat)}-walk`);
      this.tweens.add({ targets: this.cat, x: this.scale.width + CAT_SIZE * this.catScale, duration: 900 });
      this.feedbackText.setText(t('toast.petLeft', { name: this.def.name }));
      delay = 1000;
    }

    this.time.delayedCall(delay, () => {
      bus.emit(EV.PET_DONE, result, this.def.id);
      this.scene.resume('Game');
      this.scene.stop();
    });
  }
}
