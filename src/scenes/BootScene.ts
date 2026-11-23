import Phaser from 'phaser';
import { assetUrl } from '../config';

/** Loads the assets needed for the first screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Always load through assetUrl(): it adds the GitHub Pages base path.
    this.load.image('cat-placeholder', assetUrl('assets/sprites/cat-placeholder.png'));
  }

  create(): void {
    this.scene.start('Title');
  }
}
