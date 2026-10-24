// tools/figures.ts: characters and machines. Bobbin keeps his hood and grey cloak, his face in shadow except
// the eyes (GDD 7.5, 7.7); every figure is lit from the upper left and outlined so it reads against any room.
import { Img, hex, mix } from "./pixel";
import { glow } from "./paint";

export interface Fig {
  h: number;
  body: string;
  skin?: string;
  hair?: string;
  hairStyle?: "short" | "long" | "bun" | "ponytail" | "puffs" | "bob" | "bald";
  legs?: string;
  shoes?: string;
  accent?: string;
  headphones?: "on" | "neck";
  wide?: number;
  skirt?: boolean;
  hat?: string;
}

const light = (c: string, k = 0.22) => mix(c, "#ffffff", k);
const dark = (c: string, k = 0.32) => mix(c, "#000000", k);

/** Shades a filled shape: lighter on the left edge, darker on the right (light from the upper left). */
function shadeSides(img: Img, x0: number, x1: number, y0: number, y1: number, base: string): void {
  for (let y = y0; y <= y1; y++) {
    let first = -1;
    let last = -1;
    for (let x = x0; x <= x1; x++) {
      const c = img.get(x, y);
      if (c[3] && c[0] === hex(base)[0] && c[1] === hex(base)[1] && c[2] === hex(base)[2]) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    const w = last - first + 1;
    for (let x = first; x <= last; x++) {
      const t = (x - first) / Math.max(1, w - 1);
      if (t < 0.22) img.px(x, y, hex(light(base)));
      else if (t > 0.68) img.px(x, y, hex(dark(base, t > 0.86 ? 0.42 : 0.25)));
    }
  }
}

/** A standing person, feet on the bottom row. step -1..1 swings the legs; arm 0..1 raises the right arm. */
export function person(img: Img, ox: number, fw: number, f: Fig, step = 0, arm = 0, seated = false): void {
  const fig = new Img(fw, img.h);
  const cx = Math.floor(fw / 2);
  const bottom = img.h - 2;
  const top = bottom - f.h + 1;
  const headR = Math.max(3, Math.round(f.h * 0.075));
  const neckY = top + headR * 2;
  const w = f.wide ?? Math.round(f.h * 0.3);
  const hipY = seated ? bottom - Math.round(f.h * 0.22) : bottom - Math.round(f.h * 0.4);
  const skin = f.skin ?? "#d8a07a";
  const legs = f.legs ?? dark(f.body, 0.45);
  const shoes = f.shoes ?? "#1e1a20";
  // legs
  if (seated) {
    fig.rect(cx - w / 2 + 1, hipY, w - 2, 4, legs);
    fig.rect(cx - w / 2 + 1, hipY + 3, 4, bottom - hipY - 2, legs);
    fig.rect(cx + w / 2 - 5, hipY + 3, 4, bottom - hipY - 2, dark(legs, 0.2));
  } else if (f.skirt) {
    fig.poly([[cx - w / 2, hipY - 2], [cx + w / 2, hipY - 2], [cx + w / 2 + 3, hipY + 9], [cx - w / 2 - 3, hipY + 9]], f.body);
    fig.rect(cx - 4 + Math.round(step * 2), hipY + 9, 3, bottom - hipY - 10, skin);
    fig.rect(cx + 1 - Math.round(step * 2), hipY + 9, 3, bottom - hipY - 10, dark(skin, 0.15));
  } else {
    const lx = cx - w / 2 + 2 + Math.round(step * 3);
    const rx = cx + w / 2 - 7 - Math.round(step * 3);
    fig.rect(lx, hipY, 5, bottom - hipY, legs);
    fig.rect(rx, hipY, 5, bottom - hipY, dark(legs, 0.2));
  }
  fig.rect(cx - w / 2 + 1 + Math.round(step * 3) - (seated ? 0 : 0), bottom - 1, 6, 2, shoes);
  fig.rect(cx + w / 2 - 7 - Math.round(step * 3), bottom - 1, 6, 2, shoes);
  // torso
  fig.poly([[cx - w / 2, hipY + 1], [cx - w / 2 + 2, neckY + 3], [cx + w / 2 - 2, neckY + 3], [cx + w / 2, hipY + 1]], f.body);
  fig.rect(cx - w / 2 + 2, neckY + 2, w - 4, 3, f.body);
  if (f.accent) fig.rect(cx - w / 2 + 1, hipY - 3, w - 2, 2, f.accent);
  shadeSides(fig, 0, fw - 1, neckY + 2, hipY + 1, f.body);
  // arms
  const sh = neckY + 5;
  const larmEnd: [number, number] = [cx - w / 2 - 2, sh + Math.round(f.h * 0.3)];
  const rarmEnd: [number, number] = [cx + w / 2 + 2 + Math.round(arm * 4), sh + Math.round(f.h * 0.3) - Math.round(arm * f.h * 0.42)];
  for (let k = 0; k < 3; k++) {
    fig.line(cx - w / 2 + k, sh, larmEnd[0] + k, larmEnd[1], k === 0 ? light(f.body) : f.body);
    fig.line(cx + w / 2 - k, sh, rarmEnd[0] - k, rarmEnd[1], k === 0 ? dark(f.body) : f.body);
  }
  fig.circle(larmEnd[0] + 1, larmEnd[1] + 1, 1.5, skin);
  fig.circle(rarmEnd[0] - 1, rarmEnd[1], 1.5, skin);
  // head
  fig.rect(cx - 1, neckY - 1, 3, 4, dark(skin, 0.15));
  const hy = top + headR;
  fig.ellipse(cx, hy, headR, headR + 1, skin);
  fig.ellipse(cx + headR * 0.45, hy + 1, headR * 0.5, headR, dark(skin, 0.12));
  const hair = f.hair ?? "#2a1a14";
  switch (f.hairStyle ?? "short") {
    case "long":
      fig.ellipse(cx, hy - headR * 0.5, headR + 1, headR * 0.7, hair);
      fig.rect(cx - headR - 1, hy - 1, 2, headR * 2 + 3, hair);
      fig.rect(cx + headR - 1, hy - 1, 2, headR * 2 + 3, dark(hair, 0.2));
      break;
    case "bob":
      fig.ellipse(cx, hy - headR * 0.4, headR + 1.5, headR * 0.8, hair);
      fig.rect(cx - headR - 1, hy - 1, 2, headR + 2, hair);
      fig.rect(cx + headR - 1, hy - 1, 2, headR + 2, dark(hair, 0.2));
      break;
    case "bun":
      fig.ellipse(cx, hy - headR * 0.6, headR + 0.5, headR * 0.6, hair);
      fig.circle(cx, hy - headR - 2, 2.5, hair);
      break;
    case "ponytail":
      fig.ellipse(cx, hy - headR * 0.6, headR + 0.5, headR * 0.6, hair);
      fig.poly([[cx - headR, hy - 2], [cx - headR - 4, hy + headR + 3], [cx - headR + 1, hy + headR]], hair);
      break;
    case "puffs":
      fig.circle(cx - headR, hy - headR + 1, headR * 0.7, hair);
      fig.circle(cx + headR, hy - headR + 1, headR * 0.7, hair);
      fig.ellipse(cx, hy - headR * 0.6, headR, headR * 0.5, hair);
      break;
    case "bald":
      fig.px(cx - 1, hy - headR + 1, hex(light(skin, 0.4)));
      break;
    default:
      fig.ellipse(cx, hy - headR * 0.55, headR + 0.5, headR * 0.6, hair);
  }
  if (f.hat) {
    fig.ellipse(cx, hy - headR * 0.7, headR + 3, headR * 0.6, f.hat);
    fig.rect(cx - headR - 4, hy - headR * 0.5, headR * 2 + 8, 2, dark(f.hat, 0.2));
  }
  fig.px(cx - 1, hy, hex("#1a1012"));
  fig.px(cx + 2, hy, hex("#1a1012"));
  fig.px(cx, hy + Math.ceil(headR * 0.6), hex(dark(skin, 0.35)));
  if (f.headphones === "on") {
    fig.rect(cx - headR - 2, hy - 1, 3, 4, "#24222c");
    fig.rect(cx + headR, hy - 1, 3, 4, "#24222c");
    for (let a = 0; a <= 8; a++) {
      const t = Math.PI + (a / 8) * Math.PI;
      fig.px(cx + Math.cos(t) * (headR + 1), hy - 1 + Math.sin(t) * (headR + 2), hex("#24222c"));
    }
  } else if (f.headphones === "neck") {
    fig.rect(cx - headR - 1, neckY + 1, headR * 2 + 3, 2, "#24222c");
    fig.rect(cx - headR - 2, neckY, 3, 4, "#3a3644");
    fig.rect(cx + headR, neckY, 3, 4, "#3a3644");
  }
  fig.outline("#120e16");
  img.blit(fig, ox, 0);
}

/** Bobbin: grey cloak, hood up, face in shadow except the eyes, the Distaff in his right hand. */
export function bobbin(img: Img, ox: number, fw: number, frame: number): void {
  const fig = new Img(fw, img.h);
  const cx = Math.floor(fw / 2) - 2;
  const bottom = img.h - 2;
  const top = bottom - 62;
  const walk = frame >= 1 && frame <= 8 ? Math.sin(((frame - 1) / 8) * Math.PI * 2) : 0;
  const pose = frame === 9 ? 1 : frame === 10 ? 2 : 0;
  const cloak = "#7c7c8c";
  const pal = { hi: "#b4b4c2", mid: cloak, lo: "#56566a", deep: "#3a3a4c" };
  // legs and feet under the hem
  fig.rect(cx - 5 + Math.round(walk * 3), bottom - 4, 4, 4, "#2e2a30");
  fig.rect(cx + 2 - Math.round(walk * 3), bottom - 4, 4, 4, "#26222a");
  // cloak body: wide at the hem, swaying when walking or lifted when casting
  const hemL = cx - 11 - Math.round(walk * 1.5) - (pose ? 1 : 0);
  const hemR = cx + 11 - Math.round(walk * 1.5) + (pose ? 2 : 0);
  fig.poly([[hemL, bottom - 2], [cx - 7, top + 20], [cx - 6, top + 12], [cx + 6, top + 12], [cx + 8, top + 20], [hemR, bottom - 2]], pal.mid);
  // folds
  for (const [fx, k] of [[cx - 5, 0.3], [cx + 1, 0.5], [cx + 6, 0.7]] as const) {
    for (let y = top + 24; y < bottom - 2; y++) {
      const sway = Math.round(((y - top - 24) / 40) * walk * 2);
      fig.px(fx + sway + Math.round((y - top - 24) * (k - 0.5) * 0.12), y, hex(pal.lo));
    }
  }
  // light along the left, shadow on the right
  for (let y = top + 12; y < bottom - 2; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < fw; x++) if (fig.get(x, y)[3]) {
      if (first < 0) first = x;
      last = x;
    }
    if (first < 0) continue;
    fig.px(first, y, hex(pal.hi));
    fig.px(first + 1, y, hex(pal.hi));
    for (let x = last - 3; x <= last; x++) fig.px(x, y, hex(x >= last - 1 ? pal.deep : pal.lo));
  }
  fig.rect(hemL, bottom - 2, hemR - hemL, 1, pal.lo);
  // hood
  fig.poly([[cx - 8, top + 15], [cx - 8, top + 6], [cx - 4, top], [cx + 2, top - 1], [cx + 7, top + 4], [cx + 8, top + 15]], pal.mid);
  fig.poly([[cx - 8, top + 15], [cx - 8, top + 6], [cx - 4, top], [cx - 3, top + 2], [cx - 6, top + 9], [cx - 6, top + 15]], pal.hi);
  fig.ellipse(cx + 1, top + 9, 4.5, 5.5, "#0a080e");
  fig.px(cx - 1, top + 9, hex("#9fe4ff"));
  fig.px(cx + 3, top + 9, hex("#9fe4ff"));
  fig.px(cx - 1, top + 8, hex("#4aa8ff", 160));
  fig.px(cx + 3, top + 8, hex("#4aa8ff", 160));
  // arms and the Distaff
  const wood = "#7a5430";
  const woodHi = "#b08050";
  const staff = (x0: number, y0: number, x1: number, y1: number) => {
    fig.line(x0, y0, x1, y1, wood);
    fig.line(x0 + 1, y0, x1 + 1, y1, woodHi);
    fig.circle(x1, y1, 1.6, "#d8c8ff");
    fig.px(x1, y1, hex("#ffffff"));
  };
  if (pose === 0) {
    fig.line(cx + 6, top + 16, cx + 11, top + 34, pal.lo);
    fig.line(cx + 7, top + 16, cx + 12, top + 34, pal.mid);
    staff(cx + 15, bottom - 1, cx + 15, top + 4);
    fig.rect(cx + 12, top + 33, 4, 3, "#c8a888");
  } else if (pose === 1) {
    fig.line(cx + 6, top + 15, cx + 12, top + 2, pal.mid);
    fig.line(cx + 7, top + 15, cx + 13, top + 2, pal.hi);
    staff(cx + 9, top + 30, cx + 19, top - 12);
    fig.rect(cx + 11, top + 1, 4, 3, "#c8a888");
  } else {
    // both hands on the shaft, the Distaff held upright above the hood
    staff(cx + 9, top + 28, cx + 13, top - 15);
    fig.line(cx - 5, top + 15, cx + 9, top + 11, pal.lo);
    fig.line(cx - 5, top + 16, cx + 9, top + 12, pal.mid);
    fig.line(cx + 6, top + 15, cx + 11, top - 1, pal.mid);
    fig.line(cx + 7, top + 15, cx + 12, top - 1, pal.hi);
    fig.rect(cx + 9, top + 10, 3, 3, "#c8a888");
    fig.rect(cx + 10, top - 3, 3, 3, "#c8a888");
  }
  fig.outline("#100c16");
  img.blit(fig, ox, 0);
}

