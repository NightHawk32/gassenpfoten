import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { PetScene } from './scenes/PetScene';
import { TitleScene } from './scenes/TitleScene';
import { initialGameSize, installViewport, pixelRatio } from './systems/viewport';

const parent = document.getElementById('game')!;
const { width, height } = initialGameSize(parent);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width,
  height,
  pixelArt: true,
  backgroundColor: '#1d2433',
  // Long-press is used for petting on phones; don't open the browser's context menu.
  disableContextMenu: true,
  input: { activePointers: 3 },
  scale: {
    // The canvas matches the screen's real pixels; viewport.ts keeps it in sync.
    mode: Phaser.Scale.NONE,
    zoom: 1 / pixelRatio(),
  },
  // Order = draw order: the HUD is drawn over the world, petting over both.
  scene: [BootScene, TitleScene, GameScene, HudScene, PetScene],
});

installViewport(game, parent);

// Debug handle for the browser console and automated checks (dev server only, not in builds).
if (import.meta.env.DEV) {
  void Promise.all([import('./systems/events'), import('./systems/gameState')]).then(([events, state]) => {
    Object.assign(window, { __dev: { game, bus: events.bus, EV: events.EV, state: state.gameState() } });
  });
}
