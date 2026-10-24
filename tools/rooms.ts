// tools/rooms.ts: every room's layers. Drawn to the colour script (GDD 7.3) with dithered gradients,
// textures and light pools; positions come from the room JSON so art and hotspots always line up.
import { readFileSync } from "node:fs";
import { Img, hex, mix } from "./pixel";
import { beam, branch, bricks, clouds, fbm, foliage, glow, hgrad, planks, rng, skyline, stars, texture, tiles, vgrad, vignette } from "./paint";
import { lamp, metal, swan } from "./figures";

type Rect = [number, number, number, number];
interface RoomJson {
  hotspots: { id: string; rect: Rect }[];
  width: number;
}
const cache = new Map<string, RoomJson>();
function room(id: string): RoomJson {
  let r = cache.get(id);
  if (!r) cache.set(id, (r = JSON.parse(readFileSync(new URL(`../content/rooms/${id}.json`, import.meta.url), "utf8")) as RoomJson));
  return r;
}
export const rectOf = (r: string, h: string): Rect => {
  const x = room(r).hotspots.find((s) => s.id === h);
  if (!x) throw new Error(`${r}.${h}`);
  return x.rect;
};

export const FLOOR = 246; // where back walls meet the floor
const DUSK = ["#0a0a2e", "#1a1650", "#2e2470", "#4a2e86", "#7a3a8e", "#b0507a", "#e07a64", "#f4b070", "#ffd890"];
const rgba = (r: number, g: number, b: number): [number, number, number, number] => [Math.round(r), Math.round(g), Math.round(b), 255];
const hexRgba = (c: string): [number, number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
const NIGHT = ["#04030f", "#0a0828", "#151040", "#221858", "#33206a"];

// ---- shared pieces -----------------------------------------------------------------------------------------

function door(img: Img, [x, y, w, h]: Rect, panel: string[], frame: string, label?: string): void {
  metal(img, x - 3, y - 3, w + 6, h + 3, frame);
  vgrad(img, x, y, w, h, panel);
  img.rect(x + 3, y + 4, w - 6, 1, mix(panel[0], "#ffffff", 0.2));
  img.rect(x + w - 8, y + h / 2, 3, 4, mix(frame, "#ffffff", 0.3));
  if (label) {
    const tw = label.length * 4 - 1;
    img.rect(x + (w - tw) / 2 - 2, y - 12, tw + 4, 8, "#0c0a12");
    img.text(x + (w - tw) / 2, y - 11, label, "#f4e8ff", 230);
  }
}

function wallPanels(img: Img, y0: number, y1: number, pal: string[], every = 64, seed = 1): void {
  vgrad(img, 0, y0, img.w, y1 - y0, pal);
  const r = rng(seed);
  for (let x = 0; x < img.w; x += every) {
    img.rect(x, y0, 1, y1 - y0, mix(pal[pal.length - 1], "#000000", 0.3));
    img.rect(x + 1, y0, 1, y1 - y0, mix(pal[0], "#ffffff", 0.1));
    if (r() < 0.3) img.rect(x + 6, y0 + 10, every - 12, y1 - y0 - 20, mix(pal[Math.floor(pal.length / 2)], "#000000", 0.08));
  }
}

function skirting(img: Img, y: number, c: string): void {
  img.rect(0, y - 4, img.w, 4, c);
  img.rect(0, y - 4, img.w, 1, mix(c, "#ffffff", 0.3));
  img.rect(0, y, img.w, 1, mix(c, "#000000", 0.5));
}

function speakerStack(img: Img, [x, y, w, h]: Rect, body: string, cone: string): void {
  metal(img, x, y, w, h, body);
  const cols = Math.max(1, Math.floor(w / 40));
  const rows = Math.max(1, Math.floor(h / 40));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cx = x + (c + 0.5) * (w / cols);
      const cy = y + (r + 0.5) * (h / rows);
      const rad = Math.min(w / cols, h / rows) * 0.4;
      img.circle(cx, cy, rad + 1, mix(body, "#000000", 0.6));
      img.circle(cx, cy, rad, mix(body, "#000000", 0.35));
      img.circle(cx - 1, cy - 1, rad * 0.72, mix(cone, "#000000", 0.45));
      img.circle(cx - 1, cy - 1, rad * 0.55, cone);
      img.circle(cx - 2, cy - 2, rad * 0.2, mix(cone, "#ffffff", 0.55));
      glow(img, cx, cy, rad * 1.3, rad * 1.3, cone, 0.18);
    }
}

function mirror(img: Img, [x, y, w, h]: Rect, frame: string, glassPal: string[]): void {
  metal(img, x - 3, y - 3, w + 6, h + 6, frame);
  vgrad(img, x, y, w, h, glassPal);
  for (let i = 0; i < 3; i++) img.line(x + 6 + i * 9, y + h - 6, x + w * 0.45 + i * 9, y + 6, "#ffffff", 70 - i * 18);
}

/** The lower part of a wall in wooden panels with raised frames, a rail on top. */
function wainscot(img: Img, y0: number, y1: number, pal: string[], every = 80): void {
  vgrad(img, 0, y0, img.w, y1 - y0, pal);
  const hi = mix(pal[0], "#ffffff", 0.25);
  const lo = mix(pal[pal.length - 1], "#000000", 0.35);
  img.rect(0, y0 - 3, img.w, 3, mix(pal[0], "#ffffff", 0.12));
  img.rect(0, y0 - 3, img.w, 1, hi);
  img.rect(0, y0, img.w, 1, lo);
  for (let x = 6; x + every - 12 < img.w + every; x += every) {
    const w = every - 12;
    img.rect(x, y0 + 6, w, 1, lo);
    img.rect(x, y0 + 6, 1, y1 - y0 - 12, lo);
    img.rect(x, y1 - 6, w, 1, hi);
    img.rect(x + w - 1, y0 + 6, 1, y1 - y0 - 12, hi);
  }
}

/** A picture frame with a bevelled moulding; the picture is painted by `inside`. */
function framed(img: Img, [x, y, w, h]: Rect, moulding: string, inside: (x: number, y: number, w: number, h: number) => void): void {
  metal(img, x, y, w, h, moulding);
  img.rect(x + 2, y + 2, w - 4, h - 4, mix(moulding, "#000000", 0.55));
  inside(x + 3, y + 3, w - 6, h - 6);
  img.rect(x + 3, y + 3, w - 6, 1, mix(moulding, "#000000", 0.3));
}

/** A framed record: a disc with grooves, a label and a glint (the Guild hangs its hits). */
function record(img: Img, r: Rect, disc: string, label: string): void {
  framed(img, r, "#2a2018", (x, y, w, h) => {
    vgrad(img, x, y, w, h, ["#1a1420", "#241c2a"]);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = Math.min(w, h) / 2 - 3;
    img.circle(cx, cy, rad, mix(disc, "#000000", 0.25));
    for (let k = rad - 2; k > rad * 0.45; k -= 2) for (let a = 0; a < 48; a++) img.px(cx + Math.cos((a / 48) * Math.PI * 2) * k, cy + Math.sin((a / 48) * Math.PI * 2) * k, hex(a % 12 < 5 ? mix(disc, "#ffffff", 0.35) : disc));
    img.circle(cx, cy, rad * 0.35, label);
    img.circle(cx, cy, 1, "#100c10");
    img.line(cx - rad * 0.7, cy - rad * 0.3, cx - rad * 0.3, cy - rad * 0.7, "#ffffff", 150);
  });
}

/** The Producers' Guild's seal, the Chairman's mark: a gold hook inside a ring (D-050). */
function seal(img: Img, x: number, y: number, r = 6): void {
  img.circle(x, y, r + 1, "#5a4012");
  img.circle(x, y, r, "#f0c040");
  img.circle(x, y, r - 1.5, "#7a5a18");
  img.circle(x - 1, y - 1, r - 2.5, "#c89a30");
  const k = Math.max(1, Math.round(r / 3));
  img.line(x + 1, y - k - 1, x + 1, y + k, "#fff0b0");
  img.line(x + 1, y + k, x - k, y + k, "#fff0b0");
  img.px(x - k, y + k - 1, hex("#fff0b0"));
  img.px(x - r + 1, y - r + 2, hex("#fffbe0"));
}

/** Black and yellow hazard stripes along a strip. */
function hazard(img: Img, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.px(x + i, y + j, hex(((i + j) >> 2) % 2 ? "#e8c020" : "#1a1a1e"));
  img.rect(x, y, w, 1, "#fff090");
}

