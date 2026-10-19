/**
 * Minimal Phaser 3 scene loading Sprite Animator Aseprite json-array export.
 *
 * From repo root:
 *   npx --yes serve examples -p 4177
 * Then open http://localhost:4177/phaser3/
 */
import Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.87.0/dist/phaser.esm.js';

class DemoScene extends Phaser.Scene {
  constructor() {
    super('demo');
  }

  preload() {
    // Paths are relative to this HTML page (examples/phaser3/).
    this.load.aseprite(
      'bounce',
      '../sample-export/sprite-sheet.png',
      '../sample-export/sprite-sheet.json',
    );
  }

  create() {
    this.anims.createFromAseprite('bounce');
    const sprite = this.add.sprite(
      this.scale.width / 2,
      this.scale.height / 2,
      'bounce',
    );
    sprite.setScale(4);
    sprite.play({ key: 'default', repeat: -1 });
  }
}

// eslint-disable-next-line no-new
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 320,
  height: 240,
  backgroundColor: '#1e293b',
  scene: DemoScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
