// src/world/room-scene.ts: one Phaser scene builds any room from its JSON (GDD 9.7).
import * as Phaser from "phaser";
import * as Tone from "tone";
import type { HotspotDef, RoomDef } from "../content/types";
import { artUrl, manifest } from "../content/load";
import type { Song } from "../audio/song";
import type { FilmControl, Game, View } from "./game";
import type { FilmScene } from "./film-scene";
import { clampInside, findPath, type Pt } from "./walker";
import { CastFx } from "./cast-fx";

export const WORLD_W = 640;
export const WORLD_H = 360;
/** The scene ends here; below it is the black panel with the speech line and the Distaff (GDD 4.1). */
export const SCENE_H = 296;
const WALK_SPEED = 72; // px per second
const DOUBLE_MS = 350;

interface Walk {
  path: Pt[];
  done: () => void;
}

export class RoomScene extends Phaser.Scene implements View {
  private g!: Game;
  private layers: Phaser.GameObjects.Image[] = [];
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private controlled = new Set<string>(); // sprites a script has posed; they don't idle-animate
  private spriteDefs = new Map<string, HotspotDef>();
  private bobbin!: Phaser.GameObjects.Sprite;
  private skein!: Phaser.GameObjects.Sprite;
  private walk: Walk | null = null;
  private lastClick = { t: 0, x: 0, y: 0 };
  private glintAt: Phaser.GameObjects.Graphics | null = null;
  private glintId: string | null = null;
  private colour: Phaser.Filters.ColorMatrix | null = null;
  private restored = 1;
  private flockWhite = 1;
  private swan = false;
  private skeinFacing: number | null = null;
  private lit = true;
  private fx!: CastFx;
  private selMark!: Phaser.GameObjects.Graphics;
  private drainFx!: Phaser.GameObjects.Graphics;
  private drains: { from: string; to: string | [number, number]; start: number; until: number }[] = [];
  private weaveFx!: Phaser.GameObjects.Graphics;
  private hookRings: { x: number; y: number; start: number; until: number }[] = [];
  private cocoon: { x: number; y: number; t: number; fade: number } | null = null;
  private held: number | null = null;
  onHover: (label: string | null, sx: number, sy: number) => void = () => {};
  onReady: () => void = () => {};
  /** Every image has loaded (the title's backdrop can start). */
  onLoaded: () => void = () => {};
  onSkein: () => void = () => {};
  onProgress: (p: number) => void = () => {};

  constructor() {
    super({ key: "room" });
  }

  init(data: { game: Game }): void {
    this.g = data.game;
  }

  preload(): void {
    this.load.on("progress", (p: number) => this.onProgress(p));
    for (const img of manifest.images) {
      const url = artUrl(img.path);
      const normal = img.normal ? artUrl(img.normal) : undefined;
      if (img.frames > 1) {
        this.load.spritesheet({ key: img.id, url, normalMap: normal, frameConfig: { frameWidth: img.frameW ?? img.w / img.frames, frameHeight: img.h } });
      } else {
        this.load.image({ key: img.id, url, normalMap: normal });
      }
    }
  }