/** Where the Distaff's tip is, relative to Bobbin's feet, for each frame (used by the casting light). */
export const BOBBIN_TIP: Record<number, [number, number]> = { 0: [13, -60], 9: [17, -76], 10: [11, -79] };

export function swan(img: Img, x: number, y: number, s: number, wing: number, base = "#f2f2f6", seed = 0): void {
  const shade = mix(base, "#7a7a98", 0.35);
  const deep = mix(base, "#3a3a58", 0.45);
  img.ellipse(x, y, 10 * s, 4.6 * s, base);
  img.ellipse(x + 2 * s, y + 2 * s, 8 * s, 2.4 * s, shade);
  // neck: an S of small circles
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    img.circle(x + (7 + t * 5) * s, y - 1 - t * 8 * s + Math.sin(t * Math.PI) * 1.5 * s, 1.5 * s, base);
  }
  img.ellipse(x + 13 * s, y - 9 * s, 2.6 * s, 2 * s, base);
  img.px(x + 14 * s, y - 9.5 * s, hex("#101018"));
  img.line(x + 15 * s, y - 9 * s, x + 18 * s, y - 8 * s, "#ff9030");
  img.px(x + 15 * s, y - 8 * s, hex("#101018"));
  const wy = wing > 0 ? -9 * s : 5 * s;
  img.poly([[x - 7 * s, y - 1], [x + 5 * s, y - 1], [x - 3 * s, y + wy]], shade);
  img.line(x - 6 * s, y - 1, x - 3 * s, y + wy, deep);
  img.line(x, y - 1, x - 2 * s, y + wy * 0.8, base);
  img.poly([[x - 11 * s, y - 1], [x - 8 * s, y - 3 * s], [x - 7 * s, y + 1]], base);
  void seed;
}

