// src/ui/distaff-bar.ts: the black panel under the scene (GDD 4.1, 7.6). The carved Distaff lies along it;
// each of its eight sockets holds a small spool that glows in the note's colour and shows its glyph, and
// a played note rises off its socket like a music box's tine. Above the staff a five-line strip writes
// the notes as they sound. The Spindle rings the staff's head; the selected object's close-up sits right.
import * as Tone from "tone";
import type { NoteIndex } from "../content/types";
import { artUrl, manifest } from "../content/load";
import { t } from "../content/strings";
import type { Game } from "../world/game";
import { NOTE_COLORS, NOTE_GLYPHS, NOTE_LETTERS, clear, h } from "./dom";

// Panel geometry in art pixels, relative to the panel's top left; the staff art is tools/recipes.ts ui:distaff.
export const PANEL_H = 64;
const STAFF_X = 8;
const STAFF_TOP = 20;
const SHAFT_Y = STAFF_TOP + 22;
const SOCKET_X = (i: number) => STAFF_X + 70 + i * 60;
const KNOB_X = STAFF_X + 20;
const STRIP = { x: SOCKET_X(0) - 22, w: SOCKET_X(7) - SOCKET_X(0) + 44, h: 20 };

const px = (n: number) => `calc(var(--s) * ${n}px)`;
const SVG = "http://www.w3.org/2000/svg";

export class DistaffBar {
  readonly el: HTMLElement;
  private notes: HTMLButtonElement[] = [];
  private spools: HTMLButtonElement[] = [];
  private head: HTMLButtonElement;
  private combBtn: HTMLButtonElement;
  private closeup: HTMLElement;
  private strip: SVGSVGElement;
  private played: NoteIndex[] = [];
  private ring: HTMLElement;
  private stripTimer = 0;
  private musicBtn: HTMLButtonElement;
  onBook: () => void = () => {};
  onMenu: () => void = () => {};
  onHint: () => void = () => {};
  /** Lets the speech line step up while the strip is showing. */
  onStrip: (showing: boolean) => void = () => {};

  constructor(private g: Game) {
    const art = manifest.images.find((i) => i.id === "ui_distaff");
    const staff = h("img", { class: "staff", alt: "", src: art ? artUrl(art.path) : "", style: `left:${px(STAFF_X)};top:${px(STAFF_TOP)}` });
    this.head = h("button", { class: "spindle-head", "aria-label": t("ui.spindle.arm"), onclick: () => this.toggleArm() });
    this.ring = h("div", { class: "spindle", role: "group", "aria-label": t("ui.spindle"), style: `left:${px(KNOB_X - 24)};top:${px(SHAFT_Y - 24)}` }, this.head);
    for (let i = 0; i < 4; i++) {
      const b = h("button", {
        class: `spool spool-${i}`,
        onclick: () => this.g.spindle.select(i),
        oncontextmenu: (e: Event) => {
          e.preventDefault();
          this.g.spindle.clear(i);
        },
      });
      this.spools.push(b);
      this.ring.append(b);
    }
    const noteRow = h("div", { class: "notes", role: "group", "aria-label": t("ui.distaff") });
    for (let i = 0; i < 8; i++) {
      const b = h("button", {
        class: "note",
        style: `--nc:${NOTE_COLORS[i]};left:${px(SOCKET_X(i) - 14)};top:${px(SHAFT_Y - 14)}`,
        onpointerdown: (e: Event) => {
          e.preventDefault();
          this.g.playNote(i as NoteIndex);
        },
        onkeydown: (e: Event) => {
          const k = (e as KeyboardEvent).key;
          if (k === "Enter" || k === " ") {
            e.preventDefault();
            this.g.playNote(i as NoteIndex);
          }
        },
      });
      this.notes.push(b);
      noteRow.append(b);
    }
    this.strip = document.createElementNS(SVG, "svg");
    this.strip.setAttribute("class", "notation");
    this.strip.setAttribute("viewBox", `0 0 ${STRIP.w} ${STRIP.h}`);
    this.strip.setAttribute("aria-hidden", "true");
    this.strip.setAttribute("style", `left:${px(STRIP.x)};top:0;width:${px(STRIP.w)};height:${px(STRIP.h)}`);
    this.combBtn = h("button", { class: "comb", "aria-label": t("ui.comb"), title: t("ui.comb"), onclick: () => this.comb() }, h("span", { class: "comb-teeth" }));
    this.closeup = h("div", { class: "closeup empty", "aria-live": "polite" });
    const book = h("button", { class: "icon-btn book-btn", "aria-label": t("ui.book"), title: t("ui.book"), onclick: () => this.onBook() }, "❦");
    const menu = h("button", { class: "icon-btn menu-btn", "aria-label": t("ui.menu"), title: t("ui.menu"), onclick: () => this.onMenu() }, "≡");
    this.musicBtn = h("button", { class: "icon-btn music-btn", onclick: () => this.g.setMusicOn(!this.g.settings.musicOn) }, "♪");
    this.el = h("div", { id: "distaff" }, staff, this.strip, this.ring, noteRow, this.combBtn, this.closeup, book, menu, this.musicBtn);
    this.refreshMusic();

    g.bus.on("note", ({ n, cracked, index }) => {
      this.pulse(n, cracked);
      if (!cracked) {
        if (index === 0) this.played = [];
        this.played.push(n);
        this.drawStrip(this.played, false);
      }
    });
    g.bus.on("noteCleared", () => this.fadeStrip());
    g.bus.on("cast", (e) => {
      if (!e.fromLoop) this.fadeStrip(true);
    });
    g.bus.on("phraseFailed", () => this.fadeStrip(false));
  }

