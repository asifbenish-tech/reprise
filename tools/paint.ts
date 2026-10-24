// tools/paint.ts: painterly helpers on top of pixel.ts. Limited palettes, ordered dithering between bands,
// value-noise textures and light pools: the technique of 1990 pixel backgrounds (GDD 7, 7.8), drawn from code.
import { Img, hex, mix } from "./pixel";

export const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export const dither = (x: number, y: number) => (BAYER8[y & 7][x & 7] + 0.5) / 64;

/** Picks a palette colour for t in 0..1, dithering between neighbouring bands. */
export function band(pal: string[], t: number, x: number, y: number): string {
  const v = Math.max(0, Math.min(1, t)) * (pal.length - 1);
  const i = Math.floor(v);
  return pal[Math.min(pal.length - 1, i + (v - i > dither(x, y) ? 1 : 0))];
}

// ---- seeded value noise -----------------------------------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    v += amp * noise(x * f, y * f, seed + o * 17);
    f *= 2;
    amp *= 0.5;
  }
  return v / (1 - Math.pow(0.5, octaves));
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ---- fills -------------------------------------------------------------------------------------------------

/** A vertical gradient through a palette, dithered (skies, walls, floors). */
export function vgrad(img: Img, x: number, y: number, w: number, h: number, pal: string[], mask?: (px: number, py: number) => boolean): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (mask && !mask(px, py)) continue;
      img.px(px, py, hex(band(pal, j / Math.max(1, h - 1), px, py)));
    }
}

export function hgrad(img: Img, x: number, y: number, w: number, h: number, pal: string[]): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) img.px(x + i, y + j, hex(band(pal, i / Math.max(1, w - 1), x + i, y + j)));
}

/** Noise-textured fill of any shape (rock, earth, foliage, plaster): palette chosen by fbm plus a light ramp. */
export function texture(
  img: Img,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: string[],
  opts: { scale?: number; seed?: number; light?: (px: number, py: number) => number; mask?: (px: number, py: number) => boolean; contrast?: number } = {},
): void {
  const sc = opts.scale ?? 12;
  const seed = opts.seed ?? 1;
  const k = opts.contrast ?? 0.6;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (opts.mask && !opts.mask(px, py)) continue;
      const n = fbm(px / sc, py / sc, seed);
      const l = opts.light ? opts.light(px, py) : 0.5;
      img.px(px, py, hex(band(pal, l * (1 - k) + n * k, px, py)));
    }
}

/** A pool of light (or shadow) laid over what is there: dithered falloff, no new colours beyond `c`. */
export function glow(img: Img, cx: number, cy: number, rx: number, ry: number, c: string, strength = 0.6): void {
  const col = hex(c);
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      const a = (1 - d) * (1 - d) * strength;
      if (a > dither(x, y)) img.px(x, y, col);
    }
}

/** Blends towards a colour with a real alpha (soft light): used sparingly for haze and glints. */
export function tint(img: Img, x: number, y: number, w: number, h: number, c: string, alpha: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (img.get(Math.min(img.w - 1, Math.max(0, x + i)), Math.min(img.h - 1, Math.max(0, y + j)))[3]) img.px(x + i, y + j, hex(c, Math.round(alpha * 255)));
}

export function stars(img: Img, n: number, seed: number, h = img.h, colors = ["#ffffff", "#c8d4ff", "#ffe8c0"]): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * img.w);
    const y = Math.floor(r() * h * r());
    const c = colors[Math.floor(r() * colors.length)];
    img.px(x, y, hex(c, 120 + Math.floor(r() * 135)));
    if (r() < 0.06) {
      img.px(x - 1, y, hex(c, 90));
      img.px(x + 1, y, hex(c, 90));
      img.px(x, y - 1, hex(c, 90));
      img.px(x, y + 1, hex(c, 90));
    }
  }
}

/** Soft cloud bands: fbm thresholded and dithered into two tones. */
export function clouds(img: Img, x: number, y: number, w: number, h: number, light: string, dark: string, seed: number, density = 0.55): void {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      const edge = Math.sin((j / h) * Math.PI);
      const n = fbm(px / 40, py / 9, seed) * edge;
      if (n > density + dither(px, py) * 0.12) img.px(px, py, hex(n > density + 0.1 ? light : dark));
    }
}

