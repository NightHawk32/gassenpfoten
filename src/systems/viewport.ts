import Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH, MAX_PIXEL_RATIO } from '../config';

/**
 * Keeps the canvas at the real pixel size of the screen (CSS size × device
 * pixel ratio) instead of upscaling a small fixed canvas. Text and shapes stay
 * sharp, and the game fills the screen in landscape and in portrait.
 *
 * Scenes get the current size from `this.scale.width/height` and listen to
 * `this.scale.on('resize', …)` to lay themselves out again.
 */

/** Device pixel ratio, capped so phones with 3× screens don't render 9× the pixels. */
export function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

/** Size of the parent element in CSS pixels. */
function parentSize(parent: HTMLElement): { width: number; height: number } {
  const rect = parent.getBoundingClientRect();
  return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
}

/** Initial game size in canvas pixels, for the Phaser game config. */
export function initialGameSize(parent: HTMLElement): { width: number; height: number } {
  const { width, height } = parentSize(parent);
  const dpr = pixelRatio();
  return { width: Math.round(width * dpr), height: Math.round(height * dpr) };
}

/** Resizes the game whenever the parent, the orientation or the pixel ratio changes. */
export function installViewport(game: Phaser.Game, parent: HTMLElement): void {
  let last = '';

  const apply = () => {
    const { width, height } = parentSize(parent);
    const dpr = pixelRatio();
    const key = `${width}x${height}@${dpr}`;
    if (key === last) return;
    last = key;

    game.scale.setZoom(1 / dpr);
    game.scale.resize(Math.round(width * dpr), Math.round(height * dpr));
    // Phaser skips the CSS size when it happens to equal the canvas size; set it explicitly.
    game.canvas.style.width = `${width}px`;
    game.canvas.style.height = `${height}px`;
  };

  game.events.once(Phaser.Core.Events.READY, apply);
  new ResizeObserver(apply).observe(parent);
  // Browser zoom or moving the window to another monitor changes the pixel ratio only.
  window.addEventListener('resize', apply);
}

/**
 * Scale factor for UI and layout: 1 at the 640×360 design size. Works in both
 * orientations, because the long side is compared with 640 and the short side with 360.
 */
export function uiScale(width: number, height: number): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return Math.min(long / DESIGN_WIDTH, short / DESIGN_HEIGHT);
}

/** Whole-number upscale factor for pixel-art sprites, so pixels stay square and sharp. */
export function pixelScale(width: number, height: number): number {
  return Math.max(1, Math.round(uiScale(width, height)));
}

/** True on phones and tablets (primary input is a finger). */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
