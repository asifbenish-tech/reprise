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
  /** What the body colour is: a tee (short sleeves), an open jacket or coat over a shirt, a hoodie, a
   *  high-visibility vest over a shirt, a turtleneck, or a dress (with skirt). */
  top?: "tee" | "jacket" | "coat" | "hoodie" | "vest" | "turtle" | "dress";
  /** The shirt under an open jacket, coat or vest. */
  shirt?: string;
}

/** Where a drawn person's hands and head ended up, for props placed after. */
export interface Pose {
  lh: [number, number];
  rh: [number, number];
  head: [number, number];
  /** the row the eyes are on, and the middle of the mouth */
  eyeY: number;
  mouth: [number, number];
}

const light = (c: string, k = 0.22) => mix(c, "#ffffff", k);
const dark = (c: string, k = 0.32) => mix(c, "#000000", k);
const INK = "#120e16";

/** Four tones of one colour: warm in the light, violet in the shade, as in the close-ups. */
interface Tones {
  hi: string;
  mid: string;
  lo: string;
  deep: string;
}
const tones = (c: string): Tones => ({ hi: mix(c, "#fff0d8", 0.3), mid: c, lo: mix(c, "#2a1638", 0.36), deep: mix(c, "#120a1e", 0.6) });
const toHex = (c: number[]) => "#" + c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
const on = (img: Img, x: number, y: number) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.get(x, y)[3] > 0;
const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Shades the flat base colour of one body part like a rounded volume lit from the upper left: a lit
 *  left edge and top, the shade side on the right, the underside darker. Other colours are left alone. */
function volume(part: Img, t: Tones): void {
  const base = hex(t.mid);
  const out: [number, number, string][] = [];
  for (let y = 0; y < part.h; y++)
    for (let x = 0; x < part.w; ) {
      if (!on(part, x, y)) {
        x++;
        continue;
      }
      let e = x;
      while (on(part, e + 1, y)) e++;
      const w = e - x + 1;
      for (let i = x; i <= e; i++) {
        if (!same(part.get(i, y), base)) continue;
        const u = (i - x + 0.5) / w;
        let c: keyof Tones = "mid";
        if (w >= 3 && (i === x || (w >= 9 && u < 0.17))) c = "hi";
        if (w >= 3 && u > 0.7) c = "lo";
        if (w >= 6 && u > 0.88) c = "deep";
        if (!on(part, i, y - 1) && c === "mid" && u < 0.62) c = "hi";
        if (!on(part, i, y + 1) && c !== "deep") c = "lo";
        out.push([i, y, t[c]]);
      }
      x = e + 1;
    }
  for (const [x, y, c] of out) part.px(x, y, hex(c));
}

/** Lays a part over the figure; where its edge sits on parts already drawn, the edge darkens into a line. */
function stack(fig: Img, part: Img): void {
  const edge: [number, number][] = [];
  for (let y = 0; y < part.h; y++)
    for (let x = 0; x < part.w; x++) {
      if (!on(part, x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!on(part, x + dx, y + dy) && on(fig, x + dx, y + dy)) {
          edge.push([x, y]);
          break;
        }
    }
  fig.blit(part, 0, 0);
  for (const [x, y] of edge) fig.px(x, y, hex(mix(toHex(part.get(x, y)), INK, 0.45)));
}

/** A coloured outline: each edge pixel takes a dark shade of what it borders, deeper on the shadow side. */
function selout(fig: Img): void {
  const add: [number, number, string][] = [];
  for (let y = 0; y < fig.h; y++)
    for (let x = 0; x < fig.w; x++) {
      if (on(fig, x, y)) continue;
      // the shape lies right of or below this pixel: we are on its lit side
      for (const [dx, dy, k] of [[1, 0, 0.66], [0, 1, 0.7], [-1, 0, 0.84], [0, -1, 0.84]] as const)
        if (on(fig, x + dx, y + dy)) {
          add.push([x, y, mix(toHex(fig.get(x + dx, y + dy)), INK, k)]);
          break;
        }
    }
  for (const [x, y, c] of add) fig.px(x, y, hex(c));
}

/** A thick stroke from a to b, its radius going from ra to rb. */
function limb(img: Img, a: [number, number], b: [number, number], ra: number, rb: number, c: string): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const r = Math.max(ra, rb);
  for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.max(y0, y1) + r + 1; y++)
    for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.max(x0, x1) + r + 1; x++) {
      const u = Math.max(0, Math.min(1, ((x + 0.5 - x0) * (x1 - x0) + (y + 0.5 - y0) * (y1 - y0)) / (len * len)));
      const d = Math.hypot(x + 0.5 - (x0 + u * (x1 - x0)), y + 0.5 - (y0 + u * (y1 - y0)));
      if (d <= ra + (rb - ra) * u) img.px(x, y, hex(c));
    }
}

/** Two-bone reach: the elbow for a hand at `to`, bent away from the body and kept inside the frame. */
function elbow(s: [number, number], to: [number, number], l1: number, l2: number, out: number, fw: number): [number, number] {
  const dx = to[0] - s[0];
  const dy = to[1] - s[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1))));
  const pick = [a + b, a - b].map((t) => [s[0] + Math.cos(t) * l1, s[1] + Math.sin(t) * l1] as [number, number]);
  pick.sort((p, q) => (q[0] - p[0]) * out);
  const e = pick[0];
  return [Math.max(2, Math.min(fw - 3, e[0])), e[1]];
}

