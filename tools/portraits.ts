// tools/portraits.ts: close-ups for conversations. The whole scene area (640x296) becomes one painted
// close-up: a dithered colour field, the speaker's head and shoulders large on the right, room for text on
// the left (GDD 4.1, 7.6). Volumes are lit from the upper left with a coloured rim from the field on the
// right, and every tone comes from a short hue-shifted ramp, so the result stays pixel art.
import { Img, hex, mix } from "./pixel";
import { band, dither, fbm, glow, noise } from "./paint";

export const CLOSEUP_W = 640;
export const CLOSEUP_H = 296;

type HairStyle = "short" | "long" | "bun" | "ponytail" | "puffs" | "bob" | "bald";
type Collar = "v" | "round" | "high" | "jacket";

interface Bust {
  field: [string, string, string]; // background, dark to light
  body: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes?: string;
  headphones?: "on" | "neck";
  accent?: string;
  collar?: Collar;
  /** -1 worried .. 1 stern */
  brow?: number;
  /** -1 frown .. 1 smile */
  smile?: number;
  /** 0 open .. 0.6 heavy lids */
  lids?: number;
  stubble?: boolean;
  glasses?: boolean;
  hologram?: boolean;
}

const OUTLINE = "#120a18";
const L = (() => {
  const v = [-0.5, -0.55, 0.67];
  const m = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / m);
})();

/** Six tones from deep violet-shifted shadow to warm highlight. */
function ramp(c: string): string[] {
  return [mix(mix(c, "#1a0a2a", 0.6), "#000000", 0.1), mix(c, "#2a1238", 0.42), mix(c, "#3a1a40", 0.2), c, mix(c, "#fff2dc", 0.22), mix(c, "#fffaf2", 0.45)];
}

/** Lambert light and a rim term for a surface normal. */
function light(nx: number, ny: number): { lam: number; rim: number } {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
  const rim = nx > 0 ? Math.pow(1 - nz, 2) * nx : 0;
  return { lam, rim };
}

const soft = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.max(0, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Paints one lit pixel: a ramp tone, then the rim colour where the edge turns away from us. */
function lit(img: Img, x: number, y: number, pal: string[], t: number, rim: number, rimC: string): void {
  const c = band(pal, t, x, y);
  img.px(x, y, hex(rim * 1.6 > dither(x, y) + 0.25 ? mix(c, rimC, 0.55) : c));
}

function field(img: Img, f: [string, string, string], cx: number): void {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const n = fbm(x / 90, y / 70, 3) * 0.45;
      const t = 0.2 + n + (x / img.w) * 0.25 - (y / img.h) * 0.12;
      img.px(x, y, hex(band(f, t, x, y)));
    }
  glow(img, cx - 30, 120, 230, 190, mix(f[2], "#ffffff", 0.15), 0.45);
  // a soft painted vignette along the left and bottom so the text sits on calm colour
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const d = Math.max(0, Math.hypot((x / img.w - 0.62) * 1.3, (y / img.h - 0.4) * 1.1) - 0.55);
      if (d * 1.4 > dither(x, y)) img.px(x, y, hex(f[0]));
    }
}

// ---- the head --------------------------------------------------------------------------------------

interface Head {
  cx: number;
  hy: number;
  rx: number;
  ry: number;
}

/** Half-width of the face at row y (an egg that narrows to the chin), or -1 outside. */
function faceHalf(h: Head, y: number): number {
  const dy = (y - h.hy) / h.ry;
  if (dy < -1 || dy > 1) return -1;
  // a rounder, squarer jaw below the cheekbones, tapering only near the chin
  let w = dy < 0 ? Math.sqrt(1 - dy * dy) : Math.pow(1 - Math.pow(dy, 2.6), 1 / 2.6);
  if (dy > 0.3) w *= 1 - (dy - 0.3) * 0.38;
  return h.rx * w;
}

function faceNormal(h: Head, x: number, y: number): [number, number] {
  const dy = (y - h.hy) / h.ry;
  const half = Math.max(1, faceHalf(h, y));
  const nx = ((x - h.cx) / half) * Math.sqrt(Math.max(0, 1 - dy * dy)) * 0.95;
  return [nx, dy * 0.85];
}