function floorGrime(img: Img, y0: number, pal: string[], seed: number): void {
  texture(img, 0, y0, img.w, img.h - y0, pal, { scale: 16, seed, contrast: 0.45, light: (_x, y) => 0.65 - ((y - y0) / (img.h - y0)) * 0.5 });
}

function crowd(img: Img, y: number, c: string, seed: number, hands = false): void {
  const r = rng(seed);
  for (let x = -6; x < img.w + 6; x += 7 + Math.floor(r() * 5)) {
    const h = 16 + Math.floor(r() * 10);
    img.ellipse(x, y - h, 4, 5, c);
    img.ellipse(x, y - h + 12, 7, 10, c);
    img.rect(x - 7, y - h + 12, 14, h, c);
    if (hands && r() < 0.35) {
      const hx = x + (r() < 0.5 ? -5 : 5);
      img.line(hx, y - h + 6, hx + (r() - 0.5) * 6, y - h - 10, c);
      img.circle(hx, y - h - 10, 1.5, c);
    }
  }
}

// ---- rooms ---------------------------------------------------------------------------------------------------

export const ROOMS: Record<string, (img: Img) => void> = {
  bg_crossing_far(img) {
    vgrad(img, 0, 0, img.w, img.h, ["#03021a", "#080632", "#120c48", "#1e125c", "#2a1866", "#3a1e70"]);
    // nebula: noise bands in violet, magenta and teal
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        const n = fbm(x / 120, y / 60, 4);
        const m = fbm(x / 70 + 9, y / 40, 11);
        const t = n * 1.2 - 0.38 - Math.abs(y - 150) / 500;
        if (t > 0.18 + (0.12 * ((x * 7 + y * 13) % 8)) / 8) img.px(x, y, rgba(112 * (0.6 + m * 0.6), 52 * (0.6 + m * 0.6), 160 * (0.6 + m * 0.6)));
        else if (t > 0.08 && (x + y) % 2) img.px(x, y, rgba(62, 36, 120));
        if (m > 0.66 && n > 0.45 && (x * 3 + y) % 3 === 0) img.px(x, y, rgba(70, 150, 190));
      }
    stars(img, 1400, 21);
    // the blue world below
    const cx = 540;
    const cy = 330;
    for (let y = cy - 70; y < img.h; y++)
      for (let x = cx - 70; x < cx + 70; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 64) continue;
        const land = fbm(x / 18, y / 18, 7) > 0.55;
        const lit = (x - cx) * -0.6 + (y - cy) * -0.8;
        const base = land ? ["#1a3a24", "#2a6a3a", "#5aa860"] : ["#0c1a4a", "#1a4aa0", "#4a8ae0"];
        const t = 0.25 + lit / 90;
        img.px(x, y, hexRgba(base[Math.max(0, Math.min(2, Math.round(t * 2 + ((x + y) % 2) * 0.3)))]));
      }
    glow(img, cx, cy, 82, 82, "#4a8ae0", 0.35);
  },
  bg_crossing(img) {
    clouds(img, 0, 20, img.w, 70, "#7a5ab0", "#4a3a88", 3, 0.6);
    clouds(img, 120, 180, 420, 40, "#5a4a9a", "#3a2e78", 8, 0.62);
  },

  bg_pond_far(img) {
    vgrad(img, 0, 0, img.w, 236, DUSK);
    stars(img, 160, 5, 70);
    clouds(img, 0, 60, img.w, 30, "#c86a8a", "#8a4a8a", 12, 0.6);
    glow(img, 470, 214, 60, 30, "#ffe0a0", 0.5);
    skyline(img, 226, ["#5a3a78", "#6a4486", "#7a4e90"], 3, { spireAt: 300, spireColor: "#4a2e6a", windows: "#ffd890", maxH: 90 });
    skyline(img, 232, ["#3a2858", "#44305e"], 9, { maxH: 50, windows: "#ffc070" });
    for (const [x, s] of [[40, 4], [96, 2], [574, 6], [622, 8]] as const) {
      branch(img, x, 240, -Math.PI / 2, 40, 5, "#2a1a24", s, 3);
      foliage(img, x, 176, 30, 34, ["#140e22", "#1e1a34", "#2a2a3e", "#3a3a4a"], s);
    }
  },
  bg_pond(img) {
    texture(img, 0, 234, img.w, 126, ["#1a2a1a", "#243a22", "#30482a", "#3e5a32", "#4e6a3a"], { scale: 10, seed: 3, light: (_x, y) => 0.75 - (y - 234) / 200 });
    // the pond mirrors the sky
    const pcx = 385;
    const pcy = 224;
    for (let y = 198; y < 252; y++)
      for (let x = 140; x < 630; x++) {
        const d = Math.hypot((x - pcx) / 245, (y - pcy) / 27);
        if (d > 1) continue;
        const t = 1 - (y - 198) / 54;
        const ripple = Math.sin(x / 7 + y * 1.3) > 0.85 ? 0.12 : 0;
        img.px(x, y, hexRgba(["#3a2e6a", "#6a4a8a", "#b06a8a", "#e0a080"][Math.min(3, Math.max(0, Math.floor((t * 0.8 + ripple) * 4 + ((x + y) % 4) / 8)))]));
        if (d > 0.93) img.px(x, y, rgba(42, 58, 34));
      }
    for (let i = 0; i < 26; i++) {
      const x = 170 + ((i * 53) % 430);
      const y = 206 + ((i * 31) % 40);
      img.line(x, y, x + 8 + (i % 5), y, "#f0c8b0", 110);
    }
    // path, bench, lamp
    texture(img, 560, 236, 80, 70, ["#5a5260", "#6e6672", "#867e88", "#9a929a"], { scale: 6, seed: 9, mask: (x, y) => x > 640 - (y - 230) * 1.3 });
    const b = rectOf("pond", "bench");
    planks(img, b[0], b[1], b[2], 6, ["#3a2414", "#5a3820", "#7a5030", "#8a6040"], 2);
    planks(img, b[0], b[1] + 12, b[2], 6, ["#3a2414", "#5a3820", "#7a5030", "#8a6040"], 3);
    metal(img, b[0] + 4, b[1] + 18, 4, 16, "#2a2a30");
    metal(img, b[0] + b[2] - 8, b[1] + 18, 4, 16, "#2a2a30");
    const l = rectOf("pond", "lamp");
    metal(img, l[0] + 6, l[1] + 10, 4, l[3] - 10, "#22222a");
    metal(img, l[0] + 1, l[1], 14, 12, "#22222a");
    glow(img, l[0] + 8, l[1] + 6, 70, 60, "#ffd89a", 0.35);
    img.rect(l[0] + 4, l[1] + 3, 8, 7, "#ffe8b0");
    // reeds where Skein rests, grass in front
    const r = rng(4);
    for (let i = 0; i < 40; i++) {
      const x = 196 + r() * 74;
      img.line(x, 282, x + (r() - 0.5) * 6, 252 - r() * 16, r() < 0.5 ? "#4e6a3a" : "#30482a");
    }
    for (let i = 0; i < 160; i++) {
      const x = r() * img.w;
      const y = 270 + r() * 30;
      img.line(x, y, x + (r() - 0.5) * 3, y - 3 - r() * 5, r() < 0.5 ? "#3e5a32" : "#1a2a1a");
    }
    glow(img, 470, 220, 120, 16, "#ffd0a0", 0.25);
  },

  bg_park_gate_far(img) {
    vgrad(img, 0, 0, img.w, 230, DUSK.slice(1));
    clouds(img, 0, 40, img.w, 40, "#c06a8a", "#8a4a86", 31, 0.58);
    skyline(img, 216, ["#5a3a78", "#6a4486", "#7a4e90"], 21, { windows: "#ffd890", maxH: 140 });
  },
  bg_park_gate(img) {
    tiles(img, 238, 360, ["#3a3442", "#4a4452", "#5a5462", "#6e6676"], 320, 5);
    const hd = rectOf("park_gate", "hedge");
    for (let x = hd[0]; x < hd[0] + hd[2]; x += 26) foliage(img, x + 13, hd[1] + 40, 20, 46, ["#101a14", "#18281c", "#223624", "#2e4630", "#3e5a3a"], x);
    img.rect(hd[0], hd[1] + hd[3] - 6, hd[2], 8, "#101a14");
    const g = rectOf("park_gate", "gate");
    for (const px of [g[0] - 16, g[0] + g[2]]) {
      bricks(img, px, g[1] - 14, 16, g[3] + 14, "#7a7080", "#4a4450", px, 8, 4);
      metal(img, px - 2, g[1] - 20, 20, 7, "#9a92a2");
      lamp(img, px + 8, g[1] - 26, "#ffd89a", 4);
    }
    const s = rectOf("park_gate", "sign");
    metal(img, s[0], s[1], s[2], s[3], "#e8e4d8");
    img.text(s[0] + 4, s[1] + 4, "PARK", "#2a2a34");
    img.text(s[0] + 4, s[1] + 12, "CLOSED", "#2a2a34");
    img.text(s[0] + 4, s[1] + 20, "DUSK-DAWN", "#8a2a2a");
    const k = rectOf("park_gate", "keypad");
    metal(img, k[0], k[1], k[2], k[3], "#2a2a34");
    for (let i = 0; i < 6; i++) img.px(k[0] + 3 + (i % 2) * 6, k[1] + 4 + Math.floor(i / 2) * 5, rgba(102, 224, 255));
    glow(img, k[0] + 7, k[1] + 10, 14, 14, "#66e0ff", 0.3);
    vignette(img, "#0a0814", 0.6);
  },

  bg_street_sky(img) {
    vgrad(img, 0, 0, img.w, 270, DUSK.slice(2));
    clouds(img, 0, 30, img.w, 50, "#e08a8a", "#a05a8a", 41, 0.56);
    clouds(img, 0, 100, img.w, 30, "#f0b088", "#c07a80", 43, 0.6);
  },
  bg_street_mid(img) {
    skyline(img, 248, ["#3e2a5e", "#4a3268", "#563a72"], 41, { spireAt: 470, spireColor: "#3a2456", windows: "#ffc070", maxH: 150 });
    glow(img, 470, 60, 40, 40, "#ff7ae0", 0.3);
  },
  bg_street(img) {
    tiles(img, 248, 360, ["#2e2a36", "#3c3644", "#4a4452", "#5a5462"], 480, 11);
    img.rect(0, 244, img.w, 4, "#6e6676");
    img.rect(0, 244, img.w, 1, "#9a92a2");
    // the old brick block on the left
    bricks(img, 0, 110, 300, 136, "#6a3a3a", "#3a2424", 5);
    for (let x = 14; x < 290; x += 34)
      for (let y = 124; y < 220; y += 34) {
        metal(img, x, y, 18, 22, "#2a1e24");
        if ((x + y) % 3 === 0) {
          img.rect(x + 2, y + 2, 14, 18, "#ffcf7a");
          glow(img, x + 9, y + 11, 18, 18, "#ffb050", 0.3);
        } else vgrad(img, x + 2, y + 2, 14, 18, ["#2a2440", "#4a3a5a"]);
      }
    img.rect(0, 104, 300, 6, "#4a2a2a");
    // billboard
    const bb = rectOf("street", "billboard");
    metal(img, bb[0] - 5, bb[1] - 5, bb[2] + 10, bb[3] + 10, "#22182a");
    vgrad(img, bb[0], bb[1], bb[2], bb[3], ["#ff8ae4", "#e050c0", "#a02a9a", "#5a1a6a"]);
    img.circle(bb[0] + 62, bb[1] + 54, 28, "#ffd8ec");
    img.ellipse(bb[0] + 62, bb[1] + 34, 34, 20, "#66e0ff");
    img.ellipse(bb[0] + 50, bb[1] + 30, 14, 8, "#b0f4ff");
    img.rect(bb[0] + 52, bb[1] + 52, 4, 3, "#2a1a3a");
    img.rect(bb[0] + 68, bb[1] + 52, 4, 3, "#2a1a3a");
    img.text(bb[0] + 112, bb[1] + 28, "AGAIN AGAIN", "#ffffff");
    img.text(bb[0] + 112, bb[1] + 40, "(OOH)", "#ffffff");
    img.text(bb[0] + 112, bb[1] + 64, "NO.1 AGAIN", "#66e0ff");
    seal(img, bb[0] + bb[2] - 14, bb[1] + bb[3] - 14, 7);
    glow(img, bb[0] + bb[2] / 2, bb[1] + bb[3] + 30, 160, 60, "#ff7ae0", 0.25);
    metal(img, bb[0] + 40, bb[1] + bb[3] + 5, 6, 104, "#22182a");
    metal(img, bb[0] + bb[2] - 46, bb[1] + bb[3] + 5, 6, 104, "#22182a");
    // speaker tree
    const sp = rectOf("street", "speaker_pole");
    metal(img, sp[0] + 7, sp[1], 4, sp[3], "#2a2a34");
    for (let i = 0; i < 4; i++) speakerStack(img, [sp[0] + (i % 2 ? 11 : -6), sp[1] + 6 + i * 26, 13, 15], "#24222c", "#ff7ae0");
    // steps up to the Spire plaza
    const st = rectOf("street", "stairs");
    vgrad(img, st[0] - 24, st[1] - 84, st[2] + 48, 84, ["#e8d0f0", "#c8a8d8", "#a888b8"]);
    img.rect(st[0] - 24, st[1] - 88, st[2] + 48, 5, "#ff7ae0");
    glow(img, st[0] + st[2] / 2, st[1] - 86, 90, 14, "#ff7ae0", 0.5);
    img.text(st[0] + 22, st[1] - 70, "THE STARLIGHT SPIRE", "#5a2a6a");
    for (let i = 0; i < 8; i++) metal(img, st[0] - i * 2, st[1] + i * 12, st[2] + i * 4, 12, i % 2 ? "#a49cb0" : "#b8b0c4");
    // the Mega-Dome at the far end
    const ar = rectOf("street", "arena");
    for (let y = ar[1]; y < ar[1] + 70; y++)
      for (let x = ar[0] - 30; x < ar[0] + ar[2] + 30; x++) {
        const d = Math.hypot((x - (ar[0] + ar[2] / 2 + 10)) / 100, (y - (ar[1] + 70)) / 70);
        if (d <= 1) img.px(x, y, rgba(42, 30, 90));
        if (d <= 1 && d > 0.9) img.px(x, y, rgba(160, 112, 255));
      }
    img.rect(ar[0] - 30, ar[1] + 70, ar[2] + 60, ar[3] - 70, "#2a1e5a");
    for (let x = ar[0] - 24; x < ar[0] + ar[2] + 30; x += 12) img.circle(x, ar[1] + 74, 2, x % 24 ? "#ff60c0" : "#a070ff");
    img.text(ar[0] + 14, ar[1] + 40, "MEGA-DOME", "#ff9ae0");
    door(img, [ar[0] + 30, ar[1] + 84, 50, 56], ["#140c2a", "#22184a"], "#5a3aa0");
    img.rect(0, 160, 40, 136, "#1e2a20");
    foliage(img, 20, 150, 26, 30, ["#101a14", "#18281c", "#223624", "#2e4630"], 77);
  },

  bg_spire_lobby_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#1a0626", "#2e0c40", "#4a1458", "#6e1e70", "#9a2a88", "#c03aa0"]);
    for (let x = 32; x < img.w; x += 96) {
      img.rect(x, 0, 3, 250, "#ff8ae8");
      glow(img, x + 1, 120, 14, 140, "#ff7ae0", 0.45);
    }
    for (const x of [160, 480]) {
      for (let a = 0; a < 64; a++) img.px(x + Math.cos((a / 64) * Math.PI * 2) * 26, 60 + Math.sin((a / 64) * Math.PI * 2) * 26, rgba(230, 250, 255));
      glow(img, x, 60, 34, 34, "#e8f8ff", 0.25);
    }
    img.rect(0, 26, img.w, 2, "#66e0ff");
  },
  bg_spire_lobby(img) {
    tiles(img, 248, 360, ["#6a5a7a", "#9a8aa8", "#c8b8d4", "#e8e0f0"], 320, 13);
    // reflections of the neon on the glossy floor
    for (let x = 32; x < img.w; x += 96) beam(img, x + 1, 250, 4, x + 1, 300, 10, "#ff9ae8", 0.4);
    mirror(img, rectOf("spire_lobby", "mirrors"), "#e8e8f4", ["#d8c0f0", "#b090d0", "#8a6aa8", "#6a4a88"]);
    const s = rectOf("spire_lobby", "sign");
    img.text(s[0] + 2, s[1] + 4, "WHERE EVERY STAR", "#ffffff");
    img.text(s[0] + 2, s[1] + 14, "IS BORN READY", "#66e0ff");
    seal(img, s[0] + s[2] - 10, s[1] + 12, 6);
    glow(img, s[0] + 40, s[1] + 12, 60, 14, "#66e0ff", 0.25);
    door(img, rectOf("spire_lobby", "elevator"), ["#f0f0f8", "#c8c8d8", "#a4a4b8"], "#e8e8f4", "ELEVATOR");
    const h = rectOf("spire_lobby", "hologram");
    img.ellipse(h[0] + h[2] / 2, h[1] + h[3] - 2, 26, 6, "#3a3a4a");
    img.ellipse(h[0] + h[2] / 2, h[1] + h[3] - 3, 22, 4, "#66e0ff");
    beam(img, h[0] + h[2] / 2, h[1] - 10, 30, h[0] + h[2] / 2, h[1] + h[3] - 4, 44, "#66e0ff", 0.22);
    img.rect(0, 150, 36, 146, "#1a0626");
    glow(img, 18, 220, 30, 70, "#ffb0f0", 0.25);
  },
  bg_spire_lobby_front(img) {
    const d = rectOf("spire_lobby", "desk");
    for (let y = d[1] - 10; y < d[1] + d[3]; y++)
      for (let x = d[0]; x < d[0] + d[2]; x++) {
        const top = d[1] + 6 - Math.sqrt(Math.max(0, 1 - Math.pow((x - d[0] - d[2] / 2) / (d[2] / 2), 2))) * 16;
        if (y < top) continue;
        const t = (y - top) / (d[1] + d[3] - top);
        const k = t * 70 + (x > d[0] + d[2] * 0.75 ? 20 : 0);
        img.px(x, y, rgba(248 - k, 244 - k, 252 - k));
      }
    img.rect(d[0] + 10, d[1] + 18, d[2] - 20, 3, "#ff7ae0");
    glow(img, d[0] + d[2] / 2, d[1] + 19, d[2] / 2, 6, "#ff7ae0", 0.4);
  },

  bg_floor40_far(img) {
    wallPanels(img, 0, 250, ["#3a1250", "#561a66", "#7a2478", "#9a3088"], 80, 4);
    img.rect(0, 36, img.w, 2, "#66e0ff");
    for (let x = 40; x < img.w; x += 120) lamp(img, x, 24, "#ffd0f8", 4);
  },
  bg_floor40(img) {
    texture(img, 0, 246, img.w, 114, ["#2a1236", "#3a1a48", "#4a2458", "#5e2e6a"], { scale: 5, seed: 7, contrast: 0.3, light: (_x, y) => 0.8 - (y - 246) / 140 });
    skirting(img, FLOOR, "#e8d8f0");
    door(img, rectOf("floor40", "door_mixing"), ["#2a1a3a", "#3a2450"], "#d8d0e8", "CONTROL B");
    door(img, rectOf("floor40", "door_fitting"), ["#2a1a3a", "#3a2450"], "#d8d0e8", "FITTING");
    door(img, rectOf("floor40", "door_corridor"), ["#e0d0f8", "#b0a0d8", "#8a7ab8"], "#d8d0e8", "MIRRORS");
    door(img, rectOf("floor40", "elevator"), ["#f0f0f8", "#c8c8d8", "#a4a4b8"], "#e8e8f4");
    const p = rectOf("floor40", "poster");
    vgrad(img, p[0], p[1], p[2], p[3], ["#ff8ae4", "#e050c0", "#a02a9a"]);
    img.text(p[0] + 4, p[1] + 6, "BE", "#ffffff");
    img.text(p[0] + 4, p[1] + 14, "YOURSELF", "#ffffff");
    for (let i = 0; i < 4; i++) img.rect(p[0] + 4, p[1] + 26 + i * 6, p[2] - 8 - (i % 2) * 10, 2, "#ffe0f8");
    const pl = rectOf("floor40", "plant");
    metal(img, pl[0] + 5, pl[1] + 30, 16, 16, "#e8e8f4");
    foliage(img, pl[0] + 13, pl[1] + 18, 12, 16, ["#1a8a50", "#2aaa60", "#40e080", "#80ffb0"], 5);
    const w = rectOf("floor40", "wardrobe");
    metal(img, w[0], w[1], w[2], 4, "#d8d0e8");
    const faces = ["#ffd0e8", "#d0e8ff", "#ffe8b0", "#e0d0ff", "#c8ffd8"];
    const suits = ["#ff7ae0", "#66e0ff", "#ffd090", "#a070ff", "#40e080"];
    for (let i = 0; i < 5; i++) {
      const fx = w[0] + 10 + i * 19;
      img.line(fx, w[1] + 4, fx, w[1] + 16, "#d8d0e8");
      img.ellipse(fx, w[1] + 28, 8, 11, faces[i]);
      img.ellipse(fx + 3, w[1] + 30, 4, 8, mix(faces[i], "#000000", 0.15));
      img.rect(fx - 4, w[1] + 26, 2, 2, "#2a1a3a");
      img.rect(fx + 2, w[1] + 26, 2, 2, "#2a1a3a");
      img.line(fx - 3, w[1] + 33, fx + 3, w[1] + 33, "#a02a6a");
      vgrad(img, fx - 8, w[1] + 42, 16, 62, [suits[i], mix(suits[i], "#000000", 0.4)]);
    }
    img.text(w[0] + 26, w[1] - 9, "PERSONAS", "#ffe0ff");
  },

  bg_mixing_room_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#0c0818", "#140e26", "#1c1434", "#241a40"]);
    for (let x = 0; x < img.w; x += 24)
      for (let y = 30; y < 230; y += 24) {
        const c = (x / 24 + y / 24) % 2 ? "#1e1630" : "#18122a";
        img.rect(x + 1, y + 1, 22, 22, c);
        img.rect(x + 1, y + 1, 22, 1, "#2a2040");
      }
  },
  bg_mixing_room(img) {
    texture(img, 0, 246, img.w, 114, ["#0c0a16", "#16122a", "#201a36", "#2a2242"], { scale: 6, seed: 3, contrast: 0.3, light: (_x, y) => 0.7 - (y - 246) / 150 });
    const win = rectOf("mixing_room", "window");
    metal(img, win[0] - 4, win[1] - 4, win[2] + 8, win[3] + 8, "#2a2638");
    vgrad(img, win[0], win[1], win[2], win[3], ["#0a0828", "#1a1450", "#3a2470", "#7a3a7a"]);
    const sub = new Img(win[2], win[3]);
    skyline(sub, win[3], ["#140e2a", "#1c1436"], 3, { windows: "#ffd890", maxH: 70 });
    img.blit(sub, win[0], win[1]);
    img.rect(win[0] + win[2] / 2 - 1, win[1], 3, win[3], "#2a2638");
    const m = rectOf("mixing_room", "monitors");
    metal(img, m[0], m[1], m[2], m[3], "#08060e");
    for (let i = 0; i < 24; i++) {
      const hgt = 8 + ((i * 37) % 40);
      vgrad(img, m[0] + 6 + i * 7.5, m[1] + m[3] - 6 - hgt, 5, hgt, ["#ff7ae0", "#ffd090", "#40e080"]);
    }
    glow(img, m[0] + m[2] / 2, m[1] + m[3] + 30, 140, 50, "#80c0ff", 0.35);
    const d = rectOf("mixing_room", "desk");
    img.poly([[d[0], d[1] + d[3]], [d[0] + 12, d[1]], [d[0] + d[2] - 12, d[1]], [d[0] + d[2], d[1] + d[3]]], "#2a2440");
    img.poly([[d[0] + 12, d[1]], [d[0] + d[2] - 12, d[1]], [d[0] + d[2] - 10, d[1] + 3], [d[0] + 10, d[1] + 3]], "#4a4268");
    for (let i = 0; i < 26; i++) {
      img.rect(d[0] + 16 + i * 7, d[1] + 6, 2, 22, "#100c20");
      metal(img, d[0] + 14 + i * 7, d[1] + 8 + ((i * 13) % 16), 6, 4, "#d8d8e8");
      img.px(d[0] + 16 + i * 7, d[1] + 3, i % 3 ? rgba(255, 120, 220) : rgba(100, 255, 160));
    }
    door(img, rectOf("mixing_room", "door"), ["#1a1430", "#241c40"], "#3a3450");
  },

  bg_fitting_room_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#3a1a30", "#5a2840", "#7a3a50", "#9a5060"]);
    // striped wallpaper with a small motif in every other stripe
    for (let x = 0; x < img.w; x += 24) img.shade(x, 0, 12, 250, "#4a2038", 0.35);
    for (let x = 6; x < img.w; x += 24)
      for (let y = 10; y < 250; y += 16) {
        img.px(x, y, [255, 210, 220, 130]);
        img.px(x - 1, y + 1, [255, 210, 220, 70]);
        img.px(x + 1, y + 1, [255, 210, 220, 70]);
        img.px(x, y + 2, [255, 210, 220, 130]);
      }
    // a cornice and soft light from the ceiling
    img.rect(0, 0, img.w, 6, "#2a1020");
    img.rect(0, 6, img.w, 1, "#c88898");
    glow(img, 320, 0, 300, 40, "#ffd8c0", 0.25);
  },
  bg_fitting_room(img) {
    wainscot(img, 196, 246, ["#5a2a38", "#4a2030", "#3a1828"], 70);
    planks(img, 0, 246, img.w, 114, ["#4a2418", "#6a3424", "#8a4a30", "#a0603e"], 5);
    skirting(img, FLOOR, "#e8c8b8");
    // a practice barre between the mirror and the piano
    for (const bx of [292, 410]) metal(img, bx, 172, 3, 12, "#b8a090");
    img.rect(288, 170, 128, 3, "#e8d0b8");
    img.rect(288, 170, 128, 1, "#fff0e0");
    img.rect(288, 173, 128, 1, "#5a3a30");
    // a poster of a singer under a star, and a schedule pinned beside it
    framed(img, [62, 70, 50, 70], "#2a1420", (x, y, w, h) => {
      vgrad(img, x, y, w, h, ["#ff7ae0", "#b03a9a", "#4a1a5a"]);
      img.ellipse(x + w / 2, y + 26, 7, 8, "#2a0a2a");
      img.poly([[x + w / 2 - 12, y + h], [x + w / 2 - 6, y + 34], [x + w / 2 + 6, y + 34], [x + w / 2 + 12, y + h]], "#2a0a2a");
      img.line(x + w / 2 + 4, y + 30, x + w / 2 + 10, y + 20, "#2a0a2a");
      img.circle(x + w / 2 + 11, y + 18, 2, "#2a0a2a");
      img.poly([[x + 8, y + 4], [x + 10, y + 9], [x + 15, y + 9], [x + 11, y + 12], [x + 13, y + 17], [x + 8, y + 14], [x + 3, y + 17], [x + 5, y + 12], [x + 1, y + 9], [x + 6, y + 9]], "#fff0a0");
    });
    metal(img, 278, 92, 34, 44, "#ece4d8");
    for (let k = 0; k < 6; k++) img.rect(283, 100 + k * 6, k % 3 === 2 ? 14 : 24, 2, "#8a7a8a");
    img.circle(295, 94, 2, "#ff4060");
    // a rail of stage costumes by the far wall
    metal(img, 548, 120, 3, 126, "#b8b0c0");
    metal(img, 626, 120, 3, 126, "#b8b0c0");
    img.rect(548, 120, 81, 3, "#d8d0e0");
    const coats = ["#ff7ae0", "#66e0ff", "#f0d060", "#c040a0", "#e8e8f0", "#8a4ad0"];
    coats.forEach((c, k) => {
      const x = 554 + k * 12;
      img.line(x + 4, 123, x + 4, 128, "#d8d0e0");
      img.poly([[x, 128], [x + 9, 128], [x + 10, 186 + (k % 3) * 6], [x - 1, 186 + (k % 3) * 6]], c);
      img.rect(x, 128, 2, 58 + (k % 3) * 6, mix(c, "#ffffff", 0.3));
      img.rect(x + 7, 128, 3, 58 + (k % 3) * 6, mix(c, "#000000", 0.3));
      for (let y = 134; y < 182; y += 7) img.px(x + 3 + ((y >> 3) % 3), y, [255, 255, 255, 200]);
    });
    const m = rectOf("fitting_room", "mirror");
    mirror(img, m, "#3a2030", ["#d8b0c0", "#a07890", "#704a60"]);
    for (let i = 0; i < 8; i++) {
      for (const yy of [m[1] - 4, m[1] + m[3] + 4]) {
        const bx = m[0] - 4 + (i * (m[2] + 8)) / 7;
        glow(img, bx, yy, 8, 8, "#ffe8b0", 0.5);
        img.circle(bx, yy, 2, "#fff4d0");
      }
    }
    const p = rectOf("fitting_room", "piano");
    planks(img, p[0], p[1] - 24, p[2], p[3] + 24, ["#1a0c08", "#2a1810", "#3a2418", "#4a3020"], 8, true);
    img.rect(p[0] + 4, p[1] + 8, p[2] - 8, 9, "#ece8dc");
    for (let i = 0; i < 14; i++) img.rect(p[0] + 7 + i * 6, p[1] + 8, 2, 5, "#141010");
    img.rect(p[0], p[1] - 26, p[2], 3, "#5a4030");
    const mt = rectOf("fitting_room", "metronome");
    img.poly([[mt[0], mt[1] + mt[3]], [mt[0] + mt[2] / 2, mt[1]], [mt[0] + mt[2], mt[1] + mt[3]]], "#6a4a30");
    img.line(mt[0] + mt[2] / 2, mt[1] + mt[3] - 2, mt[0] + mt[2] - 2, mt[1] + 4, "#ece8dc");
    door(img, rectOf("fitting_room", "door"), ["#3a2030", "#4a2a3a"], "#a07080");
    glow(img, 380, 160, 180, 90, "#fff0d0", 0.15);
    // the mirror's bulbs pool on the boards
    glow(img, m[0] + m[2] / 2, 262, 110, 14, "#ffe8b0", 0.22);
  },

  bg_mirror_corridor_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#2a1440", "#4a2a68", "#7a5098", "#a080c8"]);
    for (let x = 0; x < img.w; x += 46) {
      mirror(img, [x + 5, 34, 36, 200], "#e8e0f4", ["#c8b0e8", "#a088c8", "#7a60a8"]);
      const cx = x + 23;
      img.ellipse(cx, 172, 6, 7, "#3a3048", 120);
      img.poly([[cx - 10, 232], [cx - 7, 176], [cx + 7, 176], [cx + 10, 232]], "#3a3048", 120);
      img.px(cx - 2, 172, [160, 220, 255, 140]);
      img.px(cx + 2, 172, [160, 220, 255, 140]);
    }
  },
  bg_mirror_corridor(img) {
    tiles(img, 246, 360, ["#6a5a88", "#9a8ab8", "#c8b8e0", "#ece4f8"], 320, 17);
    const s = rectOf("mirror_corridor", "speakers");
    for (let i = 0; i < 4; i++) speakerStack(img, [s[0] + i * 62, s[1], 52, s[3]], "#221a2e", "#ff7ae0");
    door(img, rectOf("mirror_corridor", "door_back"), ["#2a1a3a", "#3a2450"], "#e8e8f4");
    door(img, rectOf("mirror_corridor", "door_hall"), ["#2a1a3a", "#3a2450"], "#e8e8f4", "HALL");
    for (let x = 23; x < img.w; x += 46) beam(img, x, 246, 6, x, 300, 12, "#e8d8ff", 0.25);
  },

  bg_rehearsal_hall_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#08040e", "#140820", "#240c34", "#3a1048", "#5a1a60"]);
    for (let i = 0; i < 6; i++) beam(img, 80 + i * 100, 0, 8, 120 + i * 80, 246, 70, i % 2 ? "#ff7ae0" : "#66e0ff", 0.2);
  },
  bg_rehearsal_hall(img) {
    planks(img, 0, 246, img.w, 114, ["#1a1020", "#2a1a30", "#3a2440", "#4a3050"], 11);
    speakerStack(img, rectOf("rehearsal_hall", "hook_engine"), "#140e1c", "#ff4fd8");
    img.text(96, 38, "HOOK ENGINE", "#ff9ae8");
    const b = rectOf("rehearsal_hall", "booth");
    for (let y = b[1]; y < b[1] + b[3]; y++) for (let x = b[0]; x < b[0] + b[2]; x++) if ((x + y) % 3 === 0) img.px(x, y, [200, 232, 255, 60]);
    metal(img, b[0], b[1], b[2], 3, "#e8e8f4");
    metal(img, b[0], b[1], 3, b[3], "#e8e8f4");
    metal(img, b[0] + b[2] - 3, b[1], 3, b[3], "#e8e8f4");
    img.line(b[0] + 12, b[1] + 70, b[0] + 46, b[1] + 12, "#ffffff", 140);
    img.line(b[0] + 20, b[1] + 70, b[0] + 54, b[1] + 12, "#ffffff", 80);
    door(img, rectOf("rehearsal_hall", "door"), ["#1a1430", "#241c40"], "#6a4a8a");
    door(img, rectOf("rehearsal_hall", "elevator"), ["#f0f0f8", "#c8c8d8", "#a4a4b8"], "#e8e8f4", "TALENT");
    glow(img, 336, 248, 80, 10, "#66e0ff", 0.3);
  },

  bg_talent_elevator_far(img) {
    for (let x = 0; x < img.w; x += 40) hgrad(img, x, 0, 40, 260, ["#5a5a6a", "#8a8a9a", "#b4b4c4", "#8a8a9a"]);
    // brushed steel: fine horizontal streaks, seams and rivets
    for (let y = 0; y < 260; y += 3) for (let x = 0; x < img.w; x++) if (fbm(x / 40, y / 2, 61) > 0.6) img.px(x, y, [255, 255, 255, 26]);
    for (let y = 30; y < 260; y += 50) {
      img.rect(0, y, img.w, 1, "#4a4a58");
      img.rect(0, y + 1, img.w, 1, "#c4c4d4");
      for (let x = 6; x < img.w; x += 20) {
        img.px(x, y + 4, hex("#e8e8f4"));
        img.px(x + 1, y + 5, hex("#4a4a58"));
      }
    }
    for (let x = 60; x < img.w; x += 130) lamp(img, x, 14, "#fff8e8", 4);
  },
  bg_talent_elevator(img) {
    tiles(img, 248, 360, ["#3a3a44", "#55556a", "#7a7a8c", "#a4a4b4"], 320, 19);
    // a kick plate and a hazard strip where the wall meets the floor
    metal(img, 0, 222, img.w, 22, "#6a6a7a");
    hazard(img, 0, 242, img.w, 5);
    const d = rectOf("talent_elevator", "doors");
    // the doors and the ceiling lamps shine on the polished floor
    for (let y = 250; y < 300; y++) img.shade(d[0] + 6, y, d[2] - 12, 1, "#d0d0e0", 0.3 * (1 - (y - 250) / 50));
    for (let x = 60; x < img.w; x += 130) glow(img, x, 262, 18, 6, "#fff8e8", 0.25);
    metal(img, d[0] - 8, d[1] - 8, d[2] + 16, d[3] + 8, "#d8d8e8");
    hgrad(img, d[0], d[1], d[2] / 2 - 1, d[3], ["#8a8a9a", "#c8c8d8", "#9a9aaa"]);
    hgrad(img, d[0] + d[2] / 2 + 1, d[1], d[2] / 2 - 1, d[3], ["#9a9aaa", "#c8c8d8", "#8a8a9a"]);
    img.text(d[0] + 22, d[1] - 18, "STAFF ONLY", "#ff4040");
    // the floor dial above the doors: its needle points past the top
    const fx = d[0] + d[2] / 2;
    img.ellipse(fx, d[1] - 34, 20, 14, "#8a7a50");
    img.ellipse(fx, d[1] - 34, 17, 11, "#f0e8d0");
    img.rect(fx - 21, d[1] - 34, 42, 15, "#c8c8d8");
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI + (k / 6) * Math.PI;
      img.px(fx + Math.cos(a) * 14, d[1] - 34 + Math.sin(a) * 9, hex("#3a3a44"));
    }
    img.line(fx, d[1] - 34, fx + 15, d[1] - 40, "#c02020");
    img.circle(fx, d[1] - 34, 1.5, "#2a2a34");
    glow(img, d[0] + d[2] / 2, d[1] - 16, 40, 8, "#ff4040", 0.3);
    const p = rectOf("talent_elevator", "panel");
    metal(img, p[0], p[1], p[2], p[3], "#3a3a44");
    for (let i = 0; i < 8; i++) {
      img.circle(p[0] + 12 + (i % 2) * 20, p[1] + 12 + Math.floor(i / 2) * 18, 5, "#e8e8f4");
      img.circle(p[0] + 11 + (i % 2) * 20, p[1] + 11 + Math.floor(i / 2) * 18, 2, "#ffffff");
    }
    img.rect(0, 150, 40, 146, "#24242c");
    // a camera watches whoever waits for the lift
    metal(img, 590, 34, 4, 12, "#3a3a44");
    metal(img, 576, 44, 26, 12, "#d8d8e4");
    img.rect(572, 46, 5, 8, "#2a2a34");
    lamp(img, 598, 48, "#ff3030", 1.5);
  },

  bg_factory_night_far(img) {
    bricks(img, 0, 0, img.w, 250, "#3a2014", "#1a0e08", 3, 14, 6);
    vgrad(img, 0, 0, img.w, 250, ["#0a0604", "#140c08"], (x, y) => (x + y) % 2 === 0 && y < 120);
    for (let x = 30; x < img.w; x += 110) {
      metal(img, x, 0, 14, 250, "#22140c");
      metal(img, x - 4, 60, 22, 8, "#3a2214");
    }
    for (const y of [26, 44]) metal(img, 0, y, img.w, 6, "#2a1a10");
  },
  bg_factory_night(img) {
    floorGrime(img, 246, ["#140c08", "#22140c", "#30200f", "#3e2a14"], 5);
    const ps = rectOf("factory_night", "posters");
    vgrad(img, ps[0], ps[1], ps[2], ps[3], ["#d07a30", "#a0501c"]);
    img.text(ps[0] + 6, ps[1] + 10, "WE MAKE", "#140c08");
    img.text(ps[0] + 6, ps[1] + 20, "WHAT WORKED", "#140c08");
    img.text(ps[0] + 6, ps[1] + 50, "AND AGAIN", "#3a1a08");
    seal(img, ps[0] + ps[2] - 12, ps[1] + ps[3] - 12, 6);
    const wb = rectOf("factory_night", "workbench");
    planks(img, wb[0], wb[1] + 14, wb[2], 8, ["#3a1e10", "#5a3018", "#7a4420"], 4);
    metal(img, wb[0] + 4, wb[1] + 22, 6, 28, "#2a1a10");
    metal(img, wb[0] + wb[2] - 10, wb[1] + 22, 6, 28, "#2a1a10");
    metal(img, wb[0] + 20, wb[1] + 4, 30, 10, "#ffd090");
    img.rect(wb[0] + 70, wb[1] + 6, 16, 8, "#e8e4d8");
    const pd = rectOf("factory_night", "pedal");
    metal(img, pd[0], pd[1] + 4, pd[2], pd[3] - 4, "#2a6a4a");
    lamp(img, pd[0] + 10, pd[1] + 9, "#7fe0a0", 3);
    lamp(img, pd[0] + 30, pd[1] + 9, "#ff9a3a", 3);
    const mp = rectOf("factory_night", "mute_pedal");
    metal(img, mp[0], mp[1] + 4, mp[2], mp[3] - 4, "#3a3a6a");
    lamp(img, mp[0] + mp[2] / 2, mp[1] + 9, "#ff4040", 3);
    lamp(img, 316, 120, "#ffb060", 8);
    beam(img, 316, 126, 20, 316, 246, 160, "#ffb060", 0.3);
    door(img, rectOf("factory_night", "elevator"), ["#24242c", "#30303a"], "#6e3a1c");
    door(img, rectOf("factory_night", "floor_door"), ["#2a160c", "#3a2010"], "#b0602a", "FLOOR");
    vignette(img, "#050302", 0.7);
  },

  bg_press_floor_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#0a0604", "#1a0e08", "#3a1e10", "#6e3a1c"]);
    for (let x = 0; x < img.w; x += 80) metal(img, x, 0, 26, 250, "#22140c");
    for (let y = 30; y < 200; y += 50) metal(img, 0, y, img.w, 6, "#3a1e10");
    for (let i = 0; i < 4; i++) beam(img, 100 + i * 150, 0, 10, 120 + i * 140, 250, 80, "#ff9a3a", 0.18);
  },
  bg_press_floor(img) {
    floorGrime(img, 246, ["#140c08", "#2a1810", "#3a2414", "#4e321c"], 9);
    const hm = rectOf("press_floor", "hook_mill");
    const cx = hm[0] + hm[2] / 2;
    const cy = hm[1] + hm[3] / 2;
    img.circle(cx, cy, 62, "#1a0e08");
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      img.poly([[cx + Math.cos(a) * 52, cy + Math.sin(a) * 52], [cx + Math.cos(a + 0.1) * 64, cy + Math.sin(a + 0.1) * 64], [cx + Math.cos(a + 0.24) * 64, cy + Math.sin(a + 0.24) * 64], [cx + Math.cos(a + 0.34) * 52, cy + Math.sin(a + 0.34) * 52]], "#b0602a");
    }
    for (let y = cy - 54; y <= cy + 54; y++)
      for (let x = cx - 54; x <= cx + 54; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 54) continue;
        const lit = ((x - cx) * -0.6 + (y - cy) * -0.8) / 54;
        const k = (0.75 + lit * 0.35) * (d > 46 ? 0.7 : 1);
        img.px(x, y, rgba(110 * k, 58 * k, 28 * k));
      }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      img.line(cx, cy, cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, "#3a1e10");
    }
    img.circle(cx, cy, 14, "#ffd090");
    img.circle(cx - 3, cy - 3, 5, "#fff0d0");
    img.text(hm[0] + 38, hm[1] - 10, "HOOK MILL", "#ffd090");
    const cu = rectOf("press_floor", "conveyor_up");
    img.poly([[cu[0], cu[1] + cu[3]], [cu[0] + cu[2], cu[1]], [cu[0] + cu[2], cu[1] + 20], [cu[0] + 18, cu[1] + cu[3]]], "#3a1e10");
    img.line(cu[0], cu[1] + cu[3], cu[0] + cu[2], cu[1], "#b0602a");
    img.text(cu[0] + 6, cu[1] + 10, "LOUNGE", "#ffd090");
    door(img, rectOf("press_floor", "back"), ["#2a160c", "#3a2010"], "#6e3a1c");
    vignette(img, "#050302", 0.6);
  },

  bg_focus_lounge_far(img) {
    wallPanels(img, 0, 250, ["#7a6050", "#a08870", "#c8b090", "#d8c4a4"], 90, 5);
    // a lit cove along the ceiling and a picture rail
    img.rect(0, 0, img.w, 8, "#3a2a20");
    img.rect(0, 8, img.w, 2, "#fff0d0");
    glow(img, 320, 10, 340, 30, "#fff0d0", 0.35);
    img.rect(0, 40, img.w, 2, "#8a6a50");
    img.rect(0, 40, img.w, 1, "#e8d0b0");
    for (let x = 60; x < img.w; x += 160) lamp(img, x, 20, "#fff4e0", 5);
  },
  bg_focus_lounge(img) {
    texture(img, 0, 246, img.w, 114, ["#5a4434", "#6e5644", "#826a54", "#967e66"], { scale: 4, seed: 21, contrast: 0.3, light: (_x, y) => 0.8 - (y - 246) / 150 });
    // the carpet's lattice, wider apart as it comes towards us
    for (let y = 250; y < 360; y++) {
      const k = 10 + (y - 246) * 0.18;
      for (let x = 0; x < img.w; x++) {
        const u = ((x - 320) / k + (y - 246) / k) % 2;
        const v = ((x - 320) / k - (y - 246) / k) % 2;
        if (Math.abs(u) < 0.07 || Math.abs(v) < 0.07) img.px(x, y, [60, 40, 28, 90]);
      }
    }
    wainscot(img, 204, 246, ["#6a4a34", "#5a3e2c", "#4a3224"], 90);
    skirting(img, FLOOR, "#e8d8c0");
    // the hits the Guild is proudest of, framed
    record(img, [64, 62, 52, 52], "#e8c050", "#c03a3a");
    record(img, [128, 62, 52, 52], "#d8d8e8", "#3a6ac0");
    record(img, [430, 54, 52, 52], "#e8c050", "#40a060");
    record(img, [494, 54, 52, 52], "#e8c050", "#a040c0");
    const s = rectOf("focus_lounge", "screen");
    metal(img, s[0], s[1], s[2], s[3], "#1a140e");
    vgrad(img, s[0] + 5, s[1] + 5, s[2] - 10, s[3] - 10, ["#1a3020", "#24402a", "#1a3020"]);
    img.text(s[0] + 40, s[1] + 30, "SEGMENT TESTED", "#40e080");
    img.text(s[0] + 52, s[1] + 46, "AWAITING PANEL", "#a0c0a0");
    glow(img, s[0] + s[2] / 2, s[1] + s[3] + 20, 120, 40, "#80ffb0", 0.2);
    door(img, rectOf("focus_lounge", "library_door"), ["#3a2a20", "#4a3628"], "#e8d0b0", "PRESETS");
    const cd = rectOf("focus_lounge", "conveyor_down");
    img.poly([[cd[0], cd[1] + 30], [cd[0] + cd[2], cd[1] + 40], [cd[0] + cd[2], cd[1] + cd[3]], [cd[0], cd[1] + cd[3]]], "#6e3a1c");
    foliage(img, 580, 200, 16, 24, ["#1a5a30", "#2a7a40", "#3a9a50", "#60c070"], 9);
    metal(img, 570, 222, 20, 24, "#e8d8c0");
  },

  bg_floor3_far(img) {
    bricks(img, 0, 0, img.w, 250, "#3a2014", "#1a0e08", 7, 16, 6);
    vgrad(img, 0, 0, img.w, 120, ["#0a0604", "#140c08"], (x, y) => (x * 3 + y) % 3 === 0);
  },
  bg_floor3(img) {
    floorGrime(img, 246, ["#140c08", "#22140c", "#30200f", "#3e2a14"], 13);
    const sh = rectOf("floor3", "shelves");
    metal(img, sh[0], sh[1], sh[2], sh[3], "#3a1e10");
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        metal(img, sh[0] + 4 + c * 31, sh[1] + 4 + r * 25, 28, 21, "#6e3a1c");
        img.rect(sh[0] + 12 + c * 31, sh[1] + 12 + r * 25, 12, 3, "#ffd090");
      }
    img.text(sh[0] + 6, sh[1] - 10, "PRESET LIBRARY", "#ffd090");
    const sg = rectOf("floor3", "sign");
    metal(img, sg[0], sg[1], sg[2], sg[3], "#ffd090");
    img.text(sg[0] + 4, sg[1] + 6, "ALL DOORS", "#140c08");
    img.text(sg[0] + 4, sg[1] + 14, "SIDECHAINED", "#140c08");
    img.text(sg[0] + 4, sg[1] + 22, "FOR YOUR SAFETY", "#140c08");
    speakerStack(img, rectOf("floor3", "speakers"), "#140c08", "#ff9a3a");
    const cr = rectOf("floor3", "crate");
    planks(img, cr[0], cr[1], cr[2], cr[3], ["#5a3a1a", "#7a5428", "#9a6e38"], 3);
    img.line(cr[0], cr[1], cr[0] + cr[2], cr[1] + cr[3], "#4a2a10");
    img.text(cr[0] + 2, cr[1] + 4, "FRAGILE", "#2a160c");
    const g = rectOf("floor3", "gate");
    metal(img, g[0] - 8, g[1] - 10, g[2] + 16, 10, "#6e3a1c");
    metal(img, g[0] - 8, g[1], 8, g[3], "#6e3a1c");
    metal(img, g[0] + g[2], g[1], 8, g[3], "#6e3a1c");
    lamp(img, g[0] + g[2] / 2, g[1] - 16, "#ff4030", 4);
    door(img, rectOf("floor3", "back"), ["#2a160c", "#3a2010"], "#6e3a1c");
    vignette(img, "#050302", 0.6);
  },

  bg_dominic_studio_far(img) {
    vgrad(img, 0, 0, img.w, 250, ["#1a0e08", "#2a1810", "#3a2418"]);
    for (let x = 0; x < img.w; x += 20)
      for (let y = 24; y < 220; y += 20) {
        const up = (x / 20 + y / 20) % 2 === 0;
        hgrad(img, x + 1, y + 1, 18, 18, up ? ["#4a2c1e", "#3a2018"] : ["#3a2018", "#2a160e"]);
      }
  },
  bg_dominic_studio(img) {
    planks(img, 0, 246, img.w, 114, ["#2a160e", "#3a2014", "#4a2c1c", "#5a3826"], 13);
    const c = rectOf("dominic_studio", "console");
    img.poly([[c[0], c[1] + c[3]], [c[0] + 10, c[1]], [c[0] + c[2] - 10, c[1]], [c[0] + c[2], c[1] + c[3]]], "#1e1612");
    for (let i = 0; i < 22; i++) metal(img, c[0] + 14 + i * 7.5, c[1] + 6 + ((i * 7) % 12), 5, 4, "#e8d0b0");
    const f = rectOf("dominic_studio", "fader");
    metal(img, f[0], f[1], f[2], f[3], "#ff4040");
    glow(img, f[0] + f[2] / 2, f[1] + f[3] / 2, 20, 12, "#ff4040", 0.5);
    const r = rectOf("dominic_studio", "run_of_show");
    metal(img, r[0], r[1], r[2], r[3], "#e8e4d8");
    for (let i = 0; i < 7; i++) img.rect(r[0] + 4, r[1] + 6 + i * 7, r[2] - 8 - (i % 3) * 6, 2, "#3a2a20");
    lamp(img, 318, 120, "#ffc890", 6);
    glow(img, 318, 200, 170, 80, "#ffc890", 0.18);
    door(img, rectOf("dominic_studio", "back"), ["#2a1810", "#3a2418"], "#8a5a3a");
    door(img, rectOf("dominic_studio", "stage_door"), ["#2a1810", "#3a2418"], "#8a5a3a", "STAGE");
  },

  bg_arena_outside_far(img) {
    vgrad(img, 0, 0, img.w, 250, NIGHT.concat(["#3a2a6a", "#5a3a7a"]));
    stars(img, 260, 5, 140);
    for (let y = 60; y < 250; y++)
      for (let x = 360; x < 640; x++) {
        const d = Math.hypot((x - 560) / 200, (y - 250) / 170);
        if (d > 1) continue;
        img.px(x, y, d > 0.96 ? rgba(190, 140, 255) : rgba(36 + (1 - d) * 20, 26, 80 + (1 - d) * 30));
      }
    for (let a = 0; a < 40; a++) {
      const t = Math.PI + (a / 40) * (Math.PI / 2) + 0.05;
      const x = 560 + Math.cos(t) * 196;
      const y = 250 + Math.sin(t) * 166;
      if (x > 360) lamp(img, x, y, a % 2 ? "#ff60c0" : "#a070ff", 2);
    }
  },
  bg_arena_outside(img) {
    tiles(img, 246, 360, ["#141020", "#201a30", "#2c2440", "#3a3050"], 320, 23);
    const p = rectOf("arena_outside", "poster");
    metal(img, p[0], p[1], p[2], p[3], "#ff60c0");
    vgrad(img, p[0] + 3, p[1] + 3, p[2] - 6, p[3] - 6, ["#ff8ad8", "#c03aa0"]);
    img.circle(p[0] + p[2] / 2, p[1] + 40, 20, "#ffd8ec");
    img.ellipse(p[0] + p[2] / 2, p[1] + 26, 24, 14, "#66e0ff");
    img.text(p[0] + 8, p[1] + 80, "LYRIX LIVE", "#ffffff");
    img.text(p[0] + 8, p[1] + 90, "(NOT LIVE)", "#2a1e5a");
    seal(img, p[0] + p[2] - 12, p[1] + p[3] - 12, 6);
    img.line(p[0] + 4, p[1] + 88, p[0] + 48, p[1] + 96, "#ffffff");
    door(img, rectOf("arena_outside", "dome_doors"), ["#140c2a", "#22184a"], "#a070ff", "MEGA-DOME");
    glow(img, 570, 200, 80, 60, "#a070ff", 0.25);
    const b = rectOf("arena_outside", "basement");
    metal(img, b[0], b[1], b[2], b[3], "#1a1424");
    img.text(b[0] + 4, b[1] + 4, "STORAGE", "#a070ff");
    door(img, rectOf("arena_outside", "studio_door"), ["#2a1e3a", "#3a2a4a"], "#5a3aa0", "STAGE");
    img.rect(0, 150, 36, 146, "#1a1428");
    lamp(img, 200, 120, "#ffd890", 5);
    glow(img, 200, 230, 70, 40, "#ffd890", 0.2);
  },

  bg_arena_basement_far(img) {
    bricks(img, 0, 0, img.w, 250, "#4a3a30", "#1a1210", 9, 14, 6);
    vignette(img, "#0a0806", 0.9);
  },
  bg_arena_basement(img) {
    floorGrime(img, 246, ["#1a1210", "#2a1e18", "#3a2a20", "#4a3828"], 17);
    const bx = rectOf("arena_basement", "boxes");
    texture(img, bx[0], bx[1] + 20, 50, 46, ["#6a4a2a", "#8a6a4a", "#a0805a"], { scale: 4, seed: 3, contrast: 0.3 });
    texture(img, bx[0] + 54, bx[1] + 30, 40, 36, ["#5a3a1a", "#7a5a3a", "#9a7a50"], { scale: 4, seed: 5, contrast: 0.3 });
    img.circle(bx[0] + 110, bx[1] + 10, 18, "#e8e0b0");
    img.circle(bx[0] + 116, bx[1] + 6, 14, "#1a1210");
    img.text(bx[0] + 4, bx[1] + 6, "LOVE", "#ff60c0");
    const p = rectOf("arena_basement", "piano_old");
    planks(img, p[0], p[1] - 30, p[2], p[3] + 30, ["#1e100a", "#2e1a10", "#3e2616", "#4e321e"], 3, true);
    img.rect(p[0] + 6, p[1] + 14, p[2] - 12, 9, "#ece8dc");
    for (let i = 0; i < 15; i++) img.rect(p[0] + 9 + i * 6, p[1] + 14, 2, 5, "#141010");
    metal(img, p[0] + 30, p[1] - 22, 44, 10, "#e8e4d8");
    img.text(p[0] + 32, p[1] - 20, "PLAINSONG", "#3a2414");
    lamp(img, 340, 40, "#ffd8a0", 5);
    img.line(340, 0, 340, 36, "#2a2a2a");
    beam(img, 340, 44, 20, 340, 246, 200, "#ffd8a0", 0.3);
    door(img, rectOf("arena_basement", "stairs"), ["#1a1210", "#2a1e18"], "#4a3a30");
    vignette(img, "#0a0806", 0.7);
  },

  bg_mega_dome_far(img) {
    vgrad(img, 0, 0, img.w, 260, ["#020108", "#06040e", "#0e0a22", "#1a1240", "#2a1e5a"]);
    for (let i = 0; i < 9; i++) beam(img, 60 + i * 70, 0, 8, 140 + i * 50, 220, 60, i % 2 ? "#ff60c0" : "#a070ff", 0.22);
    stars(img, 120, 9, 200, ["#ffffff", "#ff9ae8", "#a0d0ff"]);
  },
  bg_mega_dome(img) {
    img.rect(0, 210, img.w, 150, "#0c0a18");
    const st = rectOf("mega_dome", "stage");
    vgrad(img, st[0] - 40, st[1] + 10, st[2] + 80, 44, ["#3a3058", "#2a2440", "#1a1430"]);
    img.rect(st[0] - 40, st[1] + 10, st[2] + 80, 2, "#a070ff");
    for (let x = st[0] - 36; x < st[0] + st[2] + 40; x += 10) lamp(img, x, st[1] + 16, x % 20 ? "#ff60c0" : "#ffffff", 1.5);
    speakerStack(img, rectOf("mega_dome", "pa"), "#100c1c", "#ff60c0");
    const b = rectOf("mega_dome", "booth");
    metal(img, b[0], b[1], b[2], b[3], "#1a1430");
    vgrad(img, b[0] + 6, b[1] + 6, b[2] - 12, 40, ["#3a2e6a", "#5a4a8a"]);
    img.text(b[0] + 10, b[1] + b[3] - 12, "PRODUCTION", "#a070ff");
    beam(img, 343, 0, 20, 343, 250, 70, "#ffffff", 0.25);
    crowd(img, 302, "#05040a", 7, true);
  },
};

export { swan };