/** A person facing us, feet on the bottom row, lit from the upper left. step -1..1 lifts one foot or the
 *  other; arm 0..1 raises the right hand from the hip towards the head. Returns where the hands are. */
export function person(img: Img, ox: number, fw: number, f: Fig, step = 0, arm = 0, seated = false): Pose {
  const fig = new Img(fw, img.h);
  const cx = Math.floor(fw / 2); // the axis falls between pixels cx-1 and cx
  const bottom = img.h - 2;
  const top = bottom - f.h + 1;
  // a seated body has the proportions of the standing person it would be
  const H = seated ? Math.round(f.h * 1.24) : f.h;
  const headH = Math.max(7, Math.round(H * 0.15));
  const hw = Math.max(3, Math.round(headH * 0.42));
  const chinY = top + headH - 1;
  const shY = chinY + Math.max(2, Math.round(H * 0.035));
  const sw = 2 * Math.round((f.wide ?? Math.round(H * 0.3)) / 2);
  const half = sw / 2;
  const waistY = top + Math.round(H * 0.45);
  const hipY = top + Math.round(H * (seated ? 0.52 : 0.55));
  const top_ = f.top ?? (f.skirt ? "dress" : "tee");
  const skin = f.skin ?? "#d8a07a";
  const hair = f.hair ?? "#2a1a14";
  const legs = f.legs ?? (f.skirt ? skin : dark(f.body, 0.45));
  const shoes = f.shoes ?? "#1e1a20";
  const shirt = f.shirt ?? f.accent ?? "#e8e4dc";
  const cloth = top_ === "vest" ? shirt : f.body;
  const S = tones(skin);
  const part = () => new Img(fw, img.h);

  // ---- hair that hangs behind the body
  const style = f.hairStyle ?? "short";
  if (style === "long" || style === "ponytail") {
    const back = part();
    const end = shY + Math.round(H * 0.1);
    if (style === "long") back.poly([[cx - hw - 1, top + 2], [cx + hw + 1, top + 2], [cx + hw + 2, end - 2], [cx + hw, end], [cx - hw, end], [cx - hw - 2, end - 2]], hair);
    else limb(back, [cx + hw, top + 2], [cx + hw + 2, shY + 5], 1.6, 1, hair);
    volume(back, tones(dark(hair, 0.15)));
    stack(fig, back);
  }

  // ---- legs and shoes
  const legL = part();
  const legR = part();
  const ankle = Math.max(2, Math.round(sw * (f.skirt ? 0.12 : 0.18)));
  const liftL = Math.round(Math.max(0, step) * 3);
  const liftR = Math.round(Math.max(0, -step) * 3);
  const foot = (leg: Img, side: -1 | 1, lift: number) => {
    const inner = side < 0 ? cx - 1 : cx;
    if (seated) {
      // the lap seen from the front, then shins straight down
      const lx = side < 0 ? cx - half + 2 : cx + 1;
      leg.rect(side < 0 ? cx - half + 1 : cx, hipY, half - 1, 3, legs);
      leg.rect(lx, hipY + 3, ankle + 1, bottom - hipY - 4, legs);
      return [lx, lx + ankle] as [number, number];
    }
    const gap = f.skirt ? 1 : 1 + Math.round(sw / 16);
    const top0 = f.skirt ? hipY + 4 : hipY;
    const thigh = f.skirt ? ankle + 1 : half - 1;
    const ay = bottom - 2 - lift;
    const knee = Math.round((top0 + ay) / 2);
    const a0 = side < 0 ? inner - gap - ankle + 1 : inner + gap;
    const kx = side * Math.round(lift / 2);
    const pts: [number, number][] =
      side < 0
        ? [[inner - thigh + 1, top0], [inner + 1, top0], [inner + 1 - gap + 1, knee], [a0 + ankle, ay + 1], [a0, ay + 1], [inner - thigh + kx + 1, knee]]
        : [[inner, top0], [inner + thigh, top0], [inner + thigh + kx, knee], [a0 + ankle, ay + 1], [a0, ay + 1], [inner + gap - 1, knee]];
    leg.poly(pts, legs);
    return [a0, a0 + ankle - 1] as [number, number];
  };
  const feetL = foot(legL, -1, liftL);
  const feetR = foot(legR, 1, liftR);
  volume(legL, tones(legs));
  volume(legR, tones(legs));
  const shoe = (leg: Img, [a, b]: [number, number], side: -1 | 1, lift: number) => {
    const y = bottom - 1 - lift;
    const x0 = side < 0 ? a - 1 : a;
    const x1 = side < 0 ? b : b + 1;
    leg.rect(x0, y, x1 - x0 + 1, 2, shoes);
    leg.rect(x0, y + 1, x1 - x0 + 1, 1, mix(shoes, "#000000", 0.4));
    leg.px(x0 + (side < 0 ? 1 : 0), y, hex(mix(shoes, "#ffffff", 0.3)));
  };
  shoe(legL, feetL, -1, liftL);
  shoe(legR, feetR, 1, liftR);
  stack(fig, legL);
  stack(fig, legR);

  // ---- neck
  const neck = part();
  neck.rect(cx - 2, chinY - 1, 4, shY - chinY + 3, skin);
  neck.rect(cx, chinY, 2, shY - chinY + 2, S.lo);
  neck.rect(cx - 2, chinY + 1, 4, 1, S.lo);
  stack(fig, neck);

  // ---- torso, with a coat's tails or a dress's skirt
  const torso = part();
  const hemY = top_ === "coat" ? hipY + Math.round(H * 0.17) : f.skirt ? hipY + Math.round(H * 0.16) : hipY;
  const flare = f.skirt ? 3 : top_ === "coat" ? 1 : 0;
  torso.poly(
    [
      [cx - half + 2, shY], [cx + half - 2, shY], [cx + half, shY + 2], [cx + half, shY + 5], [cx + half - 2, waistY],
      [cx + half - 1, hipY], [cx + half + flare, hemY + 1], [cx - half - flare, hemY + 1], [cx - half + 1, hipY], [cx - half + 2, waistY],
      [cx - half, shY + 5], [cx - half, shY + 2],
    ],
    cloth,
  );
  if (top_ === "vest") {
    // the vest's two panels over the shirt
    torso.poly([[cx - half + 1, shY + 1], [cx - 2, shY + 3], [cx - 2, hipY], [cx - half + 2, hipY], [cx - half + 2, waistY], [cx - half, shY + 5]], f.body);
    torso.poly([[cx + 1, shY + 3], [cx + half - 2, shY + 1], [cx + half, shY + 5], [cx + half - 2, waistY], [cx + half - 2, hipY], [cx + 1, hipY]], f.body);
  }
  volume(torso, tones(cloth));
  if (top_ === "vest") volume(torso, tones(f.body));
  const B = tones(f.body);
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (const [x, y] of seg(x0, y0, x1, y1)) if (on(torso, x, y)) torso.px(x, y, hex(c));
  };
  switch (top_) {
    case "jacket":
    case "coat": {
      // open at the front over the shirt, lapels folded back
      const sh = tones(shirt);
      for (let y = shY; y <= (top_ === "coat" ? waistY + 2 : hipY); y++) {
        const w = Math.min(2, 1 + Math.floor((y - shY) / 3));
        for (let x = cx - w; x < cx + w; x++) torso.px(x, y, hex(x < cx - 1 ? sh.hi : x >= cx + 1 ? sh.lo : sh.mid));
      }
      line(cx - 3, shY, cx - 3, shY + 5, B.hi);
      line(cx + 2, shY, cx + 2, shY + 5, B.deep);
      if (top_ === "coat") {
        torso.px(cx - 3, shY - 1, hex(B.hi));
        torso.px(cx + 2, shY - 1, hex(B.lo));
        line(cx - half + 2, waistY, cx + half - 3, waistY, B.deep);
        line(cx - 1, waistY + 3, cx - 1, hemY, B.deep);
      }
      if (f.accent && top_ === "jacket") torso.px(cx - half + 3, waistY + 2, hex(f.accent));
      break;
    }
    case "hoodie": {
      line(cx - 3, shY, cx + 2, shY, B.lo);
      line(cx - 2, shY + 1, cx - 2, shY + 3, f.accent ?? B.hi);
      line(cx + 1, shY + 1, cx + 1, shY + 3, f.accent ?? B.hi);
      line(cx - 4, waistY + 1, cx + 3, waistY + 1, B.lo);
      line(cx - 4, waistY + 1, cx - 5, hipY - 1, B.lo);
      line(cx + 3, waistY + 1, cx + 4, hipY - 1, B.deep);
      line(cx - half + 1, hipY, cx + half - 2, hipY, B.lo);
      break;
    }
    case "vest": {
      const r = f.accent ?? "#e8e8e8";
      line(cx - half + 2, waistY - 3, cx - 2, waistY - 3, r);
      line(cx + 1, waistY - 3, cx + half - 2, waistY - 3, mix(r, "#000000", 0.25));
      line(cx - half + 2, waistY + 2, cx - 2, waistY + 2, r);
      line(cx + 1, waistY + 2, cx + half - 2, waistY + 2, mix(r, "#000000", 0.25));
      break;
    }
    case "turtle":
      break;
    case "dress":
      line(cx - half + 2, waistY, cx + half - 3, waistY, f.accent ?? B.lo);
      for (const fx of [cx - 4, cx + 2]) line(fx, hipY + 2, fx + Math.sign(fx - cx + 0.5) * 2, hemY - 1, B.lo);
      break;
    default:
      if (f.accent) line(cx - half + 2, hipY - 1, cx + half - 3, hipY - 1, f.accent);
      line(cx - half + 3, shY + 6, cx - half + 4, shY + 9, B.lo);
  }
  // the neckline
  if (top_ === "turtle") {
    const collar = part();
    collar.rect(cx - 3, shY - 2, 6, 3, f.body);
    volume(collar, B);
    stack(torso, collar);
  } else if (top_ === "tee" || top_ === "dress" || top_ === "hoodie") {
    torso.rect(cx - 2, shY, 4, 1, S.lo);
    torso.rect(cx - 1, shY + 1, 2, 1, S.lo);
  }
  stack(fig, torso);

  // ---- head
  const head = part();
  const hy = top + headH / 2;
  const rows: [number, number][] = [];
  for (let j = 0; j < headH; j++) {
    const v = ((j + 0.5) / headH) * 2 - 1;
    const k = v < 0 ? Math.pow(1 - Math.pow(-v, 2.6), 1 / 2.6) : Math.pow(1 - Math.pow(v, 1.7), 1 / 1.7) * (1 - 0.12 * v);
    const w = Math.max(1, Math.round(hw * k));
    rows.push([cx - w, cx + w - 1]);
    head.rect(cx - w, top + j, 2 * w, 1, skin);
  }
  for (let j = 0; j < headH; j++) {
    const [a, b] = rows[j];
    head.px(a, top + j, hex(S.hi));
    if (b - a >= 4) head.px(b - 1, top + j, hex(mix(skin, S.lo, 0.5)));
    head.px(b, top + j, hex(S.lo));
  }
  head.rect(rows[headH - 1][0], chinY, rows[headH - 1][1] - rows[headH - 1][0] + 1, 1, S.lo);
  const eyeY = top + Math.floor(headH * 0.45);
  const mouthY = eyeY + Math.max(2, Math.round(headH * 0.26));
  const ex = Math.max(1, Math.round(hw * 0.5));
  const big = headH >= 12;
  for (const x of [cx - 1 - ex, cx + ex]) {
    if (big) head.px(x + (x < cx ? -1 : 1), eyeY, hex("#f0e8e4"));
    head.px(x, eyeY, hex("#1a1012"));
    if (headH >= 9) head.px(x, eyeY - 2, hex(mix(hair, skin, 0.35)));
  }
  head.px(cx, eyeY + 1, hex(S.lo));
  if (headH >= 9) head.px(cx, eyeY + 2, hex(S.lo));
  const lip = mix(skin, "#7a2030", 0.42);
  head.rect(cx - 1, mouthY, 2, 1, lip);
  if (headH >= 10) head.px(cx - 2, mouthY, hex(mix(lip, skin, 0.5)));
  const ears = f.headphones !== "on" && style !== "long" && style !== "bob";
  if (ears) for (const x of [rows[Math.floor(headH / 2)][0] - 1, rows[Math.floor(headH / 2)][1] + 1]) head.rect(x, eyeY, 1, 2, x < cx ? skin : S.lo);
  stack(fig, head);

  // ---- hair (or a hard hat)
  const H_ = part();
  const capRows = Math.max(2, Math.round(headH * 0.3));
  for (let j = -1; j < capRows; j++) {
    const [a, b] = rows[Math.max(0, j)];
    const grow = j < 0 ? -1 : 1;
    H_.rect(a - grow, top + j, b - a + 1 + 2 * grow, 1, hair);
  }
  const side = (to: number, wide: number) => {
    const widest = rows[Math.floor(headH / 2)];
    for (let y = top + capRows; y <= to; y++) {
      // below the cheekbones the hair falls straight instead of following the jaw
      const [a, b] = y - top > headH / 2 ? widest : rows[y - top];
      H_.rect(a - 1, y, wide, 1, hair);
      H_.rect(b + 2 - wide, y, wide, 1, hair);
    }
  };
  switch (style) {
    case "bald":
      H_.data.fill(0);
      head.px(cx - 2, top + 1, hex(mix(skin, "#ffffff", 0.35)));
      break;
    case "long":
      side(shY + 1, 2);
      break;
    case "bob":
      side(chinY, 2);
      for (let x = rows[capRows][0]; x <= rows[capRows][1]; x++) if ((x + cx) % 3) H_.px(x, top + capRows, hex(hair));
      break;
    case "bun":
      H_.ellipse(cx, top - 2, 2.6, 2.2, hair);
      side(eyeY - 1, 1);
      break;
    case "ponytail":
      side(eyeY - 1, 1);
      break;
    case "puffs":
      H_.circle(cx - hw, top + 0.5, Math.max(2.2, hw * 0.72), hair);
      H_.circle(cx + hw, top + 0.5, Math.max(2.2, hw * 0.72), hair);
      break;
    default:
      side(eyeY - 1, 1);
      H_.px(cx - 2, top + capRows, hex(hair));
      H_.px(cx + 1, top + capRows, hex(hair));
  }
  if (style !== "bald") {
    const T = tones(hair);
    volume(H_, T);
    // a lit sheen on the crown, towards the light
    const sheen = hex(mix(T.hi, "#ffffff", 0.15));
    H_.px(rows[0][0] + 1, top, sheen);
    H_.px(rows[0][0] + 2, top, sheen);
    H_.px(rows[1][0], top + 1, sheen);
    stack(fig, H_);
  }
  if (f.hat) {
    const hat = part();
    // a hard hat sits on the crown: a dome, then the brim just above the brows
    const brim = top + capRows - 1;
    hat.ellipse(cx, brim, hw + 1, capRows + 2, f.hat);
    hat.data.fill(0, (brim + 1) * fw * 4);
    volume(hat, tones(f.hat));
    hat.rect(cx - hw - 2, brim, 2 * hw + 4, 1, f.hat);
    hat.rect(cx - hw - 2, brim + 1, 2 * hw + 4, 1, tones(f.hat).lo);
    stack(fig, hat);
  }
  if (f.headphones) {
    const ph = part();
    const metal = "#2c2a34";
    const cupY = f.headphones === "on" ? eyeY - 1 : shY - 1;
    const [a, b] = f.headphones === "on" ? [rows[Math.floor(headH / 2)][0] - 2, rows[Math.floor(headH / 2)][1] + 1] : [cx - hw - 1, cx + hw - 1];
    if (f.headphones === "on") {
      for (let x = a + 1; x <= b; x++) {
        const u = (x - (a + b + 1) / 2) / ((b - a) / 2);
        ph.px(x, Math.round(top - 1 - (1 - u * u) * 1.2 + Math.max(0, Math.abs(u) - 0.6) * 6), hex(metal));
      }
    } else ph.rect(a + 1, shY, b - a, 1, metal);
    for (const x of [a, b]) {
      ph.rect(x, cupY, 2, 3, metal);
      ph.px(x, cupY, hex("#56525e"));
    }
    if (f.accent) ph.px(b + 1, cupY + 1, hex(f.accent));
    stack(fig, ph);
  }

  // ---- arms: shoulder, elbow, hand
  const ua = H * 0.19;
  const fa = H * 0.17;
  const ra = Math.max(1.4, sw * 0.1);
  const sleeve = top_ === "tee" || top_ === "dress" ? "short" : "long";
  const drawArm = (s: [number, number], hand: [number, number], out: -1 | 1) => {
    const a = part();
    const e = elbow(s, hand, ua, fa, out, fw);
    const sl = sleeve === "short" ? skin : cloth;
    limb(a, s, e, ra, ra * 0.9, cloth);
    limb(a, e, hand, ra * 0.85, ra * 0.7, sl);
    if (sleeve === "short") limb(a, s, [s[0] + (e[0] - s[0]) * 0.5, s[1] + (e[1] - s[1]) * 0.5], ra + 0.3, ra, cloth);
    volume(a, tones(cloth));
    if (sl !== cloth) volume(a, S);
    a.circle(hand[0], hand[1] + 0.5, Math.max(1.2, ra * 0.75), skin);
    a.px(Math.round(hand[0]) + (out > 0 ? 0 : -1), Math.round(hand[1]) + 1, hex(S.lo));
    stack(fig, a);
  };
  const ls: [number, number] = [cx - half + 1.5, shY + 2.5];
  const rs: [number, number] = [cx + half - 1.5, shY + 2.5];
  const reach = ua + fa - 1;
  const lh: [number, number] = [ls[0] - 1.5, ls[1] + reach];
  const down: [number, number] = [rs[0] + 1.5, rs[1] + reach];
  const up: [number, number] = [Math.min(fw - 3, rs[0] + 3), top + headH * 0.4];
  const t = Math.max(0, Math.min(1, arm));
  const rh: [number, number] = [down[0] + (up[0] - down[0]) * t + Math.sin(t * Math.PI) * 2, down[1] + (up[1] - down[1]) * t];
  drawArm(ls, lh, -1);
  drawArm(rs, [Math.min(fw - 3, rh[0]), rh[1]], 1);

  selout(fig);
  img.blit(fig, ox, 0);
  return { lh: [ox + lh[0], lh[1]], rh: [ox + Math.min(fw - 3, rh[0]), rh[1]], head: [ox + cx, hy], eyeY, mouth: [ox + cx, mouthY] };
}

