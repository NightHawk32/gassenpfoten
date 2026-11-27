import Phaser from 'phaser';
import { LOGO_KEY } from '../art/logo';
import { catTextureKey } from '../art/sprites';
import { onLanguageChange, t, toggleLanguage, type TextKey } from '../i18n/i18n';
import { daylight } from '../systems/clock';
import { gameState } from '../systems/gameState';
import { isTouchDevice, pixelScale, uiScale } from '../systems/viewport';
import { UI } from '../ui/backdrop';
import { makeButton, toggleFullscreen, type Button } from '../ui/button';

type Rgb = [number, number, number];
const SKY_TOP: [Rgb, Rgb] = [[0x0c, 0x10, 0x24], [0x5e, 0x9c, 0xd8]];
const SKY_BOTTOM: [Rgb, Rgb] = [[0x2e, 0x2a, 0x4e], [0xf2, 0xd6, 0xae]];
const HILLS: [Rgb, Rgb] = [[0x22, 0x1c, 0x34], [0x6a, 0x78, 0x9e]];
const HOUSES: [Rgb, Rgb] = [[0x33, 0x29, 0x36], [0x5a, 0x48, 0x52]];
const TIMBER: [Rgb, Rgb] = [[0x24, 0x1c, 0x28], [0x3e, 0x30, 0x38]];

interface Label {
  obj: Phaser.GameObjects.Text;
  text: () => string;
  /** Font size at the 640×360 design size. */
  size: number;
}

/**
 * Title screen: the pixel-art logo over a little Tübingen at the saved
 * in-game time (Schloss Hohentübingen on its hill, the Stiftskirche tower,
 * half-timbered gables with lit windows at night and cats on the roofs).
 * Adapts to any size and orientation: everything is placed in layout(),
 * which runs on every resize.
 */
export class TitleScene extends Phaser.Scene {
  private light = 0;
  private sky!: Phaser.GameObjects.Graphics;
  private stars: { obj: Phaser.GameObjects.Rectangle; fx: number; fy: number }[] = [];
  private skyline!: Phaser.GameObjects.Graphics;
  private roofs!: Phaser.GameObjects.Graphics;
  private logo!: Phaser.GameObjects.Image;
  private cats: Phaser.GameObjects.Image[] = [];
  private labels!: Record<'subtitle' | 'clock' | 'hint' | 'prototype', Label>;
  private buttons: Button[] = [];
  private playBtn!: Button;
  private langBtn!: Button;
  private fullBtn?: Button;
  private starting = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.stars = [];
    this.buttons = [];
    this.starting = false;
    const state = gameState();
    const clock = state.clock;
    this.light = daylight(clock.minuteOfDay);

    this.sky = this.add.graphics();
    for (let i = 0; i < 70; i++) {
      const obj = this.add.rectangle(0, 0, 2, 2, 0xfff6d5).setAlpha((1 - this.light) * (0.4 + Math.random() * 0.6));
      this.stars.push({ obj, fx: Math.random(), fy: Math.random() * 0.6 });
      // A few of them twinkle.
      if (i % 5 === 0) this.tweens.add({ targets: obj, alpha: 0.15, duration: 900 + i * 37, yoyo: true, repeat: -1 });
    }
    this.skyline = this.add.graphics();
    this.roofs = this.add.graphics();
    this.cats = (['tuxedo', 'black', 'brown-tabby'] as const).map((coat) => this.add.image(0, 0, catTextureKey(coat), 0).setOrigin(0.5, 0.92));
    this.cats[1].setFlipX(true);

    this.logo = this.add.image(0, 0, LOGO_KEY).setOrigin(0.5, 0.5);
    this.labels = {
      subtitle: this.makeLabel(() => t('subtitle'), 18, UI.accent),
      clock: this.makeLabel(
        () => `${t('day')} ${clock.day} · ${clock.timeString} · ${t(`phase.${clock.phase}` as TextKey)}`,
        12,
        UI.text,
        'monospace',
      ),
      hint: this.makeLabel(() => t(isTouchDevice() ? 'hint.touch' : 'hint'), 11, UI.muted),
      prototype: this.makeLabel(() => `${t('prototype')} · v${__APP_VERSION__} (${__APP_COMMIT__})`, 10, '#a49cb8'),
    };
    for (const label of Object.values(this.labels)) label.obj.setShadow(0, 2, '#0e0810', 0, false, true);

