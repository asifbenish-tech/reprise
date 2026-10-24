// tools/recipes.ts: placeholder drawings for every manifest entry. Rooms come from rooms.ts, close-ups from
// portraits.ts, characters and machines from figures.ts; this file maps a manifest recipe to its drawing.
import { Img, hex } from "./pixel";
import { FIGS, bobbin, cygnet, frames, lamp, metal, person, swan } from "./figures";
import { band, dither, fbm, glow, vgrad } from "./paint";
import { ROOMS } from "./rooms";
import { closeup } from "./portraits";
import { filmEarth, filmIsland, filmSwanSmall, titleSky } from "./cinema";
import { memoryFight, memoryNow, memoryStreet, memoryStreetGrey } from "./memory";

/** A clipboard held at the hand, its sheet ruled. */
function clipboard(img: Img, x: number, y: number): void {
  x = Math.round(x);
  y = Math.round(y);
  img.rect(x, y, 7, 9, "#6a4a30");
  img.rect(x + 1, y + 1, 5, 7, "#ece8dc");
  for (let k = 0; k < 3; k++) img.rect(x + 2, y + 3 + k * 2, 3, 1, "#9a96a0");
  img.rect(x + 2, y, 3, 1, "#b0b0b8");
}

const CHARS: Record<string, (img: Img, n: number) => void> = {
  bobbin(img, n) {
    frames(img, n, (ox, fw, i) => bobbin(img, ox, fw, i));
  },
  bobbin_swan(img, n) {
    frames(img, n, (ox, fw, i) => swan(img, ox + fw / 2 - 5, 20, 1.4, i % 2 ? 1 : -1, "#e4e4ee"));
    img.outline("#2a2640");
  },
  lead_swan(img, n) {
    frames(img, n, (ox, fw, i) => swan(img, ox + fw / 2 - 5, 20, 1.5, i % 2 ? 1 : -1, "#ffffff"));
    img.outline("#2a2640");
  },
  flock_flight(img, n) {
    const pos = [[132, 16], [106, 27], [80, 38], [56, 48], [104, 46], [80, 56]];
    frames(img, n, (ox, _fw, i) => pos.forEach(([x, y], k) => swan(img, ox + x, y, 1, (i + k) % 2 ? 1 : -1)));
    img.outline("#2a2640");
  },
  flock_rest(img, n) {
    frames(img, n, (ox, _fw, i) => {
      for (let k = 0; k < 6; k++) swan(img, ox + 18 + k * 34, 28 + (k % 2) * 4 + ((i + k) % 2), 1, 1, "#f0f0f6");
    });
    img.outline("#2a2a40");
  },
  skein(img, n) {
    frames(img, n, (ox, _fw, i) => cygnet(img, ox + 6, 11, i % 2));
    img.outline("#1e1a2a");
  },
  skein_sit(img, n) {
    frames(img, n, (ox, _fw, i) => cygnet(img, ox + 10 - i, 15, 0, true, "#9a9aa6"));
    img.outline("#1e1a2a");
  },
  jogger(img, n) {
    frames(img, n, (ox, fw, i) => {
      // jogging on the spot, the phone playing the hook held up in front of him
      const p = person(img, ox, fw, FIGS.jogger, Math.sin((i / n) * Math.PI * 2) * 1.2, 0.45);
      const [hx, hy] = [Math.round(p.rh[0]), Math.round(p.rh[1])];
      glow(img, hx, hy - 3, 6, 6, "#ff7ae0", 0.8);
      img.rect(hx - 1, hy - 5, 3, 5, "#2a1a2a");
      img.rect(hx - 1, hy - 4, 2, 3, "#ffb0f0");
    });
  },
  marcus(img, n) {
    frames(img, n, (ox, fw, i) => {
      const cx = ox + fw / 2;
      metal(img, cx - 9, 50, 18, 22, "#3a6aa0");
      metal(img, cx - 27, 56, 15, 16, "#b07838");
      metal(img, cx + 12, 58, 14, 14, "#c89848");
      img.ellipse(cx - 20, 56, 7, 2, "#e0c080");
      img.ellipse(cx + 19, 58, 7, 2, "#f0d090");
      const p = person(img, ox, fw, { h: 50, body: "#3a6a9a", skin: "#7a4a30", hair: "#1a1010", legs: "#3a2a20", accent: "#e8c040", headphones: "on", top: "hoodie", shoes: "#d8d0c0" }, 0, (i % 2) * 0.55, true);
      // a stick in each hand, one up while the other strikes
      const up = i % 2;
      img.line(p.lh[0], p.lh[1], cx - 20 - up * 2, 55 - (1 - up) * 9, "#ecd8a8");
      img.line(p.rh[0], p.rh[1], cx + 18 + (1 - up) * 2, 57 - up * 9, "#ecd8a8");
    });
  },
  commuter(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, { ...FIGS.commuter, h: i ? 68 : 63 }, 0, i ? 0.9 : 0));
  },
  receptionist(img, n) {
    frames(img, n, (ox, fw, i) => {
      const p = person(img, ox, fw, FIGS.receptionist);
      // the second frame blinks
      if (i) img.rect(p.head[0] - 3, p.eyeY, 6, 1, "#e0b090");
    });
  },
  lyrix_holo(img, n) {
    frames(img, n, (ox, fw, i) => {
      const fig = new Img(fw, img.h);
      person(fig, 0, fw, { h: 84, body: "#66e0ff", skin: "#c8f4ff", hair: "#ffffff", hairStyle: "long", accent: "#ff7ae0", skirt: true }, 0, (i % 2) * 0.5);
      for (let y = 0; y < img.h; y++)
        for (let x = 0; x < fw; x++) {
          const c = fig.get(x, y);
          if (!c[3]) continue;
          const a = (y + i) % 4 === 0 ? 90 : 190;
          img.px(ox + x + ((y + i * 3) % 23 === 0 ? 1 : 0), y, [c[0], c[1], c[2], a]);
        }
      glow(img, ox + fw / 2, 40, 22, 40, "#66e0ff", 0.12);
    });
  },
  lyra(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, FIGS.lyra, 0, i * 0.3));
  },
  engineer(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, FIGS.engineer, 0, i * 0.4, true));
  },
  coach(img, n) {
    frames(img, n, (ox, fw, i) => {
      const p = person(img, ox, fw, FIGS.coach, 0, i * 0.6);
      if (i) img.rect(p.mouth[0] - 1, p.mouth[1], 2, 2, "#4a1418");
    });
  },
  dancers(img, n) {
    frames(img, n, (ox, _fw, i) => {
      for (let k = 0; k < 3; k++) {
        const sub = new Img(36, img.h);
        person(sub, 0, 36, { h: 60, body: "#eceaf4", skin: "#d8c0d0", hair: "#ff7ae0", hairStyle: "bob", accent: "#66e0ff", legs: "#c0c0d8", top: "turtle", shoes: "#66e0ff" }, [-1, 1, 0.4, -0.4][i], [0, 1, 0.5, 0.2][i]);
        img.blit(sub, ox + 2 + k * 39, 0);
      }
    });
  },
  choreographer(img, n) {
    frames(img, n, (ox, fw, i) => {
      const p = person(img, ox, fw, FIGS.choreographer, 0, i);
      clipboard(img, p.lh[0] - 4, p.lh[1] - 7);
    });
  },
  juno(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, FIGS.juno, 0, i * 0.5));
  },
  host(img, n) {
    frames(img, n, (ox, fw, i) => {
      const p = person(img, ox, fw, FIGS.host, 0, 0.3 + i * 0.3);
      clipboard(img, p.lh[0] - 4, p.lh[1] - 8);
    });
  },
  foreman(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, FIGS.foreman, i ? 1 : -1, 0.6));
  },
  chairman(img, n) {
    frames(img, n, (ox, fw, i) => {
      // 0: waiting, a gold phone in hand; 1: the pen held out; 2: a step
      const p = person(img, ox, fw, FIGS.chairman, i === 2 ? 0.8 : 0, i === 1 ? 0.55 : 0);
      const [lx, ly] = [Math.round(p.lh[0]), Math.round(p.lh[1])];
      img.rect(lx - 1, ly - 4, 3, 5, "#b08a30");
      img.rect(lx - 1, ly - 4, 2, 4, "#f0d070");
      if (i === 1) {
        const [rx, ry] = [Math.round(p.rh[0]), Math.round(p.rh[1])];
        img.line(rx, ry, rx + 3, ry - 4, "#f0c040");
        img.px(rx + 3, ry - 4, [255, 248, 210, 255]);
      }
    });
  },
  dominic(img, n) {
    frames(img, n, (ox, fw, i) => person(img, ox, fw, FIGS.dominic, 0, i * 0.5));
  },
  panelists(img, n) {
    frames(img, n, (ox, _fw, i) => {
      for (let k = 0; k < 3; k++) {
        const sub = new Img(40, img.h);
        vgrad(sub, 4, 40, 32, 30, ["#8a6a50", "#6a4a34"]);
        metal(sub, 2, 30, 6, 40, "#5a3a24");
        const style = (["short", "bob", "bald"] as const)[k];
        person(sub, 0, 40, { h: 56, body: ["#c06040", "#4a80c0", "#6aa060"][k], skin: ["#e0b090", "#a87050", "#f0c8a8"][k], hair: ["#2a1a10", "#a08060", "#1a1a1a"][k], hairStyle: style, top: (["jacket", "turtle", "tee"] as const)[k], shirt: "#e8e4dc" }, 0, (i + k) % 2 ? 0.4 : 0, true);
        img.blit(sub, ox + 4 + k * 48, 0);
      }
    });
  },
  scanner(img, n) {
    frames(img, n, (ox, fw, i) => {
      const c = i ? "#40e080" : "#ff4040";
      metal(img, ox + 2, 2, fw - 4, img.h - 4, "#3a3a44");
      img.circle(ox + fw / 2, 12, 6, "#141018");
      glow(img, ox + fw / 2, 12, 9, 9, c, 0.6);
      img.circle(ox + fw / 2, 12, 3, c);
      img.rect(ox + 6, 22, fw - 12, 4, c);
    });
  },
  beat_press(img, n) {
    frames(img, n, (ox, fw, i) => {
      metal(img, ox + 4, 10, 10, img.h - 10, "#3a1e10");
      metal(img, ox + fw - 14, 10, 10, img.h - 10, "#3a1e10");
      metal(img, ox, 4, fw, 14, "#6e3a1c");
      const y = [30, 70, 96, 60][i];
      metal(img, ox + 16, 18, 6, y - 18, "#b0602a");
      metal(img, ox + fw - 22, 18, 6, y - 18, "#b0602a");
      metal(img, ox + 12, y, fw - 24, 22, "#b0602a");
      img.rect(ox + 12, y + 20, fw - 24, 3, "#ffd090");
      metal(img, ox + 8, img.h - 24, fw - 16, 24, "#4a2a16");
      img.text(ox + 20, 8, "BEAT PRESS", "#ffd090");
      if (i === 2) glow(img, ox + fw / 2, y + 30, 40, 12, "#ffd090", 0.8);
    });
  },
  conveyor(img, n) {
    frames(img, n, (ox, fw, i) => {
      metal(img, ox, 4, fw, 14, "#3a1e10");
      for (let x = -12 + i * 4; x < fw; x += 16) img.rect(ox + Math.max(0, x), 6, Math.min(10, fw - Math.max(0, x)), 10, "#6e3a1c");
      img.circle(ox + 8, 18, 5, "#b0602a");
      img.circle(ox + fw - 8, 18, 5, "#b0602a");
    });
  },
  dial(img, n) {
    frames(img, n, (ox, fw, i) => {
      metal(img, ox + fw / 2 - 1, 14, 2, 10, "#3a3a44");
      img.circle(ox + fw / 2, 8, 7, "#2a2a34");
      img.circle(ox + fw / 2, 8, 5, i ? "#40e080" : "#ff4040");
      img.line(ox + fw / 2, 8, ox + fw / 2 + (i ? 4 : -4), 4, "#ffffff");
    });
  },
  gate_park(img, n) {
    frames(img, n, (ox, fw, i) => {
      const iron = "#1e1e26";
      if (i === 0) {
        metal(img, ox, 6, fw, 4, iron);
        metal(img, ox, img.h - 8, fw, 4, iron);
        for (let x = 4; x < fw; x += 9) {
          img.rect(ox + x, 0, 3, img.h, iron);
          img.rect(ox + x, 0, 1, img.h, "#4a4a58");
          img.poly([[ox + x - 1, 4], [ox + x + 1.5, -2], [ox + x + 4, 4]], iron);
        }
        for (let a = 0; a < 40; a++) img.px(ox + fw / 2 + Math.cos((a / 40) * Math.PI * 2) * 14, img.h / 2 + Math.sin((a / 40) * Math.PI * 2) * 14, [74, 74, 88, 255]);
        metal(img, ox + fw / 2 - 5, img.h / 2 - 6, 10, 12, "#6a6a74");
      } else {
        for (const side of [0, 1]) for (let x = 0; x < 3; x++) img.rect(ox + (side ? fw - 6 - x * 4 : 2 + x * 4), 0, 3, img.h, iron);
      }
    });
  },
  gate_factory(img, n) {
    frames(img, n, (ox, fw, i) => {
      const gap = i ? fw / 2 - 6 : 0;
      metal(img, ox, 0, fw / 2 - gap, img.h, "#4a2a16");
      metal(img, ox + fw / 2 + gap, 0, fw / 2 - gap, img.h, "#4a2a16");
      for (let y = 10; y < img.h; y += 20) {
        img.rect(ox + 2, y, fw / 2 - gap - 4, 3, "#ffd090");
        img.rect(ox + fw / 2 + gap + 2, y, fw / 2 - gap - 4, 3, "#ffd090");
      }
    });
  },
  mic(img, n) {
    frames(img, n, (ox, fw, i) => {
      metal(img, ox + fw / 2 - 1, 8, 2, img.h - 8, "#2a2a34");
      img.ellipse(ox + fw / 2, 5, 3, 5, "#6a6a74");
      lamp(img, ox + fw / 2, 14, i ? "#40e080" : "#ff4040", 2);
      img.rect(ox + 1, img.h - 3, fw - 2, 3, "#2a2a34");
    });
  },
};