function face(img: Img, h: Head, b: Bust, rimC: string): void {
  const skin = ramp(b.skin);
  const { cx, hy } = h;
  const smile = b.smile ?? 0;
  for (let y = Math.floor(hy - h.ry); y <= hy + h.ry; y++) {
    const half = faceHalf(h, y);
    if (half < 0) continue;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const [nx, ny] = faceNormal(h, x, y);
      const { lam, rim } = light(nx, ny);
      let t = 0.1 + lam * 0.85;
      // relief: brow ridge and sockets, cheekbones, the nose's shadow side, under the nose and lip, chin
      t -= soft(x, y, cx - 24, hy - 4, 20, 13) * 0.22 + soft(x, y, cx + 24, hy - 4, 20, 13) * 0.26;
      t += soft(x, y, cx - 28, hy + 18, 22, 12) * 0.12;
      if (y > hy - 6 && y < hy + 32) {
        // the nose: a thin bridge widening to the wings, lit on the left, shadowed on the right
        const u = (y - (hy - 6)) / 32;
        const nw = 2 + u * u * 8;
        const k = smooth(u * 3) * (1 - smooth((y - (hy + 27)) / 5));
        if (x > cx + 1 && x < cx + 1 + nw) t -= k * (0.12 + u * 0.18) * (1 - (x - cx - 1) / nw);
        if (x >= cx - nw && x <= cx + 1) t += k * 0.08;
      }
      t -= soft(x, y, cx + 2, hy + 36, 14, 4) * 0.3;
      t -= soft(x, y, cx, hy + 58, 14, 5) * 0.25;
      t += soft(x, y, cx - 4, hy + 68, 14, 8) * 0.1;
      lit(img, x, y, skin, t, rim, rimC);
      if (b.stubble && y > hy + 30 && noise(x, y, 7) > 0.55 && dither(x, y) < 0.5) img.px(x, y, hex(mix(b.hair, skin[1], 0.4)));
    }
  }
  // blush
  for (const bx of [cx - 32, cx + 32]) glow(img, bx, hy + 24, 13, 7, mix(b.skin, "#d06058", 0.22), 0.22);
  // ears
  for (const side of [-1, 1]) {
    const ex = cx + side * (h.rx - 1);
    for (let y = hy - 12; y <= hy + 22; y++)
      for (let x = ex - 10; x <= ex + 10; x++) {
        const d = Math.hypot((x - ex) / 9, (y - hy - 5) / 17);
        if (d > 1 || (side < 0 ? x > ex + 2 : x < ex - 2)) continue;
        const t = (side < 0 ? 0.62 : 0.32) - d * 0.25 - (Math.abs(x - ex) < 4 && d < 0.6 ? 0.18 : 0);
        img.px(x, y, hex(band(skin, t, x, y)));
      }
  }
  // eyes
  const lids = b.lids ?? 0;
  const brow = b.brow ?? 0;
  for (const side of [-1, 1]) {
    const ex = cx + side * 24;
    const ey = hy - 3;
    for (let y = ey - 6; y <= ey + 6; y++)
      for (let x = ex - 11; x <= ex + 11; x++) {
        const u = (x - ex) / 11;
        const top = ey - 5 * (1 - u * u) * (1 - lids) - 0.5;
        const bot = ey + 3.5 * (1 - u * u);
        if (y < top || y > bot) continue;
        img.px(x, y, hex(x * side > ex * side + 3 || y > ey + 2 ? "#cfc4c4" : "#f4eeea"));
      }
    for (let y = ey - 6; y <= ey + 6; y++)
      for (let x = ex - 6; x <= ex + 6; x++) {
        const d = Math.hypot(x - ex - 1, y - ey);
        const u = (x - ex) / 11;
        if (d > 5.2 || y < ey - 5 * (1 - u * u) * (1 - lids) || y > ey + 3.5 * (1 - u * u)) continue;
        const c = b.eyes ?? "#5a3a24";
        img.px(x, y, hex(d < 2.5 ? "#0c0808" : y < ey - 1 ? mix(c, "#000000", 0.35) : d > 4.2 ? mix(c, "#000000", 0.2) : c));
      }
    img.px(ex - 1, ey - 2, hex("#ffffff"));
    img.px(ex, ey - 2, hex("#ffffff"));
    // upper lid and lashes, a line under the lid, the lower lid
    for (let x = ex - 12; x <= ex + 12; x++) {
      const u = (x - ex) / 11;
      const yy = ey - 5 * (1 - Math.min(1, u * u)) * (1 - lids) - 1;
      img.px(x, yy, hex("#1a0e10"));
      if (Math.abs(u) < 0.95) img.px(x, yy - 1, hex(OUTLINE));
      if (Math.abs(u) < 0.8) img.px(x, yy - 4, hex(band(skin, 0.3, x, yy)));
      if (Math.abs(u) < 0.85) img.px(x, ey + 4 + 3.5 * (1 - u * u) * 0.25, hex(band(skin, 0.35, x, ey)));
    }
    img.px(ex + side * 12, ey - 2, hex("#1a0e10"));
    // brow: a tapered stroke, inner end lowered when stern
    for (let k = 0; k <= 22; k++) {
      const u = k / 22;
      const x = ex - side * 10 + side * k;
      const y = ey - 15 - Math.sin(u * Math.PI) * 3 + (1 - u) * brow * 4 - u * brow * 1.5;
      const th = 4 - u * 2;
      for (let j = 0; j < th; j++) img.px(x, y + j, hex(j === 0 ? mix(b.hair, "#000000", 0.2) : mix(b.hair, "#000000", 0.45)));
    }
  }
  // nose: nostrils and a tip highlight
  img.px(cx - 6, hy + 30, hex(skin[0]));
  img.px(cx - 5, hy + 30, hex(skin[0]));
  img.px(cx + 6, hy + 30, hex(skin[0]));
  img.px(cx + 7, hy + 30, hex(skin[0]));
  img.px(cx - 2, hy + 25, hex(skin[5]));
  img.px(cx - 1, hy + 25, hex(skin[5]));
  // mouth: upper lip line, lower lip with a highlight
  const lip = mix(b.skin, "#b04050", 0.35);
  for (let x = cx - 14; x <= cx + 14; x++) {
    const u = (x - cx) / 14;
    const my = hy + 47 - smile * 4 * u * u + (smile < 0 ? -smile * 2 : 0);
    img.px(x, my, hex(Math.abs(u) > 0.85 ? skin[1] : "#3a1418"));
    if (Math.abs(u) < 0.8) {
      img.px(x, my - 1, hex(mix(lip, "#000000", 0.25)));
      img.px(x, my + 1, hex(lip));
      img.px(x, my + 2, hex(Math.abs(u) < 0.4 && x < cx ? mix(lip, "#ffffff", 0.3) : lip));
      if (Math.abs(u) < 0.6) img.px(x, my + 3, hex(mix(lip, "#000000", 0.15)));
    }
  }
  if (b.glasses)
    for (const side of [-1, 1]) {
      const ex = cx + side * 24;
      for (let a = 0; a < 80; a++) {
        const t = (a / 80) * Math.PI * 2;
        img.px(ex + Math.cos(t) * 15, hy - 2 + Math.sin(t) * 10, hex("#1a1418"));
      }
      for (let x = cx - 9; x <= cx + 9; x++) img.px(x, hy - 6, hex("#1a1418"));
      glow(img, ex - 6, hy - 7, 7, 3, "#ffffff", 0.5);
    }
}