/** The pixels of a straight line, end points included. */
function seg(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) out.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
  return out;
}

/** Bobbin: grey cloak, hood up, face in shadow except the eyes, the Distaff in his right hand. */
export function bobbin(img: Img, ox: number, fw: number, frame: number): void {
  const fig = new Img(fw, img.h);
  const cx = Math.floor(fw / 2) - 2;
  const bottom = img.h - 2;
  // frame 11: down on one knee, spent, leaning on the Distaff
  const kneel = frame === 11;
  const top = bottom - (kneel ? 46 : 62);
  const walk = frame >= 1 && frame <= 8 ? Math.sin(((frame - 1) / 8) * Math.PI * 2) : 0;
  const pose = frame === 9 ? 1 : frame === 10 ? 2 : kneel ? 3 : 0;
  const cloak = "#7c7c8c";
  const C = { hi: "#b4b4c2", mid: cloak, lo: "#56566a", deep: "#3a3a4c" };
  const part = () => new Img(fw, img.h);
  // feet under the hem
  const feet = part();
  if (!kneel) {
    feet.rect(cx - 5 + Math.round(walk * 3), bottom - 3, 4, 3, "#2e2a30");
    feet.rect(cx + 2 - Math.round(walk * 3), bottom - 3, 4, 3, "#26222a");
    feet.px(cx - 5 + Math.round(walk * 3), bottom - 3, hex("#4a4450"));
  }
  stack(fig, feet);
  // the robe: wide at the hem, swaying when walking, spread when casting or kneeling
  const robe = part();
  const hemL = cx - 11 - Math.round(walk * 1.5) - (pose ? 1 : 0) - (kneel ? 3 : 0);
  const hemR = cx + 11 - Math.round(walk * 1.5) + (pose ? 2 : 0) + (kneel ? 3 : 0);
  const hemY = bottom - 2;
  robe.poly([[hemL, hemY + 1], [cx - 7, top + 20], [cx - 6, top + 12], [cx + 6, top + 12], [cx + 8, top + 20], [hemR, hemY + 1]], cloak);
  volume(robe, C);
  const beltY = top + (kneel ? 24 : 30);
  // folds hang from the belt and spread towards the hem: a shadow with light beside it
  for (const [k, spread] of [[-6, -0.16], [-1, -0.04], [4, 0.1]] as const)
    for (let y = beltY + 2; y < hemY; y++) {
      const u = (y - beltY) / (hemY - beltY);
      const x = Math.round(cx + k + spread * (y - beltY) + Math.sin(u * Math.PI) * walk * 1.5);
      if (on(robe, x, y) && on(robe, x - 1, y)) {
        robe.px(x, y, hex(C.lo));
        if (u > 0.15) robe.px(x - 1, y, hex(C.hi));
      }
    }
  // the hem's lining shows as it swings
  for (let x = hemL; x <= hemR; x++) if (on(robe, x, hemY)) robe.px(x, hemY, hex((x + frame) % 5 ? C.deep : C.lo));
  // a cord at the waist, knotted on the lit side, its ends hanging
  for (let x = cx - 8; x <= cx + 9; x++) if (on(robe, x, beltY)) robe.px(x, beltY, hex(x < cx ? "#8a7aa0" : "#5a4e6e"));
  robe.rect(cx - 5, beltY - 1, 2, 3, "#a898c0");
  for (let y = beltY + 2; y < beltY + (kneel ? 6 : 10); y++) {
    robe.px(cx - 5 + Math.round(walk * (y - beltY) * 0.15), y, hex("#8a7aa0"));
    if (y < beltY + (kneel ? 5 : 8)) robe.px(cx - 3 + Math.round(walk * (y - beltY) * 0.15), y, hex("#6a5e80"));
  }
  stack(fig, robe);
  // the mantle over the shoulders, its edge casting a little shadow on the robe
  const mantle = part();
  const capeEdge = (x: number) => top + 21 + Math.round(4 * (1 - ((x - cx - 1) / 10) ** 2));
  mantle.poly([[cx - 6, top + 12], [cx + 7, top + 12], [cx + 10, top + 19], [cx + 10, top + 21], [cx - 9, top + 21], [cx - 9, top + 19]], cloak);
  for (let x = cx - 9; x <= cx + 10; x++) mantle.rect(x, top + 21, 1, capeEdge(x) - top - 21, cloak);
  volume(mantle, C);
  for (let x = cx - 8; x <= cx + 9; x++) if (on(robe, x, capeEdge(x)) && !on(mantle, x, capeEdge(x))) fig.px(x, capeEdge(x), hex(C.lo));
  stack(fig, mantle);
  // the hood: a rounded cowl with a slight peak, lined, the opening dark
  const hood = part();
  hood.poly([[cx - 8, top + 15], [cx - 8, top + 6], [cx - 4, top], [cx - 1, top - 1], [cx + 3, top - 1], [cx + 7, top + 4], [cx + 8, top + 15]], cloak);
  volume(hood, C);
  hood.poly([[cx - 8, top + 15], [cx - 8, top + 6], [cx - 4, top], [cx - 3, top + 2], [cx - 6, top + 9], [cx - 6, top + 15]], C.hi);
  hood.ellipse(cx + 1, top + 9, 5.5, 6.6, C.lo);
  hood.ellipse(cx + 0.5, top + 9, 5.2, 6.4, C.hi);
  hood.ellipse(cx + 1, top + 9.5, 4.6, 5.8, C.deep);
  hood.ellipse(cx + 1, top + 9.5, 4.2, 5.4, "#0a080e");
  stack(fig, hood);
  const eye = kneel ? "#4a7aa0" : "#9fe4ff";
  const ey = top + 9 + (kneel ? 1 : 0);
  fig.px(cx - 1, ey, hex(eye));
  fig.px(cx + 3, ey, hex(eye));
  fig.px(cx - 1, top + 8, hex("#4aa8ff", 160));
  fig.px(cx + 3, top + 8, hex("#4aa8ff", 160));
  // the Distaff: carved rings along the shaft, a few turns of thread under the head
  const staff = (x0: number, y0: number, x1: number, y1: number) => {
    const st = part();
    st.line(x0, y0, x1, y1, "#7a5430");
    st.line(x0 + 1, y0, x1 + 1, y1, "#b08050");
    const n = Math.max(Math.abs(y1 - y0), 1);
    for (let k = 6; k < n - 4; k += 9) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      st.px(x, y, hex("#d0a070"));
      st.px(x + 1, y, hex("#5a3a20"));
    }
    for (let k = 3; k <= 6; k++) {
      const x = Math.round(x1 + ((x0 - x1) * k) / n);
      const y = Math.round(y1 + ((y0 - y1) * k) / n);
      st.rect(x - 1, y, 4, 1, k % 2 ? "#c8b8e8" : "#9a88c0");
    }
    st.circle(x1, y1, 1.6, "#d8c8ff");
    st.px(x1, y1, hex("#ffffff"));
    stack(fig, st);
  };
  // a sleeve from the shoulder to the hand, widening at the cuff, and the hand
  const sleeve = (from: [number, number], hand: [number, number]) => {
    const sl = part();
    limb(sl, from, hand, 1.6, 2.4, cloak);
    volume(sl, C);
    stack(fig, sl);
    const hd = part();
    hd.rect(hand[0] - 1, hand[1] - 1, 3, 3, "#c8a888");
    hd.px(hand[0] + 1, hand[1] + 1, hex("#9a7a68"));
    stack(fig, hd);
  };
  if (pose === 0) {
    staff(cx + 15, bottom - 1, cx + 15, top + 4);
    sleeve([cx + 7, top + 16], [cx + 13, top + 34]);
  } else if (pose === 3) {
    // the staff planted beside him, full length, one hand hanging on to it
    staff(cx + 15, bottom - 1, cx + 13, bottom - 58);
    sleeve([cx + 7, top + 16], [cx + 12, top + 9]);
  } else if (pose === 1) {
    staff(cx + 9, top + 30, cx + 19, top - 12);
    sleeve([cx + 7, top + 15], [cx + 13, top + 2]);
  } else {
    // both hands on the shaft, the Distaff held upright above the hood
    staff(cx + 9, top + 28, cx + 13, top - 15);
    sleeve([cx - 5, top + 15], [cx + 10, top + 11]);
    sleeve([cx + 7, top + 15], [cx + 11, top - 2]);
  }
  selout(fig);
  img.blit(fig, ox, 0);
}