// ---- things ------------------------------------------------------------------------------------------------

/** A clump of leaves: noise-shaped blob lit from the upper left. */
export function foliage(img: Img, cx: number, cy: number, rx: number, ry: number, pal: string[], seed: number): void {
  for (let y = Math.floor(cy - ry - 4); y <= cy + ry + 4; y++)
    for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.hypot(dx, dy) + (fbm(x / 6, y / 6, seed) - 0.5) * 0.7;
      if (d > 1) continue;
      const lightness = 0.55 - dx * 0.25 - dy * 0.35 + (fbm(x / 3, y / 3, seed + 9) - 0.5) * 0.6;
      img.px(x, y, hex(band(pal, lightness, x, y)));
    }
}

/** A gnarled branch: recursive tapering limbs. */
export function branch(img: Img, x: number, y: number, angle: number, len: number, width: number, c: string, seed: number, depth = 5): void {
  const r = rng(seed);
  const steps = Math.max(2, Math.floor(len / 3));
  let px = x;
  let py = y;
  let a = angle;
  for (let s = 0; s < steps; s++) {
    a += (r() - 0.5) * 0.35;
    const nx = px + Math.cos(a) * (len / steps);
    const ny = py + Math.sin(a) * (len / steps);
    const w = Math.max(1, width * (1 - s / steps / 1.5));
    for (let k = 0; k <= 3; k++) img.ellipse(px + ((nx - px) * k) / 3, py + ((ny - py) * k) / 3, w / 2, w / 2, c);
    px = nx;
    py = ny;
  }
  if (depth <= 0 || width < 1.2) return;
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) branch(img, px, py, a + (r() - 0.5) * 1.4, len * (0.55 + r() * 0.2), width * 0.62, c, seed * 31 + i + 7, depth - 1);
}

/** A boulder or outcrop: rounded mass, noise texture, light from above-left, dark base. */
export function rock(img: Img, pts: [number, number][], pal: string[], seed: number): void {
  const mask = new Img(img.w, img.h);
  mask.poly(pts, "#ffffff");
  const ys = pts.map((p) => p[1]);
  const xs = pts.map((p) => p[0]);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  texture(img, Math.floor(left), Math.floor(top), Math.ceil(right - left) + 1, Math.ceil(bottom - top) + 1, pal, {
    scale: 9,
    seed,
    contrast: 0.55,
    mask: (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && mask.get(x, y)[3] > 0,
    light: (x, y) => {
      const above = y - 3 >= 0 && mask.get(x, y - 3)[3] === 0 ? 0.35 : 0;
      return 0.75 - ((y - top) / Math.max(1, bottom - top)) * 0.6 + above;
    },
  });
}

export function bricks(img: Img, x: number, y: number, w: number, h: number, base: string, mortar: string, seed: number, bw = 12, bh = 5): void {
  const r = rng(seed);
  img.rect(x, y, w, h, mortar);
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let bx = -off; bx < w; bx += bw) {
      const c = mix(base, r() < 0.5 ? "#000000" : "#ffffff", r() * 0.12);
      img.rect(Math.max(x, x + bx + 1), y + row * bh + 1, Math.min(bw - 1, w - bx - 1), bh - 1, c);
    }
  }
}

export function planks(img: Img, x: number, y: number, w: number, h: number, pal: string[], seed: number, vertical = false): void {
  const r = rng(seed);
  const size = 7;
  for (let k = 0; k * size < (vertical ? w : h); k++) {
    const t = 0.3 + r() * 0.4;
    for (let j = 0; j < (vertical ? h : size); j++)
      for (let i = 0; i < (vertical ? size : w); i++) {
        const px = vertical ? x + k * size + i : x + i;
        const py = vertical ? y + j : y + k * size + j;
        if (px >= x + w || py >= y + h) continue;
        const grain = fbm((vertical ? py : px) / 14, (vertical ? px : py) / 2, seed + k) - 0.5;
        const edge = (vertical ? i : j) === 0 ? -0.35 : 0;
        img.px(px, py, hex(band(pal, t + grain * 0.5 + edge, px, py)));
      }
  }
}

