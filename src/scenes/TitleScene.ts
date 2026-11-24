import Phaser from 'phaser';
import { catTextureKey } from '../art/sprites';
import { onLanguageChange, t, toggleLanguage, type TextKey } from '../i18n/i18n';
import { daylight } from '../systems/clock';
import { gameState } from '../systems/gameState';
import { isTouchDevice, pixelScale, uiScale } from '../systems/viewport';
import { makeButton, toggleFullscreen, type Button } from '../ui/button';

const NIGHT_SKY = { r: 0x14, g: 0x18, b: 0x2b };
const DAY_SKY = { r: 0x8e, g: 0xc5, b: 0xe8 };

interface Label {
  obj: Phaser.GameObjects.Text;
  text: () => string;
  /** Font size at the 640×360 design size. */
  size: number;
}

/**
 * Title screen. The sky shows the saved in-game time. Adapts to any size and
 * orientation: everything is placed in layout(), which runs on every resize.
 */
export class TitleScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Rectangle;
  private stars: { obj: Phaser.GameObjects.Rectangle; fx: number; fy: number }[] = [];
  private roofs!: Phaser.GameObjects.Graphics;
  private cats: Phaser.GameObjects.Image[] = [];
  private labels!: Record<'title' | 'subtitle' | 'clock' | 'hint' | 'prototype', Label>;
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

    this.sky = this.add.rectangle(0, 0, 1, 1, 0x000000).setOrigin(0);
    for (let i = 0; i < 60; i++) {
      this.stars.push({ obj: this.add.rectangle(0, 0, 2, 2, 0xfff6d5), fx: Math.random(), fy: Math.random() * 0.55 });
    }
    // Placeholder "ground": rooftops of the Altstadt as simple blocks.
    this.roofs = this.add.graphics();
    this.cats = (['tuxedo', 'brown-tabby', 'grey-tabby'] as const).map((coat) => this.add.image(0, 0, catTextureKey(coat), 0));

    const clock = state.clock;
    this.labels = {
      title: this.makeLabel(() => t('title'), 40, '#fff6d5'),
      subtitle: this.makeLabel(() => t('subtitle'), 18, '#f2d8a7'),
      clock: this.makeLabel(
        () => `${t('day')} ${clock.day} · ${clock.timeString} · ${t(`phase.${clock.phase}` as TextKey)}`,
        13,
        '#fff6d5',
        'monospace',
      ),
      hint: this.makeLabel(() => t(isTouchDevice() ? 'hint.touch' : 'hint'), 11, '#c9c3d6'),
      prototype: this.makeLabel(() => t('prototype'), 10, '#8d86a0'),
    };

    this.playBtn = this.add_(makeButton(this, () => t(state.hasProgress ? 'continue' : 'play'), () => this.startGame()));
    this.langBtn = this.add_(makeButton(this, () => t('language'), () => toggleLanguage()));
    if (document.fullscreenEnabled) {
      this.fullBtn = this.add_(
        makeButton(this, () => t(document.fullscreenElement ? 'fullscreen.exit' : 'fullscreen.enter'), toggleFullscreen),
      );
    }

    // Sky colour for the saved time of day.
    const light = daylight(clock.minuteOfDay);
    const mix = (a: number, b: number) => Math.round(a + (b - a) * light);
    this.sky.setFillStyle((mix(NIGHT_SKY.r, DAY_SKY.r) << 16) | (mix(NIGHT_SKY.g, DAY_SKY.g) << 8) | mix(NIGHT_SKY.b, DAY_SKY.b));
    this.stars.forEach((s) => s.obj.setAlpha(1 - light));

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
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(400, 0x14, 0x10, 0x18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }

  /** Places everything for the current canvas size. */
  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const s = uiScale(w, h);
    const px = pixelScale(w, h);
    const cx = w / 2;

    this.cameras.main.setSize(w, h);
    this.sky.setSize(w, h);
    this.stars.forEach(({ obj, fx, fy }) => obj.setPosition(fx * w, fy * h).setSize(px, px));

    this.roofs.clear().fillStyle(0x3a2f3a, 1);
    const step = 48 * s;
    for (let i = 0, x = 0; x < w; i++, x += step) {
      const roof = (40 + ((i * 48 * 37) % 50)) * s;
      const top = h - 70 * s - roof;
      this.roofs.fillRect(x, top, 44 * s, roof + 70 * s);
      this.roofs.fillTriangle(x - 4 * s, top, x + 48 * s, top, x + 22 * s, top - 30 * s);
    }

    // Main block centred a little above the middle; portrait screens get extra sky.
    const top = h * 0.4 - 90 * s;
    this.place('title', cx, top);
    this.place('subtitle', cx, top + 38 * s);
    this.place('clock', cx, top + 72 * s);
    const catY = top + 112 * s;
    const gap = 22 * px;
    this.cats.forEach((c, i) => c.setScale(2 * px).setPosition(Math.round(cx + (i - 1) * gap * 1.6), Math.round(catY)));

    for (const b of this.buttons) b.style(s);
    this.playBtn.style(s, 18);
    this.playBtn.obj.setOrigin(0.5, 0).setPosition(cx, catY + 20 * px);

    this.place('hint', cx, h - 40 * s);
    this.place('prototype', cx, h - 22 * s);

    const m = Math.round(10 * s);
    this.langBtn.obj.setOrigin(1, 0).setPosition(w - m, m);
    this.fullBtn?.obj.setOrigin(0, 0).setPosition(m, m);
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