/** Where the Distaff's tip is, relative to Bobbin's feet, for each frame (used by the casting light). */
export const BOBBIN_TIP: Record<number, [number, number]> = { 0: [13, -60], 9: [17, -76], 10: [11, -79] };

/** A mute swan facing right. wing > 0 raises the wings (arched, or the upstroke in flight), wing < 0 is
 *  the downstroke. Feathers are layered rows, darker towards the tips. */
export function swan(img: Img, x: number, y: number, s: number, wing: number, base = "#f2f2f6", seed = 0): void {
  const shade = mix(base, "#7a7a98", 0.35);
  const deep = mix(base, "#3a3a58", 0.45);
  const lit = mix(base, "#ffffff", 0.6);
  // body: a long teardrop, the tail lifted behind
  img.ellipse(x, y, 10 * s, 4.4 * s, base);
  img.poly([[x - 7 * s, y - 2 * s], [x - 12.5 * s, y - 3.6 * s], [x - 9 * s, y + 1.5 * s]], base);
  img.ellipse(x + 1.5 * s, y + 2.2 * s, 8.2 * s, 2.2 * s, shade);
  img.line(x - 6 * s, y + 3.6 * s, x + 7 * s, y + 3.4 * s, deep);
  // neck: an S, thick at the breast and thinner up to the head
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const nx = x + (6.5 + t * 6) * s + Math.sin(t * Math.PI) * 1.6 * s;
    const ny = y - 1 - t * 8.5 * s;
    img.circle(nx, ny, (2.1 - t * 0.8) * s, base);
    if (t > 0.15 && t < 0.85) img.px(nx + 1.2 * s, ny, hex(shade));
  }
  img.ellipse(x + 13 * s, y - 9.2 * s, 2.7 * s, 2 * s, base);
  img.px(x + 12 * s, y - 10.4 * s, hex(lit));
  // the beak, orange with its black knob at the base and a dark nail at the tip
  img.poly([[x + 14.5 * s, y - 10 * s], [x + 18.5 * s, y - 8.6 * s], [x + 18.5 * s, y - 7.8 * s], [x + 14.5 * s, y - 8 * s]], "#ff8a30");
  img.line(x + 15 * s, y - 8.1 * s, x + 18 * s, y - 7.9 * s, "#c85a18");
  img.px(x + 18.5 * s, y - 8.4 * s, hex("#2a1a14"));
  img.rect(x + 14.2 * s, y - 10.4 * s, Math.max(1, 1.2 * s), Math.max(1, 2.2 * s), "#101018");
  img.px(x + 13.4 * s, y - 9.6 * s, hex("#101018"));
  // wings: an arch over the back, its feathers in scalloped rows, the fold shadowed
  if (wing > 0) {
    const arch: [number, number][] = [[x + 4 * s, y - 1], [x + 1.5 * s, y - 5.5 * s], [x - 2.5 * s, y - 7.6 * s], [x - 6.5 * s, y - 6.8 * s], [x - 10 * s, y - 3.6 * s], [x - 8.5 * s, y - 0.5]];
    img.poly(arch, base);
    if (s >= 0.8)
      for (const [ry, x0, x1, c] of [[-2.2, -8.5, 2.5, shade], [-4.4, -7.5, 0, mix(base, shade, 0.5)]] as const)
        for (let wx = x0 * s; wx <= x1 * s; wx += 3) {
          // one feather's rounded tip: \__
          img.px(x + wx, y + ry * s, hex(c));
          img.px(x + wx + 1, y + ry * s + 1, hex(c));
          img.px(x + wx + 2, y + ry * s + 1, hex(c));
        }
    for (let k = 0; k < 4; k++) img.px(x - (1 + k * 2) * s, y - (6.6 + (k === 1 ? 0.6 : 0)) * s, hex(lit));
    img.line(x - 8.5 * s, y - 0.5, x + 4 * s, y - 1, deep);
  } else {
    img.poly([[x - 7 * s, y - 1], [x + 5 * s, y - 1], [x - 3 * s, y + 5 * s]], shade);
    img.line(x - 6 * s, y - 1, x - 3 * s, y + 5 * s, deep);
    img.line(x, y - 1, x - 2 * s, y + 4 * s, base);
    img.line(x - 5 * s, y, x + 3 * s, y, lit);
  }
  void seed;
}