  create(): void {
    for (const img of manifest.images) {
      if (img.frames <= 1) continue;
      this.anims.create({ key: img.id, frames: this.anims.generateFrameNumbers(img.id, {}), frameRate: 8, repeat: -1 });
    }
    this.anims.create({ key: "bobbin_walk", frames: this.anims.generateFrameNumbers("bobbin", { start: 1, end: 8 }), frameRate: 12, repeat: -1 });
    this.anims.create({ key: "conveyor_fast", frames: this.anims.generateFrameNumbers("conveyor", {}), frameRate: 18, repeat: -1 });
    this.anims.create({ key: "dancers_free", frames: this.anims.generateFrameNumbers("dancers", { frames: [0, 2, 1, 3, 2, 0, 3, 1] }), frameRate: 7, repeat: -1 });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.click(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.hover(p));
    this.colour = this.cameras.main.filters.internal.addColorMatrix();
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fx = new CastFx(this, {
      bobbin: () => this.bobbin ?? null,
      walking: () => !!this.walk,
      swan: () => this.swan,
      lighting: () => this.lit && !this.g.settings.lowDetail,
      quiet: () => this.g.fast || this.g.settings.lowDetail || reduced,
    });
    this.selMark = this.add.graphics().setDepth(4800);
    this.drainFx = this.add.graphics().setDepth(4700).setBlendMode(Phaser.BlendModes.ADD);
    this.weaveFx = this.add.graphics().setDepth(4950).setBlendMode(Phaser.BlendModes.ADD);
    this.g.bus.on("note", ({ n, cracked }) => this.fx.note(n, cracked));
    this.g.bus.on("phraseFailed", () => this.fx.fail());
    this.g.bus.on("cast", (e) => this.fx.cast(e.target?.kind === "hotspot" ? this.hotspotCenter(e.target.id) : null, e.fromLoop));
    this.g.view = this;
    this.onLoaded();
    this.onReady();
  }

  setLighting(on: boolean): void {
    this.lit = on;
  }

  buildRoom(room: RoomDef, entry: string): void {
    for (const l of this.layers) l.destroy();
    for (const s of this.sprites.values()) s.destroy();
    this.bobbin?.destroy();
    this.skein?.destroy();
    this.glintAt?.destroy();
    this.glintAt = null;
    this.glintId = null;
    this.layers = [];
    this.sprites.clear();
    this.controlled.clear();
    this.spriteDefs.clear();
    this.walk = null;
    this.skeinFacing = null;

    const lighting = this.lit && !this.g.settings.lowDetail;
    for (const l of [...this.lights.lights]) this.lights.removeLight(l);
    this.fx?.reset();
    this.drains = [];
    this.cocoon = null;
    this.hookRings = [];
    this.weaveFx?.clear();
    this.onHover(null, 0, 0);
    if (lighting) {
      this.lights.enable();
      this.lights.setAmbientColor(Phaser.Display.Color.HexStringToColor(room.ambient ?? "#b0b0b8").color);
      for (const l of room.lights ?? []) {
        this.lights.addLight(l.x, l.y, l.radius, Phaser.Display.Color.HexStringToColor(l.color).color, l.intensity, 120);
      }
    } else this.lights.disable();

    room.layers.forEach((l, i) => {
      const img = this.add.image(0, 0, l.image).setOrigin(0, 0).setScrollFactor(l.scroll).setDepth(l.front ? 5000 + i : -100 + i);
      if (l.lit && lighting) img.setLighting(true);
      this.layers.push(img);
    });

    for (const h of room.hotspots) {
      if (!h.sprite) continue;
      const s = this.add.sprite(h.sprite.x, h.sprite.y, h.sprite.image).setOrigin(0.5, 1);
      s.setDepth(h.sprite.depth ?? h.sprite.y);
      if (h.sprite.lit && lighting) s.setLighting(true);
      this.sprites.set(h.id, s);
      this.spriteDefs.set(h.id, h);
    }

    const start = room.entries[entry] ?? Object.values(room.entries)[0] ?? [320, 280];
    this.bobbin = this.add.sprite(start[0], start[1], "bobbin", 0).setOrigin(0.5, 1);
    if (lighting) this.bobbin.setLighting(true);
    this.skein = this.add.sprite(start[0] - 22, start[1], "skein", 0).setOrigin(0.5, 1);
    this.skein.play("skein");
    this.setSwan(this.swan);
    this.cameras.main.setBounds(0, 0, room.width, WORLD_H);
    this.cameras.main.centerOn(start[0], WORLD_H / 2);
    this.refreshHotspots();
    this.applyColour();
  }

  setSwan(swan: boolean): void {
    this.swan = swan;
    if (!this.bobbin) return;
    if (this.g.save) this.skein?.setVisible(this.g.flag("skein") && !swan);
    if (swan) {
      this.bobbin.setTexture("bobbin_swan");
      this.bobbin.play("bobbin_swan");
    } else {
      this.bobbin.anims.stop();
      this.bobbin.setTexture("bobbin", 0);
    }
    this.bobbin.setVisible(!(this.g.room?.id === "crossing" && !swan));
  }

