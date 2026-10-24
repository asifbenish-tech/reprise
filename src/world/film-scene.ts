// src/world/film-scene.ts: the opening film, played in the game's own graphics (owner direction, DECISIONS.md
// D-037). Painted plates, sprites moved across them, light drawn on top; nothing is scaled or rotated (GDD 7.1).
// The script that drives it, with the narration, is src/world/scripts/film.ts.
import * as Phaser from "phaser";
import type { FilmControl, FilmEvent, FilmShot } from "./game";
import { ensureFxTextures } from "./fx-textures";

interface Flier {
  s: Phaser.GameObjects.Sprite;
  pos: { x: number; y: number };
  rel: [number, number] | null; // place in the formation, or null when a tween moves it
  phase: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
}

const PINK = 0xff7ae0;
const GOLD = 0xffd27a;
const CAGE = 10; // notes in the loop that circles the flock
const CYAN = 0x66e0ff;
const RIFT: [number, number] = [330, 66];
const TOWER: [number, number] = [226, 34];
const V: [number, number][] = [[0, 0], [-42, -20], [-42, 20], [-84, -40], [-84, 40], [-126, -60], [-126, 60]];

const lerpColor = (a: number, b: number, t: number) => {
  const c = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

export class FilmScene extends Phaser.Scene implements FilmControl {
  private resolveReady: () => void = () => {};
  private ready: Promise<void> = Promise.resolve();
  private objs: Phaser.GameObjects.GameObject[] = [];
  private fliers: Flier[] = [];
  private rings: Ring[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private shade!: Phaser.GameObjects.Graphics;
  private shotId: FilmShot | null = null;
  private rift = { v: 0 };
  private sick = { v: 0 };
  private anchor = { x: 0, y: 0 };
  private hunger: { x: number; y: number; a: number } | null = null;
  private songFrom: [number, number] | null = null;
  private lastRing = 0;
  private lastNote = 0;
  /** Threads being pulled out of a swan and back to where the song plays. */
  private pulls: { f: Flier; until: number; seed: number }[] = [];
  /** The hook going round and round the flock, and how solid it has become. */
  private cage: Phaser.GameObjects.Image[] = [];
  private cageA = { v: 0 };
  private lastCall = 0;

  constructor() {
    super({ key: "film" });
  }

  /** Called before each launch, so the control can wait for this run's create(). */
  prepare(): void {
    this.ready = new Promise((r) => (this.resolveReady = r));
  }

  create(): void {
    ensureFxTextures(this);
    this.cameras.main.setBackgroundColor("#000000");
    this.shade = this.add.graphics().setDepth(40);
    this.fx = this.add.graphics().setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.anims.exists("film_swan_fly")) this.anims.create({ key: "film_swan_fly", frames: this.anims.generateFrameNumbers("film_swan", {}), frameRate: 9, repeat: -1 });
    this.shotId = null;
    this.sick.v = 0;
    this.resolveReady();
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private clear(): void {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.fliers = [];
    this.rings = [];
    this.pulls = [];
    this.cage = [];
    this.cageA.v = 0;
    this.rift.v = 0;
    this.hunger = null;
    this.songFrom = null;
    this.tweens.killAll();
  }

  private fade(out: boolean, ms: number): Promise<void> {
    const cam = this.cameras.main;
    return new Promise((res) => {
      cam.once(out ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => res());
      if (out) cam.fadeOut(ms, 0, 0, 0);
      else cam.fadeIn(ms, 0, 0, 0);
    });
  }

  async shot(id: FilmShot): Promise<void> {
    await this.ready;
    if (this.shotId) await this.fade(true, 380);
    this.clear();
    this.shotId = id;
    if (id === "island") this.keep(this.add.image(0, 0, "film_island").setOrigin(0, 0));
    else if (id === "space") this.space();
    else this.earth();
    await this.fade(false, 900);
  }

  private flier(key: string, x: number, y: number, rel: [number, number] | null, phase: number): Flier {
    const s = this.keep(this.add.sprite(x, y, key, 0).setDepth(20));
    s.play({ key: key === "film_swan" ? "film_swan_fly" : key, startFrame: phase % 4 });
    const f = { s, pos: { x, y }, rel, phase };
    this.fliers.push(f);
    return f;
  }

  private space(): void {
    this.keep(this.add.image(0, -48, "bg_crossing_far").setOrigin(0, 0));
    const near = this.keep(this.add.image(0, -48, "bg_crossing").setOrigin(0, 0));
    this.tweens.add({ targets: near, x: -70, duration: 45000 });
    this.anchor.x = -160;
    this.anchor.y = 122;
    this.tweens.add({ targets: this.anchor, x: 320, duration: 5200, ease: "Sine.easeOut" });
    V.forEach((rel, i) => this.flier("lead_swan", -200, 120, rel, i));
  }

  private earth(): void {
    this.keep(this.add.image(0, 0, "film_earth").setOrigin(0, 0));
    this.songFrom = [404, 178];
    for (let i = 0; i < 7; i++) {
      const f = this.flier("film_swan", 30 + i * 26, 26 + (i % 3) * 12, null, i);
      this.tweens.add({ targets: f.pos, x: 372 + (i % 3) * 14, y: 158 + (i % 4) * 4, delay: i * 260, duration: 10500, ease: "Sine.easeIn" });
    }
  }

  event(id: FilmEvent): void {
    if (id === "tear") {
      this.tweens.add({ targets: this.rift, v: 1, duration: 1400, ease: "Quad.easeOut" });
      for (let i = 0; i < 7; i++) {
        const f = this.flier("film_swan", TOWER[0] + (i % 3) * 6 - 6, TOWER[1] + 8 + i, null, i);
        f.s.setAlpha(0);
        this.tweens.add({ targets: f.s, alpha: 1, delay: 700 + i * 280, duration: 200 });
        this.tweens.add({
          targets: f.pos,
          x: RIFT[0] + (i % 2 ? 3 : -3),
          y: RIFT[1],
          delay: 700 + i * 280,
          duration: 1900,
          ease: "Sine.easeInOut",
          onComplete: () => this.tweens.add({ targets: f.s, alpha: 0, duration: 160 }),
        });
      }
    } else if (id === "slip") {
      // the hunger that followed the flock out of the first game (GDD 2)
      const h = { x: 90, y: 250, a: 0 };
      this.hunger = h;
      this.tweens.add({ targets: h, a: 1, duration: 600 });
      this.tweens.add({
        targets: h,
        x: RIFT[0],
        y: RIFT[1],
        duration: 3200,
        ease: "Sine.easeIn",
        onComplete: () => {
          this.tweens.add({ targets: h, a: 0, duration: 300 });
          this.tweens.add({ targets: this.rift, v: 0, delay: 200, duration: 900 });
        },
      });
    } else if (id === "song") {
      this.songFrom = [540, 282];
      this.tweens.add({ targets: this.sick, v: 0.55, duration: 9000 });
      // the hook closes round the flock: four notes and an "ooh", going round and never stopping
      this.cage = Array.from({ length: CAGE }, (_, k) =>
        this.keep(this.add.image(540, 282, "fx_note").setTint(k % 5 === 4 ? CYAN : PINK).setDepth(32).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)),
      );
      this.tweens.add({ targets: this.cageA, v: 1, duration: 3500, ease: "Sine.easeIn" });
    } else if (id === "falter") {
      this.tweens.add({ targets: this.sick, v: 1, duration: 5000 });
      this.tweens.add({ targets: this.anchor, x: this.anchor.x + 70, y: this.anchor.y + 46, duration: 7000, ease: "Sine.easeIn" });
    }
  }

  /** A golden call from one swan to another; if the hook is in the way it greys, falls and is gone. */
  private call(from: Flier, to: Flier, blocked: boolean): void {
    const n = this.keep(this.add.image(from.s.x + 16, from.s.y - 8, "fx_note").setTint(GOLD).setDepth(31).setBlendMode(Phaser.BlendModes.ADD));
    const tx = to.s.x + 10;
    const ty = to.s.y - 8;
    if (!blocked) {
      this.tweens.add({ targets: n, x: tx, y: ty, duration: 900, ease: "Sine.easeInOut", onComplete: () => n.destroy() });
      return;
    }
    this.tweens.add({
      targets: n,
      x: n.x + (tx - n.x) * 0.45,
      y: n.y + (ty - n.y) * 0.45 - 6,
      duration: 480,
      ease: "Sine.easeOut",
      onComplete: () => {
        const hit = this.keep(this.add.image(n.x, n.y, "fx_spark").setTint(PINK).setDepth(31).setBlendMode(Phaser.BlendModes.ADD));
        this.tweens.add({ targets: hit, alpha: 0, duration: 300, onComplete: () => hit.destroy() });
        n.setBlendMode(Phaser.BlendModes.NORMAL).setTint(0x77748a);
        this.tweens.add({ targets: n, y: n.y + 22, alpha: 0, duration: 800, ease: "Quad.easeIn", onComplete: () => n.destroy() });
      },
    });
  }

  async end(fadeMs = 900): Promise<void> {
    await this.ready;
    await this.fade(true, fadeMs);
    this.clear();
    this.scene.stop();
  }

  override update(time: number, delta: number): void {
    const fx = this.fx;
    if (!fx) return;
    fx.clear();
    this.shade.clear();
    const sick = this.sick.v;
    // the Pattern shimmering over the Island
    if (this.shotId === "island")
      for (let k = 0; k < 7; k++) {
        fx.fillStyle(0xffe9b0, 0.35 + Math.random() * 0.6);
        fx.fillRect(Math.floor(Math.random() * 640), Math.floor(Math.random() * 150), 1, 1);
      }
    // the tear: a lens of light that opens in the sky
    if (this.rift.v > 0.01) {
      const [x, y] = RIFT;
      const v = this.rift.v;
      const flick = 0.9 + Math.sin(time / 60) * 0.1;
      for (let r = 4; r >= 1; r--) {
        fx.fillStyle(0x8a6aff, 0.12 * v * flick);
        fx.fillEllipse(x, y, (8 + r * 9) * v, (40 + r * 16) * v);
      }
      fx.fillStyle(0xffffff, 0.9 * v);
      fx.fillEllipse(x, y, 5 * v, 46 * v);
    }
    if (this.hunger && this.hunger.a > 0) {
      const h = this.hunger;
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4 + time / 500;
        const r = 4 + (k % 4) * 2;
        this.shade.fillStyle(k % 3 ? 0x141218 : 0x2a2632, 0.8 * h.a);
        this.shade.fillCircle(h.x + Math.cos(a) * (6 + (k % 5) * 2), h.y + Math.sin(a * 1.3) * 5, r);
      }
    }
    // the song: rings from where it plays, notes that find the swans
    if (this.songFrom) {
      const [sx, sy] = this.songFrom;
      if (time - this.lastRing > 650) {
        this.lastRing = time;
        this.rings.push({ x: sx, y: sy, r: 4, max: this.shotId === "earth" ? 70 : 260 });
      }
      for (const r of this.rings) r.r += delta * (this.shotId === "earth" ? 0.025 : 0.07);
      this.rings = this.rings.filter((r) => r.r < r.max);
      for (const r of this.rings) {
        fx.lineStyle(1, PINK, 0.8 * (1 - r.r / r.max));
        fx.strokeCircle(r.x, r.y, r.r);
      }
      if (this.shotId === "space" && this.fliers.length && time - this.lastNote > 420) {
        this.lastNote = time;
        const f = this.fliers[Math.floor(Math.random() * this.fliers.length)];
        const n = this.keep(this.add.image(sx, sy, "fx_note").setTint(Math.random() < 0.6 ? PINK : CYAN).setDepth(30).setBlendMode(Phaser.BlendModes.ADD));
        this.tweens.add({
          targets: n,
          x: f.s.x + 8,
          y: f.s.y - 10,
          duration: 1500,
          ease: "Sine.easeIn",
          onComplete: () => {
            // the note lands, and a thread of the swan is pulled out after it, back towards the song
            n.destroy();
            this.pulls.push({ f, until: this.time.now + 1600, seed: Math.random() * 10 });
            const p = this.keep(this.add.image(f.s.x - 4, f.s.y, "fx_spark").setTint(0xc8c4d4).setDepth(30));
            this.tweens.add({ targets: p, y: p.y + 18, x: p.x - 6, alpha: 0, duration: 900, onComplete: () => p.destroy() });
          },
        });
      }
    }
    if (this.shotId === "earth") {
      const k = 0.6 + Math.sin(time / 240) * 0.4;
      fx.fillStyle(PINK, 0.22 * k);
      fx.fillEllipse(404, 178, 70, 26);
      fx.fillStyle(0xffd0f4, 0.5 * k);
      fx.fillEllipse(404, 178, 16, 6);
    }
    // the flock's own song: calls passing from swan to swan. Once the hook is going round, none gets through.
    if (this.shotId === "space" && this.fliers.length > 1 && time - this.lastCall > 620) {
      this.lastCall = time;
      const i = 1 + Math.floor(Math.random() * (this.fliers.length - 1));
      // each swan hears the one ahead of it on its side of the V; the first pair hears the eldest
      const from = this.fliers[i <= 2 ? 0 : i - 2];
      const to = this.fliers[i];
      this.call(from, to, this.cageA.v > 0.25);
    }
    if (this.cage.length) {
      const cx = this.anchor.x - 52;
      const cy = this.anchor.y;
      fx.lineStyle(1, PINK, 0.22 * this.cageA.v);
      fx.strokeEllipse(cx, cy, 300, 190);
      this.cage.forEach((n, k) => {
        const a = time / 850 + (k / CAGE) * Math.PI * 2;
        n.setPosition(Math.round(cx + Math.cos(a) * 150), Math.round(cy + Math.sin(a) * 95));
        n.setAlpha(0.9 * this.cageA.v);
      });
    }
    // the drain made visible: threads of the flock's own light, unwinding towards the song
    if (this.songFrom) {
      const [sx, sy] = this.songFrom;
      this.pulls = this.pulls.filter((p) => p.until > time);
      for (const p of this.pulls) {
        const a = Math.min(1, (p.until - time) / 600);
        const x0 = p.f.s.x - 6;
        const y0 = p.f.s.y + 2;
        const reach = Math.min(1, 1 - (p.until - time) / 1600 + 0.25);
        fx.lineStyle(1, 0xfff0c8, 0.75 * a);
        let px = x0;
        let py = y0;
        for (let i = 1; i <= 18; i++) {
          const t = (i / 18) * reach;
          const x = x0 + (sx - x0) * t;
          const y = y0 + (sy - y0) * t + Math.sin(t * 14 + time / 120 + p.seed) * 4 * (1 - t);
          fx.lineBetween(px, py, x, y);
          px = x;
          py = y;
        }
      }
    }
    // their strength: a soft light around each swan that dims as the song takes it
    if (this.shotId === "space")
      for (const f of this.fliers) {
        fx.fillStyle(0xe8e4ff, 0.16 * (1 - sick));
        fx.fillEllipse(f.s.x, f.s.y, 46, 26);
        fx.fillStyle(0xffffff, 0.12 * (1 - sick));
        fx.fillEllipse(f.s.x, f.s.y, 30, 16);
      }
    // the flock: a formation that wavers, greys and slows as the song takes hold
    const tint = lerpColor(0xffffff, 0x8a8898, this.shotId === "earth" ? 1 : sick);
    for (const f of this.fliers) {
      if (f.rel) {
        const jitter = sick * 10;
        f.pos.x = this.anchor.x + f.rel[0] + Math.sin(time / 700 + f.phase * 1.7) * jitter;
        f.pos.y = this.anchor.y + f.rel[1] + Math.cos(time / 530 + f.phase) * jitter;
      }
      const bob = Math.sin(time / 380 + f.phase) * (1.5 + sick * 4);
      f.s.setPosition(Math.round(f.pos.x), Math.round(f.pos.y + bob));
      f.s.setTint(tint);
      f.s.anims.timeScale = 1 - Math.min(0.55, (this.shotId === "earth" ? 1 : sick) * 0.55);
    }
  }
}