export function frames(img: Img, n: number, draw: (ox: number, fw: number, i: number) => void): void {
  const fw = img.w / n;
  for (let i = 0; i < n; i++) draw(i * fw, fw, i);
}

export const FIGS: Record<string, Fig> = {
  jogger: { h: 58, body: "#3a7ac0", skin: "#b07850", hair: "#2a1810", legs: "#24242e", accent: "#9ad0ff" },
  commuter: { h: 64, body: "#5a6272", skin: "#d8a888", hair: "#4a3424", headphones: "on", legs: "#2a2a34", wide: 20 },
  receptionist: { h: 54, body: "#e85ac8", skin: "#f0c4a4", hair: "#ffe08a", hairStyle: "bob", headphones: "on", accent: "#ffd0f0" },
  lyra: { h: 60, body: "#c8683e", skin: "#e2b08a", hair: "#5a2c1a", hairStyle: "ponytail", legs: "#3a4470", accent: "#ffd8a8" },
  engineer: { h: 52, body: "#3a5a8a", skin: "#c89a78", hair: "#6a6a6a", headphones: "on", legs: "#2a2a34" },
  coach: { h: 64, body: "#9a4478", skin: "#ecc0a0", hair: "#2a1414", hairStyle: "bun", accent: "#ffd090", skirt: true },
  choreographer: { h: 62, body: "#26242e", skin: "#e0b090", hair: "#ececf4", hairStyle: "short", accent: "#ff4040" },
  juno: { h: 58, body: "#2a7a54", skin: "#8a5a3c", hair: "#1a1010", hairStyle: "puffs", headphones: "neck", accent: "#7fe0a0", legs: "#2a2a34" },
  host: { h: 62, body: "#c89a58", skin: "#ecc0a0", hair: "#7a3a1e", hairStyle: "long", accent: "#ffffff", skirt: true },
  foreman: { h: 62, body: "#f08a30", skin: "#b07850", hair: "#2a1a10", hat: "#ffd040", wide: 24, legs: "#3a3a44", accent: "#e8e8e8" },
  dominic: { h: 62, body: "#76685a", skin: "#e0b090", hair: "#a4a4a4", headphones: "neck", accent: "#ff9a3a", wide: 21 },
};

// ---- machines and props ---------------------------------------------------------------------------------------

export function metal(img: Img, x: number, y: number, w: number, h: number, base: string): void {
  img.rect(x, y, w, h, base);
  img.rect(x, y, w, 1, light(base, 0.35));
  img.rect(x, y, 1, h, light(base, 0.2));
  img.rect(x + w - 1, y, 1, h, dark(base, 0.4));
  img.rect(x, y + h - 1, w, 1, dark(base, 0.5));
  for (const [rx, ry] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) img.px(rx, ry, hex(light(base, 0.5)));
}

export function lamp(img: Img, cx: number, cy: number, c: string, r = 6): void {
  glow(img, cx, cy, r * 3, r * 3, c, 0.5);
  img.circle(cx, cy, r * 0.6, c);
  img.circle(cx - 0.5, cy - 0.5, r * 0.3, "#ffffff");
}