  private toggleArm(): void {
    const s = this.g.spindle;
    if (!s || s.capacity === 0) return;
    s.setArmed(!s.armed);
  }

  private comb(): void {
    if (this.g.loom) this.g.closeLoom();
    else this.g.comb();
  }

  pulse(n: NoteIndex, cracked: boolean): void {
    const b = this.notes[n];
    b.classList.remove("lit", "dead");
    void b.offsetWidth;
    b.classList.add(cracked ? "dead" : "lit");
    if (cracked) return;
    // the note lifts off its socket and floats up into the light
    const mote = h("span", { class: "mote", "aria-hidden": "true" }, NOTE_GLYPHS[n]);
    b.append(mote);
    window.setTimeout(() => mote.remove(), 900);
  }

  /** The song takes a note: its spool flares, shakes and goes dark. */
  breakNote(n: number): void {
    const b = this.notes[n];
    if (!b) return;
    b.classList.remove("breaking");
    void b.offsetWidth;
    b.classList.add("breaking");
    window.setTimeout(() => b.classList.remove("breaking"), 1400);
  }

  /** A heard draft: notes glow as they sound, with or without labels by difficulty (GDD 4.1). */
  showPhrase(phrase: readonly NoteIndex[], times: number[]): void {
    const expert = this.g.save.difficulty === "expert";
    const shown: NoteIndex[] = [];
    // a note the Distaff has lost sparks on its cracked socket instead of lifting off (the Song of Originality)
    const owned = this.g.library.ownedNotes;
    phrase.forEach((n, i) => {
      Tone.getDraw().schedule(() => {
        shown.push(n);
        if (!expert || n >= owned) this.pulse(n, n >= owned);
        this.drawStrip(shown, expert);
        if (i === phrase.length - 1) this.fadeStrip(true);
      }, times[i]);
    });
  }

  /** Five thin lines with a note head per played note: above its socket, or (Expert) only the contour. */
  private drawStrip(ns: NoteIndex[], contourOnly: boolean): void {
    const svg = this.strip;
    while (svg.firstChild) svg.firstChild.remove();
    const el = (tag: string, attrs: Record<string, string | number>) => {
      const e = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      svg.append(e);
      return e;
    };
    for (let k = 0; k < 5; k++) el("line", { x1: 0, x2: STRIP.w, y1: 4 + k * 3, y2: 4 + k * 3, class: "strip-line" });
    const xs = ns.map((n, i) => (contourOnly ? STRIP.w * ((i + 1) / 5) : SOCKET_X(n) - STRIP.x));
    const ys = ns.map((n) => 17 - n * 1.5);
    if (ns.length > 1) el("polyline", { points: xs.map((x, i) => `${x},${ys[i]}`).join(" "), class: "contour-line" });
    ns.forEach((n, i) => {
      const c = contourOnly ? "#d8cff0" : NOTE_COLORS[n];
      el("ellipse", { cx: xs[i], cy: ys[i], rx: 2.4, ry: 1.8, fill: c, class: "head" });
      el("line", { x1: xs[i] + 2.2, x2: xs[i] + 2.2, y1: ys[i], y2: ys[i] - 7, class: "stem", stroke: c });
    });
    svg.classList.remove("fade", "ok", "bad");
    svg.classList.add("show");
    window.clearTimeout(this.stripTimer);
    this.onStrip(true);
  }