// ---- hair -------------------------------------------------------------------------------------------

function hairLine(h: Head, style: HairStyle, x: number): number {
  const dx = x - h.cx;
  const edge = Math.abs(dx) > h.rx - 12;
  switch (style) {
    case "bob":
      return edge ? h.hy + 52 : h.hy - 30 + (Math.floor(x / 5) % 2) * 2;
    case "long":
      return edge ? h.hy + 64 : h.hy - 46 + Math.abs(dx) * 0.42;
    case "bun":
    case "ponytail":
    case "puffs":
      return h.hy - 40 + (dx / h.rx) ** 2 * 18;
    default:
      return Math.abs(dx) > h.rx - 6 ? h.hy - 16 : h.hy - 38 + Math.sin(dx / 7) * 3 + (noise(x, 0, 3) - 0.5) * 6 + (dx / h.rx) ** 2 * 10;
  }
}

function hairPixel(img: Img, x: number, y: number, pal: string[], nx: number, ny: number, curly: boolean, rimC: string, seed: number): void {
  const { lam, rim } = light(nx, ny);
  const strand = curly ? fbm(x / 3, y / 3, seed, 2) : fbm(x / 2.6, y / 14, seed, 3);
  let t = 0.1 + lam * 0.8 + (strand - 0.5) * (curly ? 0.32 : 0.4);
  if (lam > 0.72 && lam < 0.86 && strand > 0.48) t += 0.25; // sheen
  lit(img, x, y, pal, t, rim, rimC);
}

