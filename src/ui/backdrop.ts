import Phaser from 'phaser';

/** Shared UI colours. */
export const UI = {
  panel: 0x1d2433,
  panelWarm: 0x241c2c,
  active: 0x5a7ab0,
  border: 0xf2d8a7,
  text: '#fff6d5',
  accent: '#f2d8a7',
  muted: '#c9c3d6',
} as const;

export interface BackdropStyle {
  fill: number;
  alpha: number;
  /** Corner radius in design pixels (multiplied by `scale`). */
  radius: number;
  border?: number;
  borderAlpha?: number;
  /** A faint lighter line along the top edge. */
  shine?: boolean;
}

export const BACKDROP = {
  button: { fill: UI.panel, alpha: 0.88, radius: 7, border: UI.border, borderAlpha: 0.35, shine: true },
  active: { fill: UI.active, alpha: 0.95, radius: 7, border: UI.border, borderAlpha: 0.7, shine: true },
  label: { fill: UI.panel, alpha: 0.72, radius: 6 },
  toast: { fill: UI.panel, alpha: 0.9, radius: 8, border: UI.border, borderAlpha: 0.25 },
  bubble: { fill: UI.panel, alpha: 0.9, radius: 5, border: UI.border, borderAlpha: 0.3 },
} satisfies Record<string, BackdropStyle>;

export interface Backdrop {
  setStyle(style: BackdropStyle): void;
  /** Scale for radius and border width (the UI scale `s`). */
  setScale(scale: number): void;
}

/**
 * Draws a rounded panel behind a text (instead of its square
 * backgroundColor) and keeps it in sync: position, size, origin, scale,
 * visibility, alpha, depth and container. The text's padding sets the size.
 * The panel is destroyed with the text.
 */
export function attachBackdrop(text: Phaser.GameObjects.Text, initial: BackdropStyle, initialScale = 1): Backdrop {
  const scene = text.scene;
  const g = scene.add.graphics();
  let style = initial;
  let scale = initialScale;
  let key = '';

  const sync = () => {
    if (!text.active) return;
    // Follow the text into a container (e.g. the journal), right behind it.
    const parent = text.parentContainer;
    if (parent && g.parentContainer !== parent) parent.addAt(g, Math.max(0, parent.getIndex(text)));
    g.setDepth(text.depth);
    const visible = text.visible && text.alpha > 0 && (!parent || parent.visible);
    g.setVisible(visible);
    if (!visible) return;
    g.setAlpha(text.alpha);
    const w = text.displayWidth;
    const h = text.displayHeight;
    const x = text.x - text.originX * w;
    const y = text.y - text.originY * h;
    const next = `${x}|${y}|${w}|${h}|${scale}|${text.scaleX}|${style.fill}|${style.alpha}`;
    if (next === key) return;
    key = next;
    const k = scale * text.scaleX;
    const r = Math.min(style.radius * k, h / 2, w / 2);
    g.clear();
    g.fillStyle(style.fill, style.alpha).fillRoundedRect(x, y, w, h, r);
    if (style.shine) g.fillStyle(0xffffff, 0.06).fillRoundedRect(x + r / 2, y + 1 * k, w - r, Math.max(1, 2 * k), Math.max(0.5, k));
    if (style.border !== undefined) {
      const lw = Math.max(1, 1.2 * k);
      g.lineStyle(lw, style.border, style.borderAlpha ?? 1).strokeRoundedRect(x + lw / 2, y + lw / 2, w - lw, h - lw, r);
    }
  };

  // Behind the text when both sit at the same depth (stable sort keeps creation order).
  scene.children.moveBelow(g as never, text as never);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, sync);
  text.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, sync);
    g.destroy();
  });

  return {
    setStyle(s) {
      style = s;
      key = '';
    },
    setScale(s) {
      scale = s;
      key = '';
    },
  };
}
