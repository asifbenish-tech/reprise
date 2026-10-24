// tools/memory.ts: the plates of Marcus's memory (owner direction, DECISIONS.md D-045). A street that used to hold
// every kind of music, the same street after the Producers' Guild, the fight, and the street now. Graded warm and
// grainy, like something remembered.
import { Img, hex, mix } from "./pixel";
import { band, bricks, dither, glow, rng, skyline, tiles, vgrad } from "./paint";
import { metal, person, type Fig } from "./figures";

const W = 640;
const H = 296;
const GROUND = 238;

/** A person standing (or sitting) with feet at (x, footY). */
function stand(img: Img, x: number, footY: number, f: Fig, arm = 0, seated = false): void {
  const fw = 40;
  const tmp = new Img(fw, footY + 2);
  person(tmp, 0, fw, f, 0, arm, seated);
  img.blit(tmp, Math.round(x - fw / 2), 0);
}

function street(img: Img, tower: boolean): void {
  vgrad(img, 0, 0, W, GROUND, ["#3a2a5a", "#6a3a6a", "#b0566a", "#e8865a", "#f8b86a", "#ffd890"]);
  glow(img, 330, 170, 120, 70, "#fff0c0", 0.5);
  skyline(img, 200, ["#7a4a5a", "#8a5a62"], 71, { maxH: 70, windows: "#ffe0a0" });
  if (tower) {
    // the Producers' Guild, far off: one tall tower with a ring at the top
    for (let y = 40; y < 200; y++) for (let x = 322; x <= 338; x++) img.px(x, y, hex(band(["#4a2a4a", "#5a3256"], (x - 322) / 16, x, y)));
    img.ellipse(330, 46, 16, 5, "#5a3256");
    img.circle(330, 40, 3, "#ff9ae8");
  }
  // brick buildings either side, a fire escape on the right
  bricks(img, 0, 30, 170, GROUND - 30, "#8a4a36", "#4a2a22", 72);
  bricks(img, 470, 20, 170, GROUND - 20, "#7a4038", "#40221e", 73);
  for (let y = 50; y < 200; y += 38)
    for (const x of [16, 62, 108, 490, 536, 582]) {
      img.rect(x, y, 26, 24, "#2a1a20");
      img.rect(x + 2, y + 2, 22, 20, (x + y) % 3 ? "#ffd890" : "#4a3040");
    }
  for (const y of [96, 152]) {
    img.rect(468, y, 100, 3, "#2a2028");
    for (let x = 470; x < 568; x += 6) img.rect(x, y - 14, 1, 14, "#2a2028");
  }
  // a garage with its door up, in the middle left
  img.rect(186, 150, 110, 88, "#3a2a2a");
  img.rect(192, 160, 98, 78, "#1a1214");
  img.rect(186, 150, 110, 8, "#5a4040");
  tiles(img, GROUND, H, ["#4a3a3a", "#5a4846", "#6a5652", "#7a6460"], 330, 74);
}

function musicians(img: Img): void {
  // jazz on the corner: a double bass, a saxophone, a little kit
  stand(img, 46, GROUND + 18, { h: 56, body: "#2a2a4a", skin: "#8a5a3c", hair: "#1a1010", accent: "#e8e0d0" }, 0.4);
  img.ellipse(58, GROUND - 6, 9, 16, "#8a4a20");
  img.ellipse(58, GROUND - 6, 6, 12, "#a05a28");
  img.line(58, GROUND - 22, 56, GROUND - 52, "#3a2010");
  stand(img, 96, GROUND + 20, { h: 54, body: "#4a2a2a", skin: "#c89070", hair: "#3a2414", accent: "#f0c040" }, 0.8);
  img.line(100, GROUND - 20, 106, GROUND - 2, "#e8b830");
  img.line(101, GROUND - 20, 107, GROUND - 2, "#ffd860");
  img.circle(106, GROUND, 3, "#e8b830");
  stand(img, 140, GROUND + 22, { h: 50, body: "#2a3a2a", skin: "#d8a888", hair: "#5a3a20" }, 0.6, true);
  img.ellipse(140, GROUND + 14, 10, 5, "#c8c0b0");
  img.ellipse(126, GROUND + 6, 5, 2, "#e8d080");
  // rock in the garage: a red guitar and an amp
  img.rect(258, GROUND - 26, 22, 26, "#141014");
  img.rect(261, GROUND - 23, 16, 16, "#2a2428");
  stand(img, 228, GROUND + 16, { h: 58, body: "#1a1a1a", skin: "#e0b090", hair: "#1a1010", hairStyle: "long", legs: "#2a3a6a" }, 1);
  img.ellipse(234, GROUND - 18, 8, 5, "#c02020");
  img.line(238, GROUND - 20, 252, GROUND - 32, "#3a2010");
  // a DJ at two turntables
  metal(img, 368, GROUND - 14, 58, 14, "#2a2a32");
  img.circle(382, GROUND - 16, 6, "#141018");
  img.circle(412, GROUND - 16, 6, "#141018");
  stand(img, 397, GROUND + 4, { h: 56, body: "#e0a020", skin: "#6a4028", hair: "#1a1010", headphones: "neck" }, 0.5);
  // a fiddle on the fire escape
  stand(img, 520, 152, { h: 46, body: "#5a7a3a", skin: "#e8c0a0", hair: "#c8a050", hairStyle: "bun" }, 1);
  img.ellipse(528, 116, 4, 2, "#8a4a20");
  img.line(522, 112, 536, 120, "#e8d8b0");
  // a singer at a microphone
  stand(img, 588, GROUND + 18, { h: 58, body: "#a02a6a", skin: "#a06a48", hair: "#2a1414", hairStyle: "puffs", skirt: true }, 1);
  img.line(574, GROUND + 18, 574, GROUND - 30, "#2a2a2a");
  img.circle(574, GROUND - 32, 2, "#5a5a5a");
}