function hairBack(img: Img, h: Head, b: Bust, rimC: string): void {
  const pal = ramp(b.hair);
  const { cx, hy, rx } = h;
  const blob = (bx: number, by: number, brx: number, bry: number, curly: boolean, seed: number) => {
    for (let y = Math.floor(by - bry); y <= by + bry; y++)
      for (let x = Math.floor(bx - brx); x <= bx + brx; x++) {
        const nx = (x - bx) / brx;
        const ny = (y - by) / bry;
        if (nx * nx + ny * ny > 1 - (curly ? (noise(x >> 2, y >> 2, seed) - 0.5) * 0.25 : 0)) continue;
        hairPixel(img, x, y, pal, nx * 0.95, ny * 0.95, curly, rimC, seed);
      }
  };
  if (b.hairStyle === "long") {
    const top = hy - h.ry - 10;
    for (let y = top; y < 290; y++) {
      const r = rx + 16;
      const half = Math.max(1, y < hy ? r * Math.sqrt(Math.max(0, 1 - ((y - hy) / (hy - top)) ** 2)) : r + (y - hy) * 0.16);
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const strandEnd = 270 + noise(x >> 1, 0, 9) * 20;
        if (y > strandEnd) continue;
        hairPixel(img, x, y, pal, ((x - cx) / half) * 0.95, Math.max(-0.9, (y - hy) / 220), false, rimC, 4);
      }
    }
  }
  if (b.hairStyle === "bob") blob(cx, hy + 4, rx + 14, h.ry * 0.78, false, 5);
  if (b.hairStyle === "puffs") {
    blob(cx - rx - 6, hy - 58, 36, 34, true, 6);
    blob(cx + rx + 6, hy - 58, 36, 34, true, 7);
  }
  if (b.hairStyle === "bun") blob(cx + 4, hy - h.ry - 10, 30, 24, false, 8);
  if (b.hairStyle === "ponytail")
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      blob(cx + rx + 6 + Math.sin(u * 2.4) * 22, hy - 40 + u * 120, 15 - u * 6, 15 - u * 6, false, 9);
    }
}

function hairFront(img: Img, h: Head, b: Bust, rimC: string): void {
  if (b.hairStyle === "bald") {
    glow(img, h.cx - 20, h.hy - 56, 16, 8, "#ffffff", 0.3);
    return;
  }
  const pal = ramp(b.hair);
  const crx = h.rx + 7;
  const cry = h.ry + 9;
  const cy = h.hy - 3;
  const curly = b.hairStyle === "puffs";
  for (let y = Math.floor(cy - cry); y <= h.hy + 70; y++)
    for (let x = Math.floor(h.cx - crx - 2); x <= h.cx + crx + 2; x++) {
      const nx = (x - h.cx) / crx;
      const ny = (y - cy) / cry;
      if (nx * nx + ny * ny > 1) continue;
      if (y > hairLine(h, b.hairStyle, x)) continue;
      // sides only frame the face: they never cover the cheeks inside the eyes
      if (y > h.hy - 20 && Math.abs(x - h.cx) < h.rx - 12) continue;
      hairPixel(img, x, y, pal, nx, ny, curly, rimC, 11);
    }
}