/** Skein: a cygnet, grey and downy, a round head on a short neck, the beak still dark. bob lifts her a pixel;
 *  sitting, she is tucked low with her head drawn in. */
export function cygnet(img: Img, x: number, y: number, bob: number, sitting = false, base = "#b8b8c6"): void {
  const shade = mix(base, "#4a4a62", 0.4);
  const lit = mix(base, "#ffffff", 0.45);
  y -= bob;
  const rx = sitting ? 7.5 : 5;
  img.ellipse(x, y, rx, 3.2, base);
  img.ellipse(x + 0.5, y + 1.5, rx - 1.2, 1.5, shade);
  img.poly([[x - rx + 1, y - 1], [x - rx - 2, y - 2.5], [x - rx + 1, y + 1]], base);
  // down: a few soft tufts on the back
  for (const k of [-3, -1]) img.px(x + k, y - 3, hex(lit));
  // a short neck up to a round head; sitting, the neck is drawn in
  const [hx, hy] = sitting ? [x + rx - 2, y - 4] : [x + 5.5, y - 6.5];
  for (let t = 0; t <= 1; t += 0.25) img.circle(x + (sitting ? rx - 3 : 3) + (hx - x - (sitting ? rx - 3 : 3)) * t, y - 1.5 + (hy - y + 1.5) * t, 1.4, base);
  img.circle(hx, hy, 2.1, base);
  img.px(hx - 1, hy - 2, hex(lit));
  img.px(hx, hy - 1, hex("#14141c"));
  img.rect(hx + 2, hy - 0.5, 2, 1, "#4a3a44");
  img.px(hx + 2, hy + 0.5, hex("#2a1e26"));
  if (!sitting) {
    img.rect(x - 1 + (bob ? 1 : 0), y + 3, 1, 2, "#3a3a44");
    img.rect(x + 2 - (bob ? 1 : 0), y + 3, 1, 2, "#3a3a44");
  }
}