/** Floor tiles in perspective: rows get taller toward the viewer. */
export function tiles(img: Img, y0: number, y1: number, pal: string[], vanishX: number, seed: number): void {
  const r = rng(seed);
  let y = y0;
  let rowH = 4;
  let row = 0;
  while (y < y1) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    for (let j = 0; j < rowH && y + j < y1; j++)
      for (let x = 0; x < img.w; x++) {
        const spread = 18 + t * 40;
        const u = (x - vanishX) / spread;
        const line = Math.abs(u - Math.round(u)) < 0.04 || j === 0;
        const lightness = 0.35 + t * 0.4 + ((Math.floor(u) + row) % 2 ? 0.08 : -0.04) + (line ? -0.25 : 0) + (r() - 0.5) * 0.04;
        img.px(x, y + j, hex(band(pal, lightness, x, y + j)));
      }
    y += rowH;
    rowH = Math.round(rowH * 1.25 + 1);
    row++;
  }
}

/** City skyline: towers with lit windows, fading into the sky with distance. */
export function skyline(img: Img, base: number, pal: string[], seed: number, opts: { maxH?: number; windows?: string; minW?: number; spireAt?: number; spireColor?: string } = {}): void {
  const r = rng(seed);
  let x = -10;
  while (x < img.w) {
    const w = (opts.minW ?? 14) + Math.floor(r() * 30);
    const h = 26 + Math.floor(r() * (opts.maxH ?? 110));
    const body = band(pal, r() * 0.6 + 0.2, x, base);
    img.rect(x, base - h, w, h, body);
    img.rect(x + w - 3, base - h, 3, h, mix(body, "#000000", 0.25));
    if (r() < 0.35) img.rect(x + 2, base - h - 4, w - 4, 4, body);
    if (r() < 0.25) img.rect(x + Math.floor(w / 2) - 1, base - h - 14, 2, 10, body);
    if (opts.windows)
      for (let wy = base - h + 5; wy < base - 3; wy += 6)
        for (let wx = x + 3; wx < x + w - 4; wx += 4) {
          if (r() >= 0.28) continue;
          img.px(wx, wy, hex(opts.windows, 200));
          img.px(wx, wy + 1, hex(opts.windows, 140));
        }
    x += w + Math.floor(r() * 3);
  }
  if (opts.spireAt !== undefined) {
    const sx = opts.spireAt;
    const c = opts.spireColor ?? pal[0];
    img.poly([[sx - 20, base], [sx - 12, base - 180], [sx - 5, base - 236], [sx, base - 262], [sx + 5, base - 236], [sx + 12, base - 180], [sx + 20, base]], c);
    img.poly([[sx + 2, base - 230], [sx + 5, base - 236], [sx + 12, base - 180], [sx + 20, base], [sx + 8, base]], mix(c, "#000000", 0.3));
    img.rect(sx - 1, base - 290, 2, 30, c);
    glow(img, sx, base - 292, 10, 10, "#ff7ae0", 0.9);
    img.circle(sx, base - 292, 2, "#ffd0f4");
    for (let wy = base - 170; wy < base - 6; wy += 9) img.rect(sx - 8, wy, 16, 1, opts.windows ?? "#ff9ae8");
  }
}

/** A soft vertical light beam (stage lights, windows). */
export function beam(img: Img, x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, c: string, strength = 0.35): void {
  for (let y = Math.floor(y0); y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const cx = x0 + (x1 - x0) * t;
    const w = w0 + (w1 - w0) * t;
    for (let x = Math.floor(cx - w / 2); x <= cx + w / 2; x++) {
      const d = Math.abs(x - cx) / (w / 2);
      if ((1 - d) * strength * (1 - t * 0.5) > dither(x, y)) img.px(x, y, hex(c));
    }
  }
}

/** Darkens toward the edges (a painted vignette, dithered). */
export function vignette(img: Img, c = "#000000", strength = 0.5): void {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const dx = (x / img.w - 0.5) * 2;
      const dy = (y / img.h - 0.45) * 2;
      const d = Math.max(0, Math.hypot(dx * 0.8, dy) - 0.7);
      if (img.get(x, y)[3] && d * strength > dither(x, y)) img.px(x, y, hex(c));
    }
}