// ---- neck, shoulders, headphones -------------------------------------------------------------------

function shoulders(img: Img, h: Head, b: Bust, rimC: string): void {
  const { cx, hy } = h;
  const skin = ramp(b.skin);
  const cloth = ramp(b.body);
  const chin = hy + h.ry;
  // neck: a shaded cylinder in the jaw's shadow
  for (let y = hy + 40; y < 250; y++)
    for (let x = cx - 25; x <= cx + 25; x++) {
      const { lam } = light((x - cx) / 26, 0.1);
      const shade = y < chin + 16 ? 0.28 : 0;
      img.px(x, y, hex(band(skin, 0.05 + lam * 0.55 - shade, x, y)));
    }
  const collar = b.collar ?? "round";
  const top = (x: number) => {
    const d = Math.abs(x - cx);
    return 218 + 0.2 * Math.max(0, d - 30) + 28 * Math.max(0, (d - 125) / 55) ** 2;
  };
  for (let y = 214; y < img.h; y++)
    for (let x = cx - 180; x <= cx + 180; x++) {
      if (y < top(x)) continue;
      const d = x - cx;
      // the neckline shows skin
      if (collar === "v" && Math.abs(d) < 26 - (y - 222) * 0.55 && y < 262) continue;
      if (collar === "round" && Math.hypot(d / 28, (y - 218) / 18) < 1) continue;
      if (collar === "jacket" && Math.abs(d) < 20 - (y - 222) * 0.3 && y < 290) {
        img.px(x, y, hex(band(ramp(b.accent ?? "#e8e4ea"), 0.6 - Math.abs(d) / 60, x, y)));
        continue;
      }
      const nx = d / 190;
      const ny = -0.55 + (y - top(x)) / 160;
      const { lam, rim } = light(nx, ny);
      const fold = Math.sin(d * 0.07 + fbm(x / 30, y / 20, 13) * 5) * 0.06;
      let t = 0.1 + lam * 0.8 + fold;
      if (collar === "jacket") {
        const lapel = Math.abs(d) < 46 - (y - 222) * 0.2 && Math.abs(d) > 18 - (y - 222) * 0.3;
        if (lapel) t += d < 0 ? 0.12 : -0.16;
      }
      lit(img, x, y, cloth, t, rim, rimC);
    }
  if (collar === "high")
    for (let y = 200; y < 232; y++) for (let x = cx - 30; x <= cx + 30; x++) {
      const { lam, rim } = light((x - cx) / 31, 0);
      lit(img, x, y, cloth, 0.12 + lam * 0.7, rim, rimC);
    }
  if (b.accent) {
    const ac = b.accent;
    if (collar === "v")
      for (let y = 222; y < 262; y++) {
        const w = 26 - (y - 222) * 0.55;
        img.px(cx - w, y, hex(ac));
        img.px(cx + w, y, hex(mix(ac, "#000000", 0.3)));
      }
    else if (collar === "round")
      for (let a = 0; a <= 60; a++) {
        const t = (a / 60) * Math.PI;
        img.px(cx + Math.cos(t) * 29, 218 + Math.sin(t) * 19, hex(a < 30 ? ac : mix(ac, "#000000", 0.3)));
        img.px(cx + Math.cos(t) * 30, 219 + Math.sin(t) * 19, hex(mix(ac, "#000000", 0.2)));
      }
    else if (collar === "high") for (let x = cx - 30; x <= cx + 30; x++) img.px(x, 201, hex(ac));
  }
}