// ---- the Distaff (GDD 7.6): carved wood along the bottom, eight note sockets ----------------------------------

export const STAFF_W = 560;
export const STAFF_H = 44;
export const STAFF_Y = 22;
export const SOCKET_X = (i: number) => 70 + i * 60; // centre of note i inside the staff image

function distaff(img: Img): void {
  const wood = ["#2a160a", "#4a2a14", "#6e4220", "#94602e", "#b8844a", "#d8a86a"];
  // the shaft, round: light along the top, dark below, tapering to the tip
  for (let x = 26; x < STAFF_W - 4; x++) {
    const taper = x > STAFF_W - 40 ? (x - (STAFF_W - 40)) / 40 : 0;
    const half = 6 - taper * 4;
    for (let y = Math.floor(STAFF_Y - half); y <= STAFF_Y + half; y++) {
      const t = 1 - (y - (STAFF_Y - half)) / (2 * half);
      const grain = (fbm(x / 22, y / 1.6, 3) - 0.5) * 0.35;
      img.px(x, y, hex(band(wood, 0.15 + t * 0.75 + grain, x, y)));
    }
  }
  for (let x = 30; x < STAFF_W - 40; x += 6) img.line(x, STAFF_Y + 5, x + 4, STAFF_Y - 5, "#3a200e", 160);
  // the head: a carved knob the Spindle rings around
  for (let y = 0; y < STAFF_H; y++)
    for (let x = 0; x < 44; x++) {
      const d = Math.hypot((x - 20) / 18, (y - STAFF_Y) / 18);
      if (d > 1) continue;
      const l = 0.75 - ((x - 20) / 18) * 0.3 - ((y - STAFF_Y) / 18) * 0.35 - d * 0.2 + (fbm(x / 5, y / 5, 9) - 0.5) * 0.3;
      img.px(x, y, hex(band(wood, l, x, y)));
    }
  img.circle(20, STAFF_Y, 7, "#2a160a");
  img.circle(19, STAFF_Y - 1, 5, "#4a2a14");
  // eight sockets, each a hollow ring with a light lip
  for (let i = 0; i < 8; i++) {
    const cx = SOCKET_X(i);
    img.circle(cx, STAFF_Y, 10, "#2a160a");
    img.circle(cx, STAFF_Y, 9, "#b8844a");
    img.circle(cx, STAFF_Y, 8, "#6e4220");
    img.circle(cx, STAFF_Y, 6.5, "#1a0c06");
    img.circle(cx - 2, STAFF_Y - 2, 2, "#2e1a0c");
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      if (Math.cos(t) < -0.2 && Math.sin(t) < 0.2) img.px(cx + Math.cos(t) * 9, STAFF_Y + Math.sin(t) * 9, hex("#e8c08a"));
    }
  }
}

