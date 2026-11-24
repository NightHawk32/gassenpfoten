import Phaser from 'phaser';
import { pixelRatio } from '../systems/viewport';

/** Minimum size of a tap target in CSS pixels (Apple/Google guidelines). */
export const MIN_TAP_SIZE = 44;

export interface Button {
  obj: Phaser.GameObjects.Text;
  /** Re-reads the label (after a language change or state change). */
  refresh(): void;
  /** Sets the font size (design px at uiScale 1) and padding for scale `s`. */
  style(s: number, size?: number): void;
  setActive(on: boolean): void;
  setEnabled(on: boolean): void;
}

const BG = '#1d2433cc';
const BG_ACTIVE = '#5a7ab0ee';

/**
 * A text button that works with mouse and touch. With `onHold` it reports
 * press/release instead of a tap (e.g. hold to fast-forward).
 */
export function makeButton(
  scene: Phaser.Scene,
  label: () => string,
  onTap?: () => void,
  onHold?: (down: boolean) => void,
): Button {
  let enabled = true;
  let pressed = false;
  const obj = scene.add
    .text(0, 0, label(), { fontFamily: 'Georgia, serif', color: '#fff6d5', backgroundColor: BG, align: 'center' })
    .setInteractive({ useHandCursor: true });

  const release = (fire: boolean) => {
    if (!pressed) return;
    pressed = false;
    obj.setAlpha(enabled ? 1 : 0.45);
    if (onHold) onHold(false);
    else if (fire && enabled) onTap?.();
  };
  obj.on(Phaser.Input.Events.POINTER_DOWN, () => {
    if (!enabled) return;
    pressed = true;
    obj.setAlpha(0.7);
    onHold?.(true);
  });
  obj.on(Phaser.Input.Events.POINTER_UP, () => release(true));
  obj.on(Phaser.Input.Events.POINTER_OUT, () => release(false));

  return {
    obj,
    refresh: () => obj.setText(label()),
    style(s, size = 12) {
      const font = Math.round(size * s);
      const padX = Math.round(10 * s);
      const minTap = MIN_TAP_SIZE * pixelRatio();
      const padY = Math.max(Math.round(5 * s), Math.ceil((minTap - font * 1.25) / 2));
      obj.setFontSize(font).setPadding(padX, padY, padX, padY);
    },
    setActive(on) {
      obj.setBackgroundColor(on ? BG_ACTIVE : BG);
    },
    setEnabled(on) {
      enabled = on;
      obj.setAlpha(on ? 1 : 0.45);
    },
  };
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