  private fadeStrip(ok?: boolean): void {
    this.strip.classList.remove("ok", "bad");
    if (ok !== undefined) this.strip.classList.add(ok ? "ok" : "bad");
    this.strip.classList.add("fade");
    window.clearTimeout(this.stripTimer);
    this.stripTimer = window.setTimeout(() => {
      this.strip.classList.remove("show");
      this.onStrip(false);
    }, 1500);
  }

  setCloseup(label: string | null, sprite: { url: string; w: number; h: number; frameW: number } | null): void {
    clear(this.closeup);
    this.closeup.classList.toggle("empty", !label);
    if (!label) return;
    const icon = h("div", { class: "closeup-icon" });
    if (sprite) {
      // the object's first frame, drawn pixel for pixel: its close-up icon (GDD 4.1)
      const c = h("canvas", { width: sprite.frameW, height: sprite.h });
      const img = new Image();
      img.onload = () => c.getContext("2d")?.drawImage(img, 0, 0, sprite.frameW, sprite.h, 0, 0, sprite.frameW, sprite.h);
      img.src = sprite.url;
      icon.append(c);
    } else icon.textContent = label.slice(0, 1).toUpperCase();
    this.closeup.append(icon, h("span", { class: "closeup-label" }, label));
  }

  /** The ♪ button shows whether music is on, and says what pressing it will do. */
  refreshMusic(): void {
    const on = this.g.settings.musicOn;
    this.musicBtn.classList.toggle("off", !on);
    this.musicBtn.setAttribute("aria-pressed", String(on));
    const label = on ? t("ui.music_off") : t("ui.music_on");
    this.musicBtn.setAttribute("aria-label", label);
    this.musicBtn.title = label;
  }

  refresh(): void {
    this.refreshMusic();
    const g = this.g;
    if (!g.save) return;
    const owned = g.library.ownedNotes;
    const diff = g.save.difficulty;
    const crack = manifest.images.find((i) => i.id === "ui_crack");
    this.notes.forEach((b, i) => {
      const cracked = i >= owned;
      b.classList.toggle("cracked", cracked);
      b.setAttribute("aria-label", cracked ? t("ui.note.cracked", { note: NOTE_LETTERS[i] }) : t("ui.note", { note: NOTE_LETTERS[i], n: i + 1 }));
      clear(b);
      b.append(h("span", { class: "spoolshape" }));
      if (cracked && crack) b.append(h("img", { class: "crack", alt: "", src: artUrl(crack.path) }));
      if (diff !== "expert") b.append(h("span", { class: "glyph" }, NOTE_GLYPHS[i]));
      if (diff !== "expert") b.append(h("span", { class: "letter" }, NOTE_LETTERS[i]));
    });
    const s = g.spindle;
    const hasSpindle = s.capacity > 0;
    this.ring.classList.toggle("off", !hasSpindle);
    this.head.disabled = !hasSpindle;
    this.head.classList.toggle("armed", s.armed);
    this.head.setAttribute("aria-pressed", String(s.armed));
    this.spools.forEach((b, i) => {
      const sp = s.spool(i);
      b.disabled = i >= s.capacity;
      b.classList.toggle("selected", i === s.selected);
      b.classList.toggle("locked", i >= s.capacity);
      clear(b);
      let label = t("ui.spool.empty", { n: i + 1 });
      if (sp?.kind === "draft") {
        const name = t(`draft.${sp.reversed ? `${sp.id}_rev` : sp.id}`);
        b.append(h("span", { class: "spool-draft" }, name.slice(0, 1)));
        label = t("ui.spool.draft", { n: i + 1, draft: name });
      } else if (sp?.kind === "thread") {
        const stem = g.model(sp.thread.song).def.stems.find((x) => x.id === sp.thread.stem);
        b.append(h("span", { class: "spool-thread", style: `background:${stem?.color ?? "#ccc"}` }));
        label = t("ui.spool.thread", { n: i + 1, thread: stem ? t(stem.label) : "?" });
      }
      b.setAttribute("aria-label", label);
      b.title = label;
    });
    const canComb = g.save.tools.includes("combing");
    this.combBtn.classList.toggle("hidden", !canComb);
    this.combBtn.classList.toggle("open", !!g.loom);
  }

  /** The ring sweeps once per bar. */
  tick(): void {
    if (!this.g.mixer || this.ring.classList.contains("off")) return;
    const b = this.g.conductor.beatsAt(Tone.now());
    this.ring.style.setProperty("--sweep", `${((b % 4) / 4) * 360}deg`);
  }
}