function headphones(img: Img, h: Head, kind: "on" | "neck", accent: string | undefined): void {
  const metal = ["#121018", "#24222c", "#3a3644", "#56525e", "#8a8694"];
  const cup = (ex: number, ey: number, rx: number, ry: number) => {
    for (let y = Math.floor(ey - ry); y <= ey + ry; y++)
      for (let x = Math.floor(ex - rx); x <= ex + rx; x++) {
        const nx = (x - ex) / rx;
        const ny = (y - ey) / ry;
        if (nx * nx + ny * ny > 1) continue;
        img.px(x, y, hex(band(metal, 0.1 + light(nx, ny).lam * 0.9, x, y)));
      }
    if (accent) for (let a = 0; a < 40; a++) img.px(ex + Math.cos((a / 40) * Math.PI * 2) * (rx - 3), ey + Math.sin((a / 40) * Math.PI * 2) * (ry - 3), hex(accent));
  };
  if (kind === "on") {
    for (let a = 0; a <= 90; a++) {
      const t = Math.PI + (a / 90) * Math.PI;
      for (let k = 0; k < 6; k++) img.px(h.cx + Math.cos(t) * (h.rx + 9 - k * 0.3), h.hy - 6 + Math.sin(t) * (h.ry + 14) + k, hex(band(metal, 0.2 + k * 0.1, a, k)));
    }
    cup(h.cx - h.rx - 6, h.hy + 2, 15, 25);
    cup(h.cx + h.rx + 6, h.hy + 2, 15, 25);
  } else {
    for (let x = h.cx - 58; x <= h.cx + 58; x++) for (let k = 0; k < 6; k++) img.px(x, 222 + Math.abs(x - h.cx) * 0.12 + k, hex(metal[1 + (k >> 1)]));
    cup(h.cx - 60, 230, 15, 18);
    cup(h.cx + 60, 230, 15, 18);
  }
}

function bust(img: Img, b: Bust, cx = 468): void {
  const fig = new Img(img.w, img.h);
  const h: Head = { cx, hy: 122, rx: 60, ry: 80 };
  const rimC = mix(b.field[2], "#ffffff", 0.35);
  hairBack(fig, h, b, rimC);
  shoulders(fig, h, b, rimC);
  if (b.headphones === "neck") headphones(fig, h, "neck", b.accent);
  face(fig, h, b, rimC);
  hairFront(fig, h, b, rimC);
  if (b.headphones === "on") headphones(fig, h, "on", b.accent);
  fig.outline(OUTLINE);
  if (b.hologram) {
    // a projection: cyan, scan lines, a few rows slipped sideways, partly see-through
    const out = new Img(img.w, img.h);
    for (let y = 0; y < fig.h; y++) {
      const slip = noise(0, y >> 1, 21) > 0.93 ? Math.round((noise(1, y, 22) - 0.5) * 12) : 0;
      for (let x = 0; x < fig.w; x++) {
        const c = fig.get(Math.max(0, Math.min(fig.w - 1, x - slip)), y);
        if (!c[3]) continue;
        const l = (c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2) / 255;
        const col = band(["#0a3a6a", "#1a7ab0", "#46c8f0", "#a8f0ff", "#f0ffff"], l * 1.1 + (y % 3 === 0 ? -0.15 : 0.05), x, y);
        out.px(x, y, hex(col, y % 3 === 0 ? 150 : 225));
      }
    }
    glow(img, cx, 140, 190, 180, "#66e0ff", 0.25);
    img.blit(out, 0, 0);
    return;
  }
  img.blit(fig, 0, 0);
}

// ---- Bobbin, Skein ---------------------------------------------------------------------------------

