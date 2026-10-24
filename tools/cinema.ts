// tools/cinema.ts: painted plates for the opening film and the title screen. The film moves sprites across
// plates and never scales them; a closer view is its own plate (GDD 7.1).
import { Img, hex, mix } from "./pixel";
import { band, clouds, dither, fbm, glow, rng, skyline, stars, vgrad } from "./paint";
import { swan } from "./figures";

const W = 640;

/** The Pattern: golden threads woven across the sky, one family rising, the other falling. */
export function patternThreads(img: Img, top: number, bottom: number, strength = 1): void {
  for (let k = 0; k < 7; k++)
    for (const dir of [1, -1])
      for (let x = 0; x < img.w; x++) {
        const y = top + ((bottom - top) * k) / 6 + Math.sin(x / 70 + k * 1.3) * 14 * dir + (x / img.w - 0.5) * 30 * dir;
        if (y < 0 || y >= img.h) continue;
        const fade = Math.sin((x / img.w) * Math.PI) * strength;
        if (fade * 0.85 > dither(x, Math.floor(y))) img.px(x, y, hex(k % 2 ? "#ffd27a" : "#ffe9b0"));
      }
}

function moon(img: Img, cx: number, cy: number, r: number, light: string[]): void {
  glow(img, cx, cy, r * 2.6, r * 2.6, light[light.length - 1], 0.35);
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1) continue;
      const crater = fbm(x / 9, y / 9, 31) > 0.62 ? -0.18 : 0;
      img.px(x, y, hex(band(light, 0.95 - d * 0.35 - ((x - cx) / r) * 0.12 + crater, x, y)));
    }
}

/** The Island at dusk, before the tear: the Weavers' tower, the moon, the Pattern in the sky. */
export function filmIsland(img: Img): void {
  vgrad(img, 0, 0, W, 210, ["#0c0a2a", "#1a1444", "#2e1e5e", "#4a2a72", "#7a3a7a", "#b05a7a", "#e08a7a"]);
  stars(img, 220, 41, 120);
  moon(img, 470, 74, 40, ["#c8b890", "#e8dcb0", "#fff4d0", "#fffaf0"]);
  patternThreads(img, 26, 150, 0.9);
  clouds(img, 0, 150, W, 34, "#d07a8a", "#8a4a7a", 44, 0.6);
  // the sea, with a road of moonlight
  vgrad(img, 0, 200, W, 96, ["#2a2a5a", "#1e2050", "#141640", "#0c0c2a"]);
  const r = rng(5);
  for (let i = 0; i < 260; i++) {
    const y = 202 + Math.floor(r() * 92);
    const spread = 18 + (y - 200) * 0.9;
    const x = 470 + (r() - 0.5) * spread * 2;
    img.line(x, y, x + 3 + r() * 6, y, r() < 0.5 ? "#fff0c0" : "#c8b8e0", 200);
  }
  // the island: cliffs, a crown of trees, the tower of the guild
  const isl: [number, number][] = [[40, 206], [70, 180], [110, 168], [150, 150], [190, 132], [226, 128], [262, 136], [300, 152], [336, 170], [372, 190], [400, 206]];
  for (let x = 40; x <= 400; x++) {
    let top = 206;
    for (let i = 0; i + 1 < isl.length; i++) {
      const [x0, y0] = isl[i];
      const [x1, y1] = isl[i + 1];
      if (x >= x0 && x <= x1) top = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) + (fbm(x / 6, 0, 3) - 0.5) * 6;
    }
    for (let y = Math.floor(top); y < 214; y++) {
      const t = 0.15 + ((400 - x) / 360) * 0.45 - (y - top) / 160 + (fbm(x / 8, y / 8, 4) - 0.5) * 0.3;
      img.px(x, y, hex(band(["#140e22", "#22183a", "#34244e", "#4a3462", "#6a4a7a"], t, x, y)));
    }
  }
  for (let x = 40; x <= 400; x++) for (let y = 214; y < 236; y++) if ((y - 214) / 22 < 1 - Math.abs(x - 220) / 200 && dither(x, y) < 0.5 - (y - 214) / 50) img.px(x, y, hex("#1a1438"));
  for (const [x, y, s] of [[120, 166, 1], [160, 150, 2], [300, 156, 3], [334, 172, 4]] as const)
    for (let k = 0; k < 3; k++) glow(img, x + k * 7 - 7, y - 4, 9, 7, k % 2 ? "#1e2a2a" : "#16201e", 1.2 + s * 0);
  // the tower: tall and narrow, a pointed roof, windows lit gold
  const tx = 226;
  for (let y = 46; y < 132; y++)
    for (let x = tx - 9; x <= tx + 9; x++) {
      const t = 0.75 - (x - (tx - 9)) / 22;
      img.px(x, y, hex(band(["#1a1230", "#2a1e46", "#3e2c5e", "#5a4278"], t, x, y)));
    }
  img.poly([[tx - 13, 48], [tx, 14], [tx + 13, 48]], "#2a1a3e");
  img.poly([[tx - 13, 48], [tx, 14], [tx - 2, 48]], "#4a2e5e");
  for (const wy of [62, 82, 102]) {
    img.rect(tx - 3, wy, 6, 9, "#ffd27a");
    glow(img, tx, wy + 4, 16, 14, "#ffc060", 0.4);
  }
  img.circle(tx, 30, 2, "#fff0c0");
  glow(img, tx, 30, 22, 22, "#ffe9b0", 0.5);
  // houses at the foot of the tower
  for (const [hx, hy] of [[176, 140], [196, 134], [256, 138], [280, 146]] as const) {
    img.rect(hx, hy, 12, 8, "#2a1e3e");
    img.poly([[hx - 2, hy], [hx + 6, hy - 6], [hx + 14, hy]], "#3a2a50");
    img.rect(hx + 4, hy + 3, 3, 3, "#ffc870");
  }
}

