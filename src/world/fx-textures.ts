// src/world/fx-textures.ts: tiny textures drawn at start-up for sparks and floating notes.
import type * as Phaser from "phaser";

export function ensureFxTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists("fx_spark")) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 0, 1, 5);
    g.fillRect(0, 2, 5, 1);
    g.fillRect(1, 1, 3, 3);
    g.generateTexture("fx_spark", 5, 5);
    g.destroy();
  }
  if (!scene.textures.exists("fx_mixer")) {
    // the engineer's pocket mixer, 13x9: a dark case, four faders, a red light
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x1c1a24, 1);
    g.fillRect(0, 0, 13, 9);
    g.fillStyle(0x56525e, 1);
    g.fillRect(0, 0, 13, 1);
    g.fillStyle(0x8a8694, 1);
    for (let i = 0; i < 4; i++) g.fillRect(2 + i * 3, 2, 1, 6);
    g.fillStyle(0xe8e4f0, 1);
    [5, 3, 6, 4].forEach((y, i) => g.fillRect(1 + i * 3, y, 3, 1));
    g.fillStyle(0xff4040, 1);
    g.fillRect(11, 1, 1, 1);
    g.generateTexture("fx_mixer", 13, 9);
    g.destroy();
  }
  if (!scene.textures.exists("fx_note")) {
    // an eighth note, 7x10: head, stem, flag
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 7, 4, 3);
    g.fillRect(1, 6, 3, 1);
    g.fillRect(3, 0, 1, 8);
    g.fillRect(4, 1, 1, 2);
    g.fillRect(5, 2, 1, 2);
    g.fillRect(6, 4, 1, 2);
    g.generateTexture("fx_note", 7, 10);
    g.destroy();
  }
}