export function frames(img: Img, n: number, draw: (ox: number, fw: number, i: number) => void): void {
  const fw = img.w / n;
  for (let i = 0; i < n; i++) draw(i * fw, fw, i);
}

export const FIGS: Record<string, Fig> = {
  jogger: { h: 58, body: "#3a7ac0", skin: "#b07850", hair: "#2a1810", legs: "#24242e", accent: "#9ad0ff", top: "hoodie", shoes: "#e8e8f0" },
  commuter: { h: 64, body: "#5a6272", skin: "#d8a888", hair: "#4a3424", headphones: "on", legs: "#2a2a34", wide: 20, top: "coat", shirt: "#c8ccd8" },
  receptionist: { h: 54, body: "#e85ac8", skin: "#f0c4a4", hair: "#ffe08a", hairStyle: "bob", headphones: "on", accent: "#ffd0f0", top: "jacket", shirt: "#fff0fa", legs: "#5a2a5a" },
  lyra: { h: 60, body: "#c8683e", skin: "#e2b08a", hair: "#5a2c1a", hairStyle: "ponytail", legs: "#3a4470", accent: "#ffd8a8", top: "jacket", shoes: "#f0e8e0" },
  engineer: { h: 52, body: "#3a5a8a", skin: "#c89a78", hair: "#6a6a6a", headphones: "on", legs: "#2a2a34" },
  coach: { h: 64, body: "#9a4478", skin: "#ecc0a0", hair: "#2a1414", hairStyle: "bun", accent: "#ffd090", skirt: true, shoes: "#3a1a2a" },
  choreographer: { h: 62, body: "#26242e", skin: "#e0b090", hair: "#ececf4", hairStyle: "short", accent: "#ff4040", top: "turtle", legs: "#1a1a22" },
  juno: { h: 58, body: "#2a7a54", skin: "#8a5a3c", hair: "#1a1010", hairStyle: "puffs", headphones: "neck", accent: "#7fe0a0", legs: "#2a2a34", top: "jacket", shirt: "#1e2a24" },
  host: { h: 62, body: "#c89a58", skin: "#ecc0a0", hair: "#7a3a1e", hairStyle: "long", accent: "#ffffff", skirt: true, shoes: "#6a4a2a" },
  foreman: { h: 62, body: "#f08a30", skin: "#b07850", hair: "#2a1a10", hat: "#ffd040", wide: 24, legs: "#3a3a44", accent: "#e8e8e8", top: "vest", shirt: "#4a5a6a", shoes: "#4a3020" },
  dominic: { h: 62, body: "#76685a", skin: "#e0b090", hair: "#a4a4a4", headphones: "neck", accent: "#ff9a3a", wide: 21, top: "jacket", shirt: "#2a2a30" },
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