/** Earth from close by, at night: the day side to the upper left, city lights, one city glowing pink. */
export function filmEarth(img: Img): void {
  vgrad(img, 0, 0, W, img.h, ["#020214", "#06062a", "#0c0a3a"]);
  stars(img, 500, 77);
  const cx = 320;
  const cy = 700;
  const R = 560;
  for (let y = 120; y < img.h; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R + 10) continue;
      if (d > R) {
        if ((R + 10 - d) / 10 > dither(x, y) + 0.2) img.px(x, y, hex("#4ac0ff"));
        continue;
      }
      const nx = (x - cx) / R;
      const ny = (y - cy) / R;
      // the sun is far to the left: the terminator runs down the middle, the city side is in night
      const day = Math.max(0, Math.min(1, (330 - x) / 300 + 0.05 - (ny + 0.8) * 0.3)) * (0.5 - nx * 0.5 + 0.5) * 0.8;
      const land = fbm(x / 48, y / 22, 9) > 0.54;
      const pal = land ? ["#06100a", "#122214", "#24442a", "#3e6a3a", "#6a9a5a"] : ["#03061a", "#081440", "#122e70", "#1e54a8", "#4a8ad8"];
      img.px(x, y, hex(band(pal, day * 1.5 + 0.04, x, y)));
      // city lights on the night side's land
      if (land && day < 0.18 && fbm(x / 6, y / 4, 13) > 0.62 && dither(x, y) < 0.35) img.px(x, y, hex("#ffd27a"));
      // clouds
      if (fbm(x / 30 + 5, y / 9, 19) > 0.64 && dither(x, y) < 0.6) img.px(x, y, hex(mix("#c8d0e8", "#0a0a1a", 1 - Math.min(1, day * 2 + 0.25))));
      if (R - d < 3) img.px(x, y, hex("#6ad0ff"));
    }
  // the singing city
  glow(img, 404, 178, 46, 18, "#ff7ae0", 0.75);
  glow(img, 404, 178, 16, 7, "#ffd0f4", 0.9);
}

/** The title: a night over the city, a great moon, the Pattern faint in the sky, the Spire far off. */
export function titleSky(img: Img): void {
  vgrad(img, 0, 0, W, img.h, ["#06061e", "#0e0c34", "#1c1450", "#2e1c66", "#4a2474", "#7a3478", "#b04a78", "#e07a78"]);
  // a nebula wash, kept soft so the title stays readable
  for (let y = 0; y < 230; y++)
    for (let x = 0; x < W; x++) {
      const n = fbm(x / 140, y / 70, 61);
      if (n > 0.6 && dither(x, y) < (n - 0.6) * 2.2) img.px(x, y, hex(n > 0.7 ? "#6a3a9a" : "#3e2a7a"));
    }
  stars(img, 520, 62, 240);
  // a great moon rising behind the skyline, leaving clear sky above for the title
  moon(img, 320, 214, 78, ["#d8c8a0", "#efe2bc", "#fff6dc", "#fffcf2"]);
  patternThreads(img, 30, 200, 0.45);
  clouds(img, 0, 220, W, 40, "#e08a9a", "#9a4a8a", 66, 0.58);
  skyline(img, 300, ["#2a1a48", "#34205a", "#3e2664"], 63, { spireAt: 470, spireColor: "#22143e", windows: "#ffc870", maxH: 150 });
  skyline(img, 320, ["#140c28", "#1a1032"], 68, { maxH: 70, windows: "#ff9a6a" });
  glow(img, 470, 150, 30, 30, "#ff7ae0", 0.25);
  for (let y = 318; y < img.h; y++) for (let x = 0; x < W; x++) img.px(x, y, hex(band(["#0a0618", "#06040e"], (y - 318) / 42, x, y)));
}

/** Small, distant swans for the film's wide shots: four wingbeat frames. */
export function filmSwanSmall(img: Img, n: number): void {
  const fw = img.w / n;
  for (let i = 0; i < n; i++) swan(img, i * fw + fw / 2 - 2, 10, 0.55, i % 2 ? 1 : -1, "#f4f4fa");
  img.outline("#2a2640");
}