function hooded(img: Img, cx = 466): void {
  const fig = new Img(img.w, img.h);
  const cloak = ["#1c1c28", "#30303e", "#484858", "#646476", "#868698", "#acacbc"];
  const rimC = "#d8a0f0";
  // cloak and shoulders, heavy vertical drapes
  for (let y = 150; y < img.h; y++) {
    const half = Math.min(195, 80 + (y - 150) * 1.5);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const d = x - cx;
      const drape = Math.sin(d / 13 + fbm(x / 40, y / 60, 2) * 4) * 0.12;
      const { lam, rim } = light(d / (half + 12), -0.4 + (y - 150) / 300);
      lit(fig, x, y, cloak, 0.06 + lam * 0.8 + drape, rim, rimC);
    }
  }
  // the hood: a tall rounded cowl with a lit rim around the opening
  const hcy = 128;
  for (let y = 14; y < 236; y++)
    for (let x = cx - 110; x <= cx + 110; x++) {
      const rx = 94 - Math.max(0, (y - 160) * 0.25);
      const nx = (x - cx) / rx;
      const ny = (y - hcy) / 114;
      if (nx * nx + ny * ny > 1) continue;
      const fold = Math.sin(x / 10 + y / 50) * 0.05 + (fbm(x / 22, y / 30, 4) - 0.5) * 0.18;
      const { lam, rim } = light(nx, ny);
      lit(fig, x, y, cloak, 0.08 + lam * 0.85 + fold, rim, rimC);
    }
  // the opening: the hood's inner fold lit, then darkness
  for (let y = 56; y < 214; y++)
    for (let x = cx - 70; x <= cx + 70; x++) {
      const d = Math.hypot((x - cx - 6) / 58, (y - 136) / 74);
      if (d > 1) continue;
      if (d > 0.88) fig.px(x, y, hex(band(cloak, x < cx ? 0.75 - (d - 0.88) * 3 : 0.3, x, y)));
      else fig.px(x, y, hex(d > 0.72 && dither(x, y) < (d - 0.72) * 5 ? "#14121c" : "#050408"));
    }
  fig.outline(OUTLINE);
  img.blit(fig, 0, 0);
  for (const ex of [cx - 14, cx + 28]) {
    glow(img, ex, 128, 30, 18, "#2a6aff", 0.55);
    img.ellipse(ex, 128, 10, 5, "#2a6aff");
    img.ellipse(ex, 128, 7, 3, "#9fe4ff");
    img.rect(ex - 3, 127, 5, 2, "#ffffff");
  }
}

function swanHead(img: Img, cx = 470): void {
  const fig = new Img(img.w, img.h);
  const w = ["#5a5a78", "#8a8aa4", "#b4b4c8", "#dcdcea", "#f6f6fc", "#ffffff"];
  const rimC = "#c8c8ff";
  // body and folded wing
  for (let y = 160; y < img.h; y++)
    for (let x = cx - 190; x <= cx + 60; x++) {
      const nx = (x - cx + 60) / 190;
      const ny = (y - 330) / 170;
      if (nx * nx + ny * ny > 1) continue;
      const feather = Math.sin((x - y * 0.6) / 9) * 0.06 + (fbm(x / 8, y / 8, 31) - 0.5) * 0.12;
      const { lam, rim } = light(nx, ny);
      lit(fig, x, y, w, 0.15 + lam * 0.85 + feather, rim, rimC);
    }
  // the neck, a lit tube
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    const nx0 = cx - 10 + Math.sin(u * Math.PI) * 36 + u * 20;
    const ny0 = 250 - u * 168;
    const r = 18 - u * 3;
    for (let y = Math.floor(ny0 - r); y <= ny0 + r; y++)
      for (let x = Math.floor(nx0 - r); x <= nx0 + r; x++) {
        if (Math.hypot(x - nx0, y - ny0) > r) continue;
        const { lam, rim } = light((x - nx0) / (r + 1), 0);
        lit(fig, x, y, w, 0.2 + lam * 0.8, rim, rimC);
      }
  }
  // head, beak with its black knob, eye
  for (let y = 50; y < 112; y++)
    for (let x = cx - 20; x <= cx + 70; x++) {
      const nx = (x - cx - 22) / 40;
      const ny = (y - 80) / 28;
      if (nx * nx + ny * ny > 1) continue;
      const { lam, rim } = light(nx, ny);
      lit(fig, x, y, w, 0.2 + lam * 0.8, rim, rimC);
    }
  fig.poly([[cx + 52, 70], [cx + 116, 90], [cx + 112, 96], [cx + 52, 102]], "#ff8a30");
  fig.poly([[cx + 52, 90], [cx + 112, 94], [cx + 110, 97], [cx + 52, 102]], "#c85a18");
  fig.poly([[cx + 98, 86], [cx + 116, 90], [cx + 112, 92]], "#ffc070");
  fig.poly([[cx + 40, 66], [cx + 60, 72], [cx + 60, 104], [cx + 40, 98]], "#141420");
  fig.outline(OUTLINE);
  img.blit(fig, 0, 0);
  img.circle(cx + 28, 76, 5, "#0c0c14");
  img.px(cx + 26, 74, hex("#ffffff"));
  img.px(cx + 27, 74, hex("#ffffff"));
}