  refreshHotspots(): void {
    for (const [id, s] of this.sprites) {
      const h = this.spriteDefs.get(id)!;
      s.setVisible(this.g.cond(h.when));
      const fw = h.sprite?.frameWhen?.find(([, c]) => this.g.cond(c));
      if (fw) this.setSprite(id, { frame: fw[0] });
    }
    // Skein walks beside him once he is a man; while he is a swan she swims, and her sprite is the room's own
    this.skein?.setVisible(this.g.flag("skein") && !this.swan);
  }

  hotspotCenter(id: string): [number, number] | null {
    const h = this.g.room.hotspots.find((x) => x.id === id);
    if (!h) return null;
    return [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] / 2];
  }

  /** Screen-space rectangles of every live hotspot, for the hotspot-reveal key. */
  hotspotScreenRects(): { h: HotspotDef; x: number; y: number; w: number; hgt: number }[] {
    const cam = this.cameras.main;
    return this.g.hotspots().filter((h) => h.id !== "_self").map((h) => ({ h, x: h.rect[0] - cam.scrollX, y: h.rect[1] - cam.scrollY, w: h.rect[2], hgt: h.rect[3] }));
  }

  private hit(x: number, y: number): HotspotDef | null {
    const hs = this.g.hotspots();
    for (let i = hs.length - 1; i >= 0; i--) {
      const h = hs[i];
      if (h.id === "_self") continue;
      const [rx, ry, rw, rh] = h.rect;
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return h;
    }
    return null;
  }

  private click(p: Phaser.Input.Pointer): void {
    if (this.g.loom || this.g.busy) return;
    if (p.y >= SCENE_H) return; // the panel under the scene
    const now = performance.now();
    const double = now - this.lastClick.t < DOUBLE_MS && Math.hypot(p.x - this.lastClick.x, p.y - this.lastClick.y) < 12;
    this.lastClick = { t: double ? 0 : now, x: p.x, y: p.y };
    if (this.skein?.visible && this.skein.getBounds().contains(p.worldX, p.worldY)) {
      this.onSkein();
      return;
    }
    const h = this.hit(p.worldX, p.worldY);
    if (h) void this.g.clickHotspot(h.id, double);
    else this.g.clickFloor(p.worldX, p.worldY, double);
  }

  private hover(p: Phaser.Input.Pointer): void {
    if (this.g.loom) return this.onHover(null, 0, 0);
    const h = p.y < SCENE_H ? this.hit(p.worldX, p.worldY) : null;
    this.onHover(h ? h.name : null, p.x, p.y);
  }

  bobbinPos(): [number, number] {
    return [this.bobbin.x, this.bobbin.y];
  }

  face(x: number): void {
    this.bobbin.setFlipX(x < this.bobbin.x);
  }

  walkTo(x: number, y: number, instant = false): Promise<void> {
    const poly = this.g.room.walk as Pt[];
    if (this.swan && this.g.room.id === "crossing") return Promise.resolve();
    this.walk?.done();
    if (instant || this.g.fast) {
      const [tx, ty] = clampInside(poly, [x, y]);
      this.bobbin.setPosition(tx, ty);
      this.walk = null;
      this.idle();
      return Promise.resolve();
    }
    const path = findPath(poly, [this.bobbin.x, this.bobbin.y], [x, y]);
    return new Promise((res) => {
      this.walk = { path, done: res };
      this.fx.walked();
      if (!this.swan) this.bobbin.play("bobbin_walk", true);
    });
  }

  private idle(): void {
    if (this.swan) return;
    this.bobbin.anims.stop();
    this.bobbin.setFrame(this.held ?? 0);
  }

  setSprite(id: string, s: { anim?: string; frame?: number; visible?: boolean; flipX?: boolean; alpha?: number }): void {
    const sp = this.sprites.get(id);
    if (!sp) return;
    if (s.anim !== undefined || s.frame !== undefined) this.controlled.add(id);
    if (s.anim) sp.play(s.anim, true);
    if (s.frame !== undefined) {
      sp.anims.stop();
      sp.setFrame(s.frame);
    }
    if (s.visible !== undefined) sp.setVisible(s.visible);
    if (s.flipX !== undefined) sp.setFlipX(s.flipX);
    if (s.alpha !== undefined) sp.setAlpha(s.alpha);
  }

  moveSprite(id: string, x: number, y: number, seconds: number): Promise<void> {
    const sp = id === "bobbin" ? this.bobbin : this.sprites.get(id);
    if (!sp) return Promise.resolve();
    if (this.g.fast || seconds <= 0) {
      sp.setPosition(x, y);
      return Promise.resolve();
    }
    return new Promise((res) => this.tweens.add({ targets: sp, x, y, duration: seconds * 1000, onComplete: () => res() }));
  }

  glint(id: string | null): void {
    this.glintAt?.destroy();
    this.glintAt = null;
    this.glintId = id;
    if (!id) return;
    const c = this.hotspotCenter(id);
    if (!c) return;
    this.glintAt = this.add.graphics().setDepth(900);
    this.glintAt.setPosition(c[0], c[1]);
  }

  skeinLook(x: number | null): void {
    this.skeinFacing = x;
  }

  flash(color: number, ms: number): void {
    const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
    this.cameras.main.flash(ms, r, g, b);
  }

  setRestored(level: number): void {
    this.restored = level;
    this.applyColour();
  }

  setFlockWhite(level: number): void {
    this.flockWhite = level;
  }

  private applyColour(): void {
    if (!this.colour) return;
    const cm = this.colour.colorMatrix;
    cm.reset();
    if (this.restored < 1) {
      cm.saturate(-0.55 * (1 - this.restored));
      cm.contrast(-0.08 * (1 - this.restored), true);
    }
  }

  /** Starts the opening film's scene on top of this one and hands back its controls. */
  film(): FilmControl {
    const fs = this.scene.get("film") as FilmScene;
    fs.prepare();
    this.scene.launch("film");
    return fs;
  }

  drain(from: string, to: string | [number, number], seconds: number): void {
    if (this.g.fast) return;
    const now = performance.now();
    this.drains.push({ from, to, start: now, until: now + seconds * 1000 });
  }

  muffle(from: string, by: string): void {
    if (this.g.fast) return;
    const song = this.sprites.get(by);
    const at = song ? [song.x + 6, song.y - song.height * 0.55] : this.hotspotCenter(by);
    const src = from === "bobbin" ? this.bobbin : this.sprites.get(from);
    if (!at || !src) return;
    const now = performance.now();
    this.hookRings.push({ x: at[0], y: at[1], start: now, until: now + 3200 });
    const starts: [number, number][] =
      from === "bobbin"
        ? [this.fx.tip() ?? [src.x, src.y - 20]]
        : Array.from({ length: 6 }, (_, i) => [src.x - src.width / 2 + 22 + (i * (src.width - 44)) / 5, src.y - 18] as [number, number]);
    starts.forEach(([x0, y0], i) => {
      const note = this.add.image(x0, y0, "fx_note").setTint(0xffd27a).setDepth(4960).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.tweens.add({
        targets: note,
        alpha: 1,
        y: y0 - 16,
        delay: i * 170,
        duration: 520,
        ease: "Sine.easeOut",
        onComplete: () => {
          // the hook rolls over the note before it can carry: a pink flash, and it falls grey
          const hit = this.add.image(note.x, note.y, "fx_spark").setTint(0xff7ae0).setDepth(4961).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: hit, alpha: 0, duration: 380, onComplete: () => hit.destroy() });
          note.setBlendMode(Phaser.BlendModes.NORMAL).setTint(0x77748a);
          this.tweens.add({ targets: note, y: note.y + 18, alpha: 0, duration: 850, ease: "Quad.easeIn", onComplete: () => note.destroy() });
        },
      });
    });
  }

  give(from: string): void {
    if (this.g.fast) return;
    const src = this.sprites.get(from);
    const tip = this.fx.tip();
    if (!src || !tip) return;
    for (let i = 0; i < 8; i++) {
      const n = this.add.image(src.x + (Math.random() - 0.5) * 20, src.y - src.height * 0.6, "fx_note").setTint(0xffd27a).setDepth(4960).setBlendMode(Phaser.BlendModes.ADD);
      const mid = { x: (n.x + tip[0]) / 2, y: Math.min(n.y, tip[1]) - 30 - Math.random() * 20 };
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(n.x, n.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(tip[0], tip[1]));
      const k = { t: 0 };
      this.tweens.add({
        targets: k,
        t: 1,
        delay: i * 180,
        duration: 1100,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          const v = curve.getPoint(k.t);
          n.setPosition(v.x, v.y);
        },
        onComplete: () => n.destroy(),
      });
    }
    this.time.delayedCall(8 * 180 + 1100, () => this.fx.note(2, false));
  }

  transform(): Promise<void> {
    if (this.g.fast || !this.bobbin) {
      this.setSwan(false);
      return Promise.resolve();
    }
    const b = this.bobbin;
    const c = { x: b.x, y: b.y, t: 0, fade: 1 };
    this.cocoon = c;
    // the swan rises a little into the light as the threads close round it
    this.tweens.add({ targets: b, y: c.y - 8, duration: 2600, ease: "Sine.easeInOut" });
    return new Promise((res) => {
      this.tweens.add({
        targets: c,
        t: 1,
        duration: 2900,
        ease: "Sine.easeIn",
        onComplete: () => {
          this.flash(0xffffff, 800);
          this.setSwan(false);
          b.setY(c.y);
          this.bobbinFrame(11);
          this.tweens.add({ targets: c, fade: 0, duration: 1000, onComplete: () => { this.cocoon = null; this.weaveFx.clear(); res(); } });
        },
      });
    });
  }

  bobbinFrame(frame: number | null): void {
    this.held = frame;
    if (!this.bobbin || this.swan) return;
    this.bobbin.anims.stop();
    this.bobbin.setFrame(frame ?? 0);
    // spent: a little of his own colour has gone with the weaving
    this.bobbin.setTint(frame === 11 ? 0xb4b0c4 : 0xffffff);
  }

  /** Threads of light spiralling up round the swan, closing into a cocoon. */
  private drawWeave(now: number): void {
    const c = this.cocoon;
    if (!c) return;
    const g = this.weaveFx;
    g.clear();
    const t = c.t;
    const f = c.fade;
    const hgt = 12 + 70 * t;
    g.fillStyle(0xffe9b0, 0.16 * (0.3 + t) * f);
    g.fillEllipse(c.x, c.y - hgt / 2, 34 + 26 * t, hgt + 24);
    g.fillStyle(0xffffff, 0.22 * t * t * f);
    g.fillEllipse(c.x, c.y - hgt / 2, 16 + 10 * t, hgt * 0.8);
    for (let i = 0; i < 8; i++) {
      g.lineStyle(1, i % 2 ? 0xffd27a : 0xd8c8ff, (0.45 + 0.5 * t) * f);
      let px = 0;
      let py = 0;
      for (let k = 0; k <= 26; k++) {
        const u = k / 26;
        const ang = now / 240 + i * (Math.PI / 4) + u * 6.5;
        const r = (18 - 7 * u) * (0.55 + 0.45 * Math.sin(u * Math.PI)) * (1.3 - 0.4 * t);
        const x = c.x + Math.cos(ang) * r;
        const y = c.y - u * hgt + Math.sin(ang) * 3;
        if (k) g.lineBetween(px, py, x, y);
        px = x;
        py = y;
      }
    }
    for (let j = 0; j < 8; j++) {
      g.fillStyle(0xffffff, Math.random() * f);
      g.fillRect(c.x + (Math.random() - 0.5) * 40, c.y - Math.random() * (hgt + 20), 1, 1);
    }
  }

  /** Gold corners around the selected thing, so the player can see what the next draft will touch. */
  private drawSelection(now: number): void {
    const m = this.selMark;
    m.clear();
    const sel = this.g.selection;
    if (this.g.loom || sel?.kind !== "hotspot" || sel.id === "_self") return;
    const h = this.g.hotspot(sel.id);
    const sp = this.sprites.get(sel.id);
    if (!h || (sp && !sp.visible)) return;
    const [x, y, w, hh] = h.rect;
    const k = 0.55 + 0.45 * Math.sin(now / 260);
    const l = Math.min(7, Math.floor(Math.min(w, hh) / 3));
    m.lineStyle(1, 0x2a1640, 0.8 * k);
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + hh, 1, -1], [x + w, y + hh, -1, -1]] as const) {
      m.lineBetween(cx + dx, cy + dy * 2, cx + dx + dx * l, cy + dy * 2);
      m.lineBetween(cx + dx * 2, cy + dy, cx + dx * 2, cy + dy + dy * l);
    }
    m.lineStyle(1, 0xffe9a0, k);
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + hh, 1, -1], [x + w, y + hh, -1, -1]] as const) {
      m.lineBetween(cx, cy, cx + dx * l, cy);
      m.lineBetween(cx, cy, cx, cy + dy * l);
    }
  }

  /** Threads of light streaming out of the swans into whatever is playing the song (GDD premise). */
  private drawDrains(now: number): void {
    const d = this.drainFx;
    d.clear();
    // the hook's rings, spreading from where it plays
    this.hookRings = this.hookRings.filter((r) => r.until > now);
    for (const r of this.hookRings) {
      const life = Math.min(1, (r.until - now) / 600, (now - r.start) / 300);
      for (let k = 0; k < 4; k++) {
        const rad = ((now - r.start) / 1000) * 70 + k * 32;
        const rr = rad % 128;
        d.lineStyle(1, 0xff7ae0, 0.75 * (1 - rr / 128) * life);
        d.strokeCircle(r.x, r.y, rr);
        d.lineStyle(1, 0xff7ae0, 0.35 * (1 - rr / 128) * life);
        d.strokeCircle(r.x, r.y, rr + 1);
      }
    }
    this.drains = this.drains.filter((x) => x.until > now);
    for (const dr of this.drains) {
      const a = this.sprites.get(dr.from);
      const b = typeof dr.to === "string" ? this.sprites.get(dr.to) : null;
      if (!a || !a.visible || (typeof dr.to === "string" && (!b || !b.visible))) continue;
      const fade = Math.min(1, (dr.until - now) / 800, (now - dr.start) / 500);
      const tx = b ? b.x + 6 : (dr.to as [number, number])[0];
      const ty = b ? b.y - b.height * 0.55 : (dr.to as [number, number])[1];
      for (let k = 0; k < 6; k++) {
        const sx = a.x - a.width / 2 + 18 + ((k * 37) % Math.max(1, a.width - 36));
        const sy = a.y - 14 - (k % 2) * 4;
        const phase = now / 220 + k * 1.7;
        const col = k % 2 ? 0xffe9a8 : 0xf0e8ff;
        for (const [off, a] of [[0, 0.75], [1, 0.35]] as const) {
          d.lineStyle(1, col, (a + 0.2 * Math.sin(phase)) * fade);
          let px = sx;
          let py = sy + off;
          for (let i = 1; i <= 16; i++) {
            const t = i / 16;
            const x = sx + (tx - sx) * t;
            const y = sy + off + (ty - sy) * t - Math.sin(t * Math.PI) * 22 + Math.sin(phase + t * 9) * 3 * (1 - t);
            d.lineBetween(px, py, x, y);
            px = x;
            py = y;
          }
        }
        // a bead of light running along each thread, towards the song
        const t = (now / 900 + k / 6) % 1;
        d.fillStyle(0xffffff, 0.95 * fade);
        d.fillRect(sx + (tx - sx) * t - 1, sy + (ty - sy) * t - Math.sin(t * Math.PI) * 22 - 1, 3, 3);
      }
    }
  }

  openLoom(song: Song): void {
    this.scene.launch("loom", { game: this.g, song });
  }

  closeLoom(): void {
    this.scene.stop("loom");
  }

  override update(_time: number, delta: number): void {
    if (!this.g?.room || !this.bobbin) return;
    if (this.walk) {
      let step = (WALK_SPEED * delta) / 1000;
      while (step > 0 && this.walk.path.length) {
        const [tx, ty] = this.walk.path[0];
        const d = Math.hypot(tx - this.bobbin.x, ty - this.bobbin.y);
        if (d <= step) {
          this.bobbin.setPosition(tx, ty);
          this.walk.path.shift();
          step -= d;
        } else {
          this.bobbin.setFlipX(tx < this.bobbin.x);
          this.bobbin.x += ((tx - this.bobbin.x) / d) * step;
          this.bobbin.y += ((ty - this.bobbin.y) / d) * step;
          step = 0;
        }
      }
      if (!this.walk.path.length) {
        const w = this.walk;
        this.walk = null;
        this.idle();
        w.done();
      }
    }
    this.bobbin.setDepth(this.bobbin.y);
    this.fx.update(delta);
    const now = performance.now();
    this.drawSelection(now);
    this.drawDrains(now);
    this.drawWeave(now);
    const room = this.g.room;
    if (room.width > WORLD_W) this.cameras.main.centerOn(this.bobbin.x, WORLD_H / 2);

    if (this.skein.visible) {
      const tx = this.bobbin.x + (this.bobbin.flipX ? 24 : -24);
      this.skein.x += (tx - this.skein.x) * Math.min(1, delta / 260);
      this.skein.y += (this.bobbin.y - this.skein.y) * Math.min(1, delta / 260);
      this.skein.setDepth(this.skein.y - 1);
      this.skein.setFlipX(this.skeinFacing !== null ? this.skeinFacing < this.skein.x : this.bobbin.flipX);
    }

    // Drained places animate in rigid loops locked to the beat; restored ones drift (GDD 7.4, 7.5).
    const beat = this.g.mixer ? this.g.conductor.beatsAt(Tone.now()) : 0;
    for (const [id, s] of this.sprites) {
      const def = this.spriteDefs.get(id)!.sprite!;
      if (id.startsWith("flock")) s.setTint(Phaser.Display.Color.GetColor(...grey(this.flockWhite)));
      if (this.controlled.has(id) || !this.anims.exists(def.image)) continue;
      if (this.restored < 1) {
        if (s.anims.isPlaying) s.anims.stop();
        const frames = s.texture.frameTotal - 1;
        s.setFrame(Math.floor(beat * 2 + (def.x % 3)) % Math.max(1, frames));
      } else if (!s.anims.isPlaying) {
        const frames = Math.max(1, s.texture.frameTotal - 1);
        s.play({ key: def.image, frameRate: (def.fps ?? 8) * (0.9 + ((def.x * 7) % 20) / 100), startFrame: Math.floor(def.x) % frames });
      }
    }

    if (this.glintAt && this.glintId) {
      const k = (Math.sin(performance.now() / 160) + 1) / 2;
      this.glintAt.clear();
      this.glintAt.fillStyle(0xffe9a0, 0.35 + 0.5 * k);
      this.glintAt.fillCircle(0, 0, 2 + 2 * k);
      this.glintAt.lineStyle(1, 0xfff6d0, 0.6 * k);
      this.glintAt.lineBetween(-6 - 3 * k, 0, 6 + 3 * k, 0);
      this.glintAt.lineBetween(0, -6 - 3 * k, 0, 6 + 3 * k);
    }
    this.g.frame();
  }
}

function grey(white: number): [number, number, number] {
  const v = Math.round(150 + 105 * white);
  return [v, v, Math.min(255, v + 4)];
}