/** A crack across a lost note's socket. */
function crack(img: Img): void {
  const pts: [number, number][] = [[2, 1], [6, 5], [5, 8], [9, 11], [8, 14], [12, 15]];
  for (let i = 0; i + 1 < pts.length; i++) {
    img.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], "#0a0503");
    img.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], "#3a200e", 200);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 8, y - 8) < 6 && dither(x, y) < 0.5 && !img.get(x, y)[3]) img.px(x, y, [10, 5, 3, 180]);
}

export function draw(recipe: string, w: number, h: number, n: number): Img {
  const [kind, id] = recipe.split(":");
  if (kind === "portrait") return closeup(id);
  const img = new Img(w, h);
  if (kind === "room") {
    const fn = ROOMS[id];
    if (!fn) throw new Error(`No room recipe ${id}`);
    fn(img);
  } else if (kind === "char") {
    const fn = CHARS[id];
    if (!fn) throw new Error(`No character recipe ${id}`);
    fn(img, n);
  } else if (kind === "cinema") {
    const fn = { island: filmIsland, earth: filmEarth, title: titleSky }[id];
    if (id === "swan_small") filmSwanSmall(img, n);
    else if (fn) fn(img);
    else throw new Error(`No cinema recipe ${id}`);
  } else if (kind === "memory") {
    const fn = { street: memoryStreet, street_grey: memoryStreetGrey, fight: memoryFight, now: memoryNow }[id];
    if (!fn) throw new Error(`No memory recipe ${id}`);
    fn(img);
  } else if (kind === "ui" && id === "distaff") distaff(img);
  else if (kind === "ui" && id === "crack") crack(img);
  else throw new Error(`Unknown recipe ${recipe}`);
  return img;
}
