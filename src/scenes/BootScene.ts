import Phaser from 'phaser';
import { registerLogo } from '../art/logo';
import { registerSprites } from '../art/sprites';
import { registerTiles } from '../art/tiles';
import { assetUrl } from '../config';

/** Loads files and builds the procedural placeholder art. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Always load through assetUrl(): it adds the GitHub Pages base path.
    this.load.image('cat-placeholder', assetUrl('assets/sprites/cat-placeholder.png'));
  }

  create(): void {
    registerTiles(this);
    registerSprites(this);
    registerLogo(this);
    this.scene.start('Title');
  }
}
