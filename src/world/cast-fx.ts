// src/world/cast-fx.ts: what casting looks like (GDD 4.1, 7.5). Bobbin lifts the Distaff while notes
// sound; its tip glows in each note's colour and lights the room around it; a finished draft flares and
// sends its light to the target; a phrase that is not a draft fizzles. The Spindle's looped casts only
// pulse at their target, so a loop never makes Bobbin wave the staff every bar.
import * as Phaser from "phaser";
import { NOTE_COLORS } from "../ui/dom";
import { STAFF_TIP } from "./staff-tip";
import { ensureFxTextures } from "./fx-textures";

const SWAN_TIP: [number, number] = [6, -14];
const LIFT = 9;
const HIGH = 10;
const HOLD_MS = 1800; // the staff stays up this long after the last note
const GOLD = 0xfff0b0;

const hexNum = (c: string) => parseInt(c.replace("#", ""), 16);

export interface CastHost {
  bobbin(): Phaser.GameObjects.Sprite | null;
  walking(): boolean;
  swan(): boolean;
  lighting(): boolean;
  quiet(): boolean; // low detail or reduced motion: fewer sparks, no flare
}

export class CastFx {
  private glow: Phaser.GameObjects.Graphics;
  private light: Phaser.GameObjects.Light | null = null;
  private level = 0;
  private color = 0xffffff;
  private raisedUntil = 0;
  private raised = false;
  private flare = 0;

  constructor(private scene: Phaser.Scene, private host: CastHost) {
    ensureFxTextures(scene);
    this.glow = scene.add.graphics().setDepth(4900).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** The room was rebuilt and every light removed with it. */
  reset(): void {
    this.light = null;
    this.level = 0;
    this.flare = 0;
    this.raised = false;
    this.glow.clear();
  }

  tip(): [number, number] | null {
    const b = this.host.bobbin();
    if (!b || !b.visible) return null;
    if (this.host.swan()) return [b.x + (b.flipX ? -SWAN_TIP[0] : SWAN_TIP[0]), b.y + SWAN_TIP[1]];
    const f = Number(b.frame.name);
    const [dx, dy] = STAFF_TIP[f === LIFT || f === HIGH ? f : 0];
    return [b.x + (b.flipX ? -dx : dx), b.y + dy];
  }

  private lift(): void {
    const b = this.host.bobbin();
    if (!b || this.host.swan() || this.host.walking()) return;
    this.raisedUntil = performance.now() + HOLD_MS;
    if (this.raised) return;
    this.raised = true;
    b.anims.stop();
    b.setFrame(LIFT);
    this.scene.time.delayedCall(90, () => {
      if (this.raised && !this.host.walking()) b.setFrame(HIGH);
    });
  }

  lower(): void {
    if (!this.raised) return;
    this.raised = false;
    const b = this.host.bobbin();
    if (!b || this.host.swan() || this.host.walking()) return;
    b.setFrame(LIFT);
    this.scene.time.delayedCall(90, () => {
      if (!this.raised && !this.host.walking() && !this.host.swan()) b.setFrame(0);
    });
  }

  /** The walk animation took over the sprite. */
  walked(): void {
    this.raised = false;
  }

  note(n: number, cracked: boolean): void {
    const p0 = this.tip();
    if (cracked) {
      if (p0) this.sparks(p0[0], p0[1], 0x6a6a74, this.host.quiet() ? 2 : 4, 10, 0.4, true);
      return;
    }
    this.lift();
    this.color = hexNum(NOTE_COLORS[n] ?? "#ffffff");
    this.level = 1;
    const p = this.tip();
    if (p) this.sparks(p[0], p[1], this.color, this.host.quiet() ? 3 : 7, 22, 0.9, false);
  }

  /** A finished draft: the tip flares and the light travels to the target. */
  cast(target: [number, number] | null, fromLoop: boolean): void {
    if (fromLoop) {
      if (target) this.burst(target[0], target[1], 0xd8ccff, this.host.quiet() ? 4 : 8, 14);
      return;
    }
    const p = this.tip();
    this.color = GOLD;
    this.level = 1.5;
    this.flare = this.host.quiet() ? 0 : 1;
    this.raisedUntil = performance.now() + 700;
    if (!p) return;
    const to = target ?? [p[0], p[1] - 30];
    const n = this.host.quiet() ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.image(p[0], p[1], "fx_spark").setTint(i % 3 ? GOLD : 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(4950);
      const bend = (Math.random() - 0.5) * 40;
      const mid: [number, number] = [(p[0] + to[0]) / 2 + bend, Math.min(p[1], to[1]) - 20 - Math.random() * 20];
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(p[0], p[1]), new Phaser.Math.Vector2(mid[0], mid[1]), new Phaser.Math.Vector2(to[0], to[1]));
      const tw = { t: 0 };
      this.scene.tweens.add({
        targets: tw,
        t: 1,
        delay: i * 22,
        duration: 420,
        ease: "Sine.easeIn",
        onUpdate: () => {
          const v = curve.getPoint(tw.t);
          s.setPosition(v.x, v.y);
        },
        onComplete: () => s.destroy(),
      });
    }
    this.scene.time.delayedCall(n * 22 + 380, () => {
      this.burst(to[0], to[1], GOLD, this.host.quiet() ? 8 : 20, 30);
      this.pulseLight(to[0], to[1], GOLD);
    });
  }

