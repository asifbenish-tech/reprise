// src/ui/dom.ts: a tiny element builder. Text is never pixel art (GDD 7.9).
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** append() that skips null, false and undefined, like h() does. */
export function append(el: Element, ...children: Child[]): void {
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove();
}

export const NOTE_COLORS = ["#e05a4f", "#f08c3a", "#efc94c", "#6cc070", "#4fb3c8", "#5b7be0", "#9a6ad6", "#ece8f6"];
export const NOTE_GLYPHS = ["●", "▲", "■", "◆", "★", "▼", "✚", "◎"];
export const NOTE_LETTERS = ["c", "d", "e", "f", "g", "a", "b", "C′"];

/** Two threads weaving round each other, gold and lavender, with a knot of light in the middle: the title's ornament. */
export function weave(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 160 10");
  svg.setAttribute("class", "weave");
  svg.setAttribute("aria-hidden", "true");
  for (const [phase, color] of [[0, "#ffd27a"], [Math.PI, "#c8b8ff"]] as const) {
    const pts: string[] = [];
    for (let x = 0; x <= 160; x += 2) {
      const fade = Math.sin((x / 160) * Math.PI);
      pts.push(`${x},${(5 + Math.sin(x / 9 + phase) * 3.2 * fade).toFixed(2)}`);
    }
    const pl = document.createElementNS(NS, "polyline");
    pl.setAttribute("points", pts.join(" "));
    pl.setAttribute("fill", "none");
    pl.setAttribute("stroke", color);
    pl.setAttribute("stroke-width", "1");
    svg.append(pl);
  }
  const knot = document.createElementNS(NS, "rect");
  for (const [k, v] of Object.entries({ x: "78", y: "3", width: "4", height: "4", fill: "#fff6d8", transform: "rotate(45 80 5)" })) knot.setAttribute(k, v);
  svg.append(knot);
  return svg;
}