    this.playBtn = this.add_(makeButton(this, () => t(state.hasProgress ? 'continue' : 'play'), () => this.startGame()));
    this.langBtn = this.add_(makeButton(this, () => t('language'), () => toggleLanguage()));
    if (document.fullscreenEnabled) {
      this.fullBtn = this.add_(
        makeButton(this, () => t(document.fullscreenElement ? 'fullscreen.exit' : 'fullscreen.enter'), toggleFullscreen),
      );
    }
    // The play button breathes a little.
    this.tweens.add({ targets: this.playBtn.obj, scale: 1.04, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const kb = this.input.keyboard!;
    kb.on('keydown-L', () => toggleLanguage());
    kb.on('keydown-ENTER', () => this.startGame());
    kb.on('keydown-SPACE', () => this.startGame());

    const offLang = onLanguageChange(() => this.refreshTexts());
    const onFullscreen = () => this.fullBtn?.refresh();
    document.addEventListener('fullscreenchange', onFullscreen);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offLang();
      document.removeEventListener('fullscreenchange', onFullscreen);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    this.layout();
    this.cameras.main.fadeIn(500, 0x0c, 0x10, 0x24);
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(400, 0x14, 0x10, 0x18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }

  /** Colour between night (`light` 0) and day (1). */
  private tint([night, day]: [Rgb, Rgb]): number {
    const c = night.map((n, i) => Math.round(n + (day[i] - n) * this.light));
    return (c[0] << 16) | (c[1] << 8) | c[2];
  }

  /** Places everything for the current canvas size. */
  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const s = uiScale(w, h);
    const px = pixelScale(w, h);
    const cx = w / 2;
    const night = 1 - this.light;

    this.cameras.main.setSize(w, h);
    const top = this.tint(SKY_TOP);
    const bottom = this.tint(SKY_BOTTOM);
    this.sky.clear().fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, w, h);
    this.stars.forEach(({ obj, fx, fy }) => obj.setPosition(Math.round(fx * w), Math.round(fy * h)).setSize(px, px));

    // Moon at night, a pale sun by day, with a soft halo.
    const mx = w * 0.88;
    const my = h * 0.08;
    const mr = 13 * s;
    const disc = night > 0.5 ? 0xfff2cc : 0xfff8e0;
    for (let i = 4; i >= 1; i--) this.sky.fillStyle(disc, 0.05).fillCircle(mx, my, mr * (1 + i * 0.45));
    this.sky.fillStyle(disc, 1).fillCircle(mx, my, mr);
    if (night > 0.5) this.sky.fillStyle(0xe8dcb4, 1).fillCircle(mx - mr * 0.3, my - mr * 0.2, mr * 0.22).fillCircle(mx + mr * 0.35, my + mr * 0.3, mr * 0.15);

    this.drawSkyline(w, h, s);
    const peaks = this.drawHouses(w, h, s, night);

    // Cats sitting on three of the roof ridges.
    const pick = [0.18, 0.52, 0.83].map((f) => peaks[Math.min(peaks.length - 1, Math.floor(f * peaks.length))]);
    this.cats.forEach((cat, i) => cat.setScale(px).setPosition(Math.round(pick[i].x), Math.round(pick[i].y + 7 * px)));

    // Darken the bottom edge so the small print stays readable over the windows.
    const shadeTop = h - 60 * s;
    this.roofs.fillGradientStyle(0x0c0a14, 0x0c0a14, 0x0c0a14, 0x0c0a14, 0, 0, 0.85, 0.85).fillRect(0, shadeTop, w, h - shadeTop);

    // Logo: whole-number scale so its pixels stay square.
    // About two thirds of the width, but never taller than a fifth of the screen.
    const logoScale = Math.max(1, Math.min(Math.floor((w * 0.66) / this.logo.width), Math.floor((h * 0.2) / this.logo.height)));
    const logoY = Math.round(h * 0.25);
    this.logo.setScale(logoScale).setPosition(Math.round(cx), logoY);
    const logoBottom = logoY + (this.logo.height * logoScale) / 2;

    this.place('subtitle', cx, logoBottom + 16 * s);
    this.place('clock', cx, logoBottom + 42 * s);
    for (const b of this.buttons) b.style(s);
    this.playBtn.style(s, 18);
    this.playBtn.obj.setOrigin(0.5, 0.5).setPosition(cx, logoBottom + 78 * s);

    this.place('hint', cx, h - 36 * s);
    this.place('prototype', cx, h - 18 * s);

    const m = Math.round(10 * s);
    this.langBtn.obj.setOrigin(1, 0).setPosition(w - m, m);
    this.fullBtn?.obj.setOrigin(0, 0).setPosition(m, m);
  }

