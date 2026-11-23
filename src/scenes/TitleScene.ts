import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { t, toggleLanguage, onLanguageChange, type TextKey } from '../i18n/i18n';
import { GameClock, daylight } from '../systems/clock';

const NIGHT_SKY = { r: 0x14, g: 0x18, b: 0x2b };
const DAY_SKY = { r: 0x8e, g: 0xc5, b: 0xe8 };
const FAST_FORWARD = 30;

/**
 * Placeholder screen for milestone M0.5. It proves that the pipeline works
 * end to end: TypeScript build, asset loading under the Pages base path,
 * i18n, localStorage and the in-game clock.
 */
export class TitleScene extends Phaser.Scene {
  private clock = new GameClock(5 * 60);
  private sky!: Phaser.GameObjects.Rectangle;
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private texts: { obj: Phaser.GameObjects.Text; key: TextKey }[] = [];
  private clockText!: Phaser.GameObjects.Text;
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Title');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.sky = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0);

    for (let i = 0; i < 40; i++) {
      const star = this.add.rectangle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT * 0.55),
        2, 2, 0xfff6d5,
      );
      this.stars.push(star);
    }

    // Placeholder "ground": rooftops of the Altstadt as simple blocks.
    const roofs = this.add.graphics();
    roofs.fillStyle(0x3a2f3a, 1);
    for (let x = 0; x < GAME_WIDTH; x += 48) {
      const h = 40 + ((x * 37) % 50);
      roofs.fillRect(x, GAME_HEIGHT - 70 - h, 44, h + 70);
      roofs.fillTriangle(x - 4, GAME_HEIGHT - 70 - h, x + 48, GAME_HEIGHT - 70 - h, x + 22, GAME_HEIGHT - 100 - h);
    }

    this.addText(cx, 70, 'title', 40, '#fff6d5');
    this.addText(cx, 108, 'subtitle', 18, '#f2d8a7');
    this.addText(cx, GAME_HEIGHT - 40, 'hint', 11, '#c9c3d6');
    this.addText(cx, GAME_HEIGHT - 22, 'prototype', 10, '#8d86a0');

    this.add.image(cx, 190, 'cat-placeholder').setScale(4);

    this.clockText = this.add
      .text(cx, 150, '', { fontFamily: 'monospace', fontSize: '14px', color: '#fff6d5' })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown-L', () => toggleLanguage());
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const unsubscribe = onLanguageChange(() => this.refreshTexts());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  update(_time: number, delta: number): void {
    // Hold Space (or touch the screen) to fast-forward time.
    const fast = this.spaceKey?.isDown || this.input.activePointer.isDown;
    this.clock.update(delta * (fast ? FAST_FORWARD : 1));

    const light = daylight(this.clock.minuteOfDay);
    const r = Math.round(NIGHT_SKY.r + (DAY_SKY.r - NIGHT_SKY.r) * light);
    const g = Math.round(NIGHT_SKY.g + (DAY_SKY.g - NIGHT_SKY.g) * light);
    const b = Math.round(NIGHT_SKY.b + (DAY_SKY.b - NIGHT_SKY.b) * light);
    this.sky.setFillStyle((r << 16) | (g << 8) | b);
    this.stars.forEach((s) => s.setAlpha(1 - light));

    this.clockText.setText(
      `${t('day')} ${this.clock.day} · ${this.clock.timeString} · ${t(`phase.${this.clock.phase}` as TextKey)}`,
    );
  }

  private addText(x: number, y: number, key: TextKey, size: number, color: string): void {
    const obj = this.add
      .text(x, y, t(key), { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color })
      .setOrigin(0.5);
    this.texts.push({ obj, key });
  }

  private refreshTexts(): void {
    this.texts.forEach(({ obj, key }) => obj.setText(t(key)));
  }
}