  fail(): void {
    const p = this.tip();
    this.level = Math.min(this.level, 0.5);
    this.color = 0x8a8494;
    this.raisedUntil = performance.now() + 300;
    if (p) this.sparks(p[0], p[1], 0x8a8494, this.host.quiet() ? 3 : 8, 12, 0.6, true);
  }

  private sparks(x: number, y: number, color: number, n: number, spread: number, life: number, fall: boolean): void {
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.image(x, y, "fx_spark").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4950).setScale(Math.random() < 0.3 ? 1 : 0.6);
      const a = fall ? Math.PI / 2 + (Math.random() - 0.5) * 1.6 : -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const d = spread * (0.4 + Math.random() * 0.6);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d - (fall ? 0 : 6),
        alpha: 0,
        duration: life * 1000 * (0.6 + Math.random() * 0.5),
        ease: "Quad.easeOut",
        onComplete: () => s.destroy(),
      });
    }
  }

  private burst(x: number, y: number, color: number, n: number, r: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const s = this.scene.add.image(x, y, "fx_spark").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(4950);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * r * (0.6 + Math.random() * 0.5),
        y: y + Math.sin(a) * r * (0.6 + Math.random() * 0.5),
        alpha: 0,
        scale: 0.5,
        duration: 500 + Math.random() * 300,
        ease: "Cubic.easeOut",
        onComplete: () => s.destroy(),
      });
    }
    const ring = this.scene.add.graphics().setDepth(4940).setBlendMode(Phaser.BlendModes.ADD);
    const k = { r: 2 };
    this.scene.tweens.add({
      targets: k,
      r,
      duration: 450,
      ease: "Quad.easeOut",
      onUpdate: (tw) => {
        ring.clear();
        ring.lineStyle(2, color, 1 - tw.progress);
        ring.strokeCircle(x, y, k.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  private pulseLight(x: number, y: number, color: number): void {
    if (!this.host.lighting()) return;
    const l = this.scene.lights.addLight(x, y, 90, color, 2.2);
    const k = { i: 2.2 };
    this.scene.tweens.add({
      targets: k,
      i: 0,
      duration: 700,
      onUpdate: () => l.setIntensity(k.i),
      onComplete: () => this.scene.lights.removeLight(l),
    });
  }

  update(delta: number): void {
    const now = performance.now();
    if (this.raised && now > this.raisedUntil) this.lower();
    this.level = Math.max(0, this.level - delta / (this.raised ? 1400 : 500));
    this.flare = Math.max(0, this.flare - delta / 650);
    this.glow.clear();
    const p = this.tip();
    if (!p || this.level <= 0) {
      if (this.light) {
        this.scene.lights.removeLight(this.light);
        this.light = null;
      }
      return;
    }
    const [x, y] = p;
    const lv = Math.min(1, this.level);
    const flick = 0.85 + Math.sin(now / 45) * 0.08 + Math.sin(now / 17) * 0.05;
    // soft halo in rings, a white-hot core, a slow four-point star
    for (let r = 4; r >= 1; r--) {
      this.glow.fillStyle(this.color, 0.16 * lv * flick);
      this.glow.fillCircle(x, y, (4 + r * 6) * lv);
    }
    this.glow.fillStyle(0xffffff, 0.9 * lv);
    this.glow.fillCircle(x, y, 1.5 + lv);
    const arm = (5 + 7 * lv) * flick + this.flare * 30;
    const a = now / 900;
    this.glow.lineStyle(1, this.color, 0.7 * lv);
    for (let k = 0; k < 2; k++) {
      const t = a + (k * Math.PI) / 2;
      this.glow.lineBetween(x - Math.cos(t) * arm, y - Math.sin(t) * arm, x + Math.cos(t) * arm, y + Math.sin(t) * arm);
    }
    if (this.flare > 0) {
      // a lens streak across the scene's width
      this.glow.lineStyle(1, 0xffffff, 0.8 * this.flare);
      this.glow.lineBetween(x - 90 * this.flare, y, x + 90 * this.flare, y);
      this.glow.fillStyle(GOLD, 0.25 * this.flare);
      this.glow.fillCircle(x, y, 26 * this.flare);
    }
    if (this.host.lighting()) {
      if (!this.light) this.light = this.scene.lights.addLight(x, y, 120, this.color, 0);
      this.light.setPosition(x, y);
      this.light.setColor(this.color);
      this.light.setRadius(90 + 90 * lv);
      this.light.setIntensity(2.6 * lv * flick + this.flare * 2);
    }
  }
}