  /** Far away: Schloss Hohentübingen on its hill (right) and the Stiftskirche tower (left). */
  private drawSkyline(w: number, h: number, s: number): void {
    const g = this.skyline.clear().fillStyle(this.tint(HILLS), 1);
    const ground = h - 95 * s;
    // The Schlossberg.
    g.fillEllipse(w * 0.74, ground + 30 * s, Math.max(w * 0.7, 360 * s), 150 * s);
    // The Schloss: long body, two round towers with pointed caps.
    const sx = w * 0.74;
    const sy = ground - 38 * s;
    g.fillRect(sx - 60 * s, sy, 120 * s, 34 * s);
    g.fillRect(sx - 20 * s, sy - 14 * s, 40 * s, 16 * s);
    for (const tx of [sx - 66 * s, sx + 54 * s]) {
      g.fillRect(tx, sy - 16 * s, 14 * s, 50 * s);
      g.fillTriangle(tx - 3 * s, sy - 16 * s, tx + 17 * s, sy - 16 * s, tx + 7 * s, sy - 34 * s);
    }
    // The Stiftskirche: nave plus the square tower with its pointed roof.
    const kx = w * 0.24;
    g.fillRect(kx - 50 * s, ground - 28 * s, 70 * s, 60 * s);
    g.fillTriangle(kx - 54 * s, ground - 28 * s, kx + 24 * s, ground - 28 * s, kx - 15 * s, ground - 48 * s);
    g.fillRect(kx + 14 * s, ground - 82 * s, 22 * s, 120 * s);
    g.fillTriangle(kx + 11 * s, ground - 82 * s, kx + 39 * s, ground - 82 * s, kx + 25 * s, ground - 118 * s);
    // The tower clock glows faintly at night.
    g.fillStyle(0xf2d8a7, 0.35 + 0.4 * (1 - this.light)).fillCircle(kx + 25 * s, ground - 66 * s, 4 * s);
  }

  /** Close by: a row of half-timbered gables. Returns the roof ridges (for the cats). */
  private drawHouses(w: number, h: number, s: number, night: number): { x: number; y: number }[] {
    const g = this.roofs.clear();
    const houseW = 46 * s;
    const peaks: { x: number; y: number }[] = [];
    const wall = this.tint(HOUSES);
    const timber = this.tint(TIMBER);
    for (let i = 0, x = -10 * s; x < w; i++, x += houseW + 2 * s) {
      const wallH = (48 + ((i * 37) % 4) * 9) * s;
      const top = h - wallH;
      const roofH = (26 + ((i * 53) % 3) * 6) * s;
      // Wall and gable.
      g.fillStyle(wall, 1).fillRect(x, top, houseW, wallH);
      g.fillTriangle(x - 3 * s, top + 1, x + houseW + 3 * s, top + 1, x + houseW / 2, top - roofH);
      // Timber beams: a floor line and a cross in the gable.
      g.fillStyle(timber, 1).fillRect(x, top + 18 * s, houseW, 2 * s).fillRect(x, top, houseW, 2 * s);
      g.fillRect(x + houseW / 2 - 1 * s, top - roofH + 6 * s, 2 * s, roofH - 6 * s);
      // Chimney on some houses.
      if (i % 3 === 1) g.fillStyle(wall, 1).fillRect(x + houseW * 0.68, top - roofH * 0.75, 6 * s, roofH * 0.5);
      // Windows: warm and lit at night, dark glass by day; some stay dark.
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const lit = night > 0.4 && (i * 7 + row * 3 + col * 5) % 4 !== 0;
          const wx = x + (10 + col * 18) * s;
          const wy = top + (5 + row * 22) * s;
          if (wy + 10 * s > h) continue;
          if (lit) g.fillStyle(0xffc860, 0.18).fillRect(wx - 3 * s, wy - 3 * s, 14 * s, 16 * s);
          g.fillStyle(lit ? 0xffd27a : this.tint([[0x1c, 0x1a, 0x2e], [0x8a, 0xa4, 0xc0]]), 1).fillRect(wx, wy, 8 * s, 10 * s);
          g.fillStyle(timber, 1).fillRect(wx + 3.5 * s, wy, 1 * s, 10 * s);
        }
      }
      peaks.push({ x: x + houseW / 2, y: top - roofH });
    }
    return peaks;
  }

  private place(key: keyof TitleScene['labels'], x: number, y: number): void {
    const { obj, size } = this.labels[key];
    const s = uiScale(this.scale.width, this.scale.height);
    obj
      .setFontSize(Math.round(size * s))
      .setWordWrapWidth(this.scale.width * 0.92, true)
      .setPosition(x, y);
  }

  private makeLabel(text: () => string, size: number, color: string, fontFamily = 'Georgia, serif'): Label {
    const obj = this.add.text(0, 0, text(), { fontFamily, color, align: 'center' }).setOrigin(0.5);
    return { obj, text, size };
  }

  private add_(b: Button): Button {
    this.buttons.push(b);
    return b;
  }

  private refreshTexts(): void {
    for (const { obj, text } of Object.values(this.labels)) obj.setText(text());
    for (const b of this.buttons) b.refresh();
    this.layout();
  }
}