const BUSTS: Record<string, Bust> = {
  receptionist: { field: ["#4a1050", "#8a2088", "#c03aa8"], body: "#e85ac8", skin: "#f0c4a4", hair: "#ffe08a", hairStyle: "bob", headphones: "on", accent: "#ffd0f0", eyes: "#3a8ac0", collar: "round", smile: 0.8, lids: 0.15 },
  lyrix: { field: ["#0a1a3a", "#103a6a", "#1a5a8a"], body: "#66e0ff", skin: "#c8f4ff", hair: "#ffffff", hairStyle: "long", accent: "#ff7ae0", eyes: "#ff7ae0", hologram: true, collar: "high", smile: 0.9 },
  lyra: { field: ["#3a1a14", "#6a3420", "#9a5a30"], body: "#c8683e", skin: "#e2b08a", hair: "#5a2c1a", hairStyle: "ponytail", eyes: "#5a3a20", collar: "v", accent: "#f0d0a0", brow: -0.4, smile: -0.2 },
  engineer: { field: ["#0a0c20", "#14204a", "#22346a"], body: "#3a5a8a", skin: "#c89a78", hair: "#8a8a8a", hairStyle: "short", headphones: "on", collar: "round", lids: 0.45, stubble: true },
  coach: { field: ["#3a1430", "#6a2450", "#9a3a6a"], body: "#9a4478", skin: "#ecc0a0", hair: "#2a1414", hairStyle: "bun", accent: "#ffd090", collar: "v", smile: 0.6, brow: -0.2 },
  marcus: { field: ["#2a1a3a", "#5a3a5a", "#9a6a6a"], body: "#3a6a9a", skin: "#7a4a30", hair: "#1a1010", hairStyle: "short", collar: "round", stubble: true, smile: 0.3, headphones: "on", accent: "#e8c040" },
  commuter: { field: ["#1a1e2a", "#2e3446", "#4a5266"], body: "#5a6272", skin: "#d8a888", hair: "#4a3424", hairStyle: "short", headphones: "on", collar: "jacket", accent: "#c8ccd8", lids: 0.3 },
  choreographer: { field: ["#1a0a20", "#3a0c30", "#6a1440"], body: "#26242e", skin: "#e0b090", hair: "#ececf4", hairStyle: "short", accent: "#ff4040", collar: "high", brow: 0.9, smile: -0.4 },
  juno: { field: ["#0e1a12", "#1a3a24", "#2a5a36"], body: "#2a7a54", skin: "#8a5a3c", hair: "#1a1010", hairStyle: "puffs", headphones: "neck", accent: "#7fe0a0", collar: "round", smile: 0.5 },
  host: { field: ["#3a2a1a", "#6a5034", "#9a7a50"], body: "#c89a58", skin: "#ecc0a0", hair: "#7a3a1e", hairStyle: "long", accent: "#ffffff", eyes: "#3a6a3a", collar: "jacket", smile: 1 },
  dominic: { field: ["#1a0e08", "#3a2014", "#5a3420"], body: "#76685a", skin: "#e0b090", hair: "#a4a4a4", hairStyle: "short", headphones: "neck", accent: "#ff9a3a", collar: "jacket", glasses: true, brow: 0.5, stubble: true },
};

export function closeup(id: string): Img {
  const img = new Img(CLOSEUP_W, CLOSEUP_H);
  if (id === "bobbin") {
    field(img, ["#2a0838", "#5a1a6a", "#8a2a98"], 466);
    hooded(img);
  } else if (id === "skein") {
    field(img, ["#141432", "#2e2e5e", "#56569a"], 470);
    swanHead(img);
  } else {
    const b = BUSTS[id];
    if (!b) throw new Error(`No close-up for ${id}`);
    field(img, b.field, 468);
    bust(img, b);
  }
  return img;
}
