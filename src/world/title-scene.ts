// src/world/title-scene.ts: the title screen's living backdrop (owner direction, DECISIONS.md D-038): a great
// moon rising over the city, the Pattern faint in the sky, the flock crossing the moon, a shooting star now
// and then, and the city's Hum rising off the rooftops as small pink notes.
import * as Phaser from "phaser";
import { ensureFxTextures } from "./fx-textures";

const V: [number, number][] = [[0, 0], [-40, -18], [-40, 18], [-80, -36], [-80, 36], [-120, -54], [-120, 54]];

export class TitleScene extends Phaser.Scene {
  private stars: { x: number; y: number; p: number; c: number }[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private flock: Phaser.GameObjects.Sprite[] = [];
  private flockX = -120;
  private streak: { x: number; y: number; life: number } | null = null;
  private nextStreak = 2500;

  constructor() {
    super({ key: "title" });
  }

  create(): void {
    ensureFxTextures(this);
    this.add.image(0, 0, "title_sky").setOrigin(0, 0);
    this.fx = this.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD);
    this.stars = [];
    for (let i = 0; i < 48; i++) this.stars.push({ x: Math.floor(Math.random() * 640), y: Math.floor(Math.random() * 210), p: Math.random() * Math.PI * 2, c: [0xffffff, 0xffe9b0, 0xc8d4ff][i % 3] });
    this.flock = V.map((_, i) => this.add.sprite(-200, 0, "lead_swan", i % 4).setDepth(5).play({ key: "lead_swan", startFrame: i % 4 }));
    this.flockX = 140;
    this.time.addEvent({ delay: 380, loop: true, callback: () => this.hum() });
  }

  /** A note floats up from somewhere in the city and fades: the Hum. */
  private hum(): void {
    const x = 30 + Math.random() * 580;
    const n = this.add.image(x, 296 + Math.random() * 24, "fx_note").setTint(Math.random() < 0.7 ? 0xff7ae0 : 0x66e0ff).setAlpha(0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: n, y: n.y - 46 - Math.random() * 40, alpha: { from: 0.75, to: 0 }, duration: 3400, ease: "Sine.easeOut", onComplete: () => n.destroy() });
  }

  override update(time: number, delta: number): void {
    const fx = this.fx;
    fx.clear();
    for (const s of this.stars) {
      const a = 0.2 + 0.8 * Math.max(0, Math.sin(time / 650 + s.p));
      fx.fillStyle(s.c, a);
      fx.fillRect(s.x, s.y, 1, 1);
      if (a > 0.93) {
        fx.fillStyle(s.c, 0.35);
        fx.fillRect(s.x - 1, s.y, 3, 1);
        fx.fillRect(s.x, s.y - 1, 1, 3);
      }
    }
    // the flock crosses the moon, slow and silver, and comes round again
    this.flockX += delta * 0.02;
    if (this.flockX > 780) this.flockX = -160;
    this.flock.forEach((s, i) => s.setPosition(Math.round(this.flockX + V[i][0]), Math.round(176 + V[i][1] + Math.sin(time / 520 + i) * 2)));
    if (time > this.nextStreak && !this.streak) {
      this.streak = { x: 60 + Math.random() * 360, y: 20 + Math.random() * 70, life: 700 };
      this.nextStreak = time + 4000 + Math.random() * 5000;
    }
    if (this.streak) {
      const st = this.streak;
      st.x += delta * 0.32;
      st.y += delta * 0.11;
      st.life -= delta;
      const a = Math.max(0, Math.min(1, st.life / 300));
      fx.lineStyle(1, 0xffffff, a);
      fx.lineBetween(st.x, st.y, st.x - 18, st.y - 6);
      fx.lineStyle(1, 0xc8b8ff, a * 0.5);
      fx.lineBetween(st.x - 18, st.y - 6, st.x - 34, st.y - 11);
      if (st.life <= 0) this.streak = null;
    }
  }
}