/** Warm, grainy, vignetted: the look of something remembered. */
function remember(img: Img, warmth = 0.32, seed = 75): void {
  const r = rng(seed);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = img.get(x, y);
      if (!c[3]) continue;
      const l = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) / 255;
      const sepia = hex(mix("#2a1a10", "#ffe8c0", l));
      const k = warmth;
      const grain = (r() - 0.5) * 14;
      const v = [0, 1, 2].map((i) => Math.max(0, Math.min(255, c[i] * (1 - k) + sepia[i] * k + grain)));
      const dx = (x / img.w - 0.5) * 2;
      const dy = (y / img.h - 0.5) * 2;
      const vig = Math.max(0, Math.hypot(dx * 0.85, dy) - 0.75);
      img.px(x, y, [v[0], v[1], v[2], 255]);
      if (vig * 1.6 > dither(x, y)) img.px(x, y, hex("#1a0e08"));
    }
}

/** Every colour pressed out of it, and a pink glow from the tower. */
function drained(img: Img): void {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const c = img.get(x, y);
      const l = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) * 0.72;
      img.px(x, y, [l, l, Math.min(255, l * 1.06), 255]);
    }
  glow(img, 330, 40, 160, 90, "#ff7ae0", 0.35);
}

export function memoryStreet(img: Img): void {
  street(img, true);
  musicians(img);
  remember(img);
}

export function memoryStreetGrey(img: Img): void {
  street(img, true);
  musicians(img);
  drained(img);
  remember(img, 0.18, 76);
}

export function memoryFight(img: Img): void {
  vgrad(img, 0, 0, W, GROUND, ["#1a1028", "#2a1838", "#3a2040", "#4a2848"]);
  skyline(img, 210, ["#22162e", "#2a1c38"], 77, { maxH: 90, windows: "#ffb070" });
  tiles(img, GROUND, H, ["#2a2230", "#342a38", "#3e3242", "#48404a"], 300, 78);
  // the wall of speakers, pink and humming
  for (let y = 30; y < GROUND + 10; y += 34)
    for (let x = 430; x < W; x += 34) {
      metal(img, x, y, 32, 32, "#1a141e");
      img.circle(x + 16, y + 16, 11, "#2a2030");
      img.circle(x + 16, y + 16, 6, "#ff7ae0");
      img.circle(x + 16, y + 16, 3, "#3a1030");
    }
  glow(img, 520, 140, 160, 140, "#ff7ae0", 0.3);
  // the musicians, side by side
  const players: [number, Fig][] = [
    [60, { h: 56, body: "#2a2a4a", skin: "#8a5a3c", hair: "#1a1010" }],
    [110, { h: 58, body: "#1a1a1a", skin: "#e0b090", hair: "#1a1010", hairStyle: "long", legs: "#2a3a6a" }],
    [160, { h: 52, body: "#5a7a3a", skin: "#e8c0a0", hair: "#c8a050", hairStyle: "bun" }],
    [210, { h: 56, body: "#e0a020", skin: "#6a4028", hair: "#1a1010", headphones: "neck" }],
    [260, { h: 58, body: "#a02a6a", skin: "#a06a48", hair: "#2a1414", hairStyle: "puffs", skirt: true }],
    [310, { h: 52, body: "#a05a30", skin: "#7a4a30", hair: "#1a1010", legs: "#3a2a20" }],
  ];
  for (const [x, f] of players) stand(img, x, GROUND + 22, f, 1);
  remember(img, 0.22, 79);
}

export function memoryNow(img: Img): void {
  street(img, true);
  drained(img);
  // only Marcus is left with any colour in him: buckets, headphones on
  const cx = 300;
  metal(img, cx - 9, GROUND - 8, 18, 22, "#3a6aa0");
  metal(img, cx - 28, GROUND - 2, 15, 16, "#b07838");
  stand(img, cx, GROUND + 12, { h: 50, body: "#3a6a9a", skin: "#7a4a30", hair: "#1a1010", legs: "#3a2a20", accent: "#e8c040", headphones: "on" }, 0.8, true);
  glow(img, cx, GROUND - 20, 60, 50, "#ffd27a", 0.3);
  remember(img, 0.15, 80);
}
