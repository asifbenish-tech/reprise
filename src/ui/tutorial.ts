// src/ui/tutorial.ts: how to play (owner direction, DECISIONS.md D-049). A short illustrated guide, offered when a
// new game starts and kept in the menus, and first-time tips in the scene that turn up when they are useful,
// one at a time, and get out of the way.
import { manifest, artUrl } from "../content/load";
import { t } from "../content/strings";
import { writeSettings } from "../core/save";
import type { Game } from "../world/game";
import { NOTE_COLORS, NOTE_GLYPHS, NOTE_LETTERS, clear, h } from "./dom";

const PAGES = ["walk", "distaff", "drafts", "book", "stuck"] as const;
type Page = (typeof PAGES)[number];

/** One frame of a sprite sheet as a plain element, sized in game pixels like the rest of the HUD. */
function sprite(id: string, frame = 0, scale = 1): HTMLElement {
  const img = manifest.images.find((i) => i.id === id);
  if (!img) return h("span");
  const fw = img.frameW ?? img.w / img.frames;
  const px = (n: number) => `calc(var(--s) * ${n * scale}px)`;
  return h("span", {
    class: "guide-sprite",
    style: `width:${px(fw)};height:${px(img.h)};background-image:url("${artUrl(img.path)}");background-size:${px(img.w)} ${px(img.h)};background-position:calc(var(--s) * ${-frame * fw * scale}px) 0`,
  });
}

const key = (k: string) => h("kbd", {}, k);

/** The guide: five pages, each a small picture made of the game's own pieces and a few lines. */
export class Guide {
  readonly el: HTMLElement;
  private page = 0;
  private resolve: (() => void) | null = null;

  constructor(private g: Game) {
    this.el = h("div", { id: "guide", class: "modal hidden", role: "dialog", "aria-modal": "true", "aria-label": t("guide.title") });
    this.el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") this.go(1);
      else if (e.key === "ArrowLeft") this.go(-1);
      else if (e.key === "Escape") this.close();
      else return;
      e.stopPropagation();
    });
  }

  get isOpen(): boolean {
    return !this.el.classList.contains("hidden");
  }

  /** Opens at the first page; resolves when the reader closes it. */
  open(): Promise<void> {
    this.page = 0;
    this.render();
    this.el.classList.remove("hidden");
    return new Promise((res) => (this.resolve = res));
  }

  close(): void {
    this.el.classList.add("hidden");
    if (!this.g.settings.guideSeen) {
      this.g.settings.guideSeen = true;
      writeSettings(this.g.settings);
    }
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  private go(d: number): void {
    const next = this.page + d;
    if (next < 0) return;
    if (next >= PAGES.length) return this.close();
    this.page = next;
    this.render();
  }

  private render(): void {
    const id = PAGES[this.page];
    const last = this.page === PAGES.length - 1;
    clear(this.el);
    this.el.append(
      h("div", { class: "modal-head" }, h("h2", {}, t("guide.title")), h("button", { class: "icon-btn", "aria-label": t("ui.close"), onclick: () => this.close() }, "✕")),
      h("div", { class: `guide-page guide-page-${id}` }, h("div", { class: "guide-picture", "aria-hidden": "true" }, ...this.picture(id)), h("h3", {}, t(`guide.${id}.title`)), h("p", {}, t(`guide.${id}.body`))),
      h(
        "div",
        { class: "guide-foot" },
        h("button", { class: "guide-btn", disabled: this.page === 0, onclick: () => this.go(-1) }, t("guide.back")),
        h("span", { class: "guide-dots", "aria-label": t("guide.page", { n: this.page + 1, total: PAGES.length }) }, ...PAGES.map((_, i) => h("span", { class: i === this.page ? "on" : "" }))),
        h("button", { class: last ? "big" : "guide-btn primary", id: "guide-next", onclick: () => this.go(1) }, last ? t("guide.done") : t("guide.next")),
      ),
    );
    (this.el.querySelector("#guide-next") as HTMLButtonElement).focus({ preventScroll: true });
  }

  private picture(id: Page): Node[] {
    const notes = (n: number, labels: boolean) =>
      h("div", { class: "guide-notes" }, ...NOTE_GLYPHS.slice(0, n).map((gl, i) => h("span", { class: "guide-note", style: `--nc:${NOTE_COLORS[i]}` }, gl, labels ? h("small", {}, NOTE_LETTERS[i]) : null, key(String(i + 1)))));
    switch (id) {
      case "walk":
        return [
          h("div", { class: "guide-scene" }, sprite("bobbin", 1), h("span", { class: "guide-path" }), h("span", { class: "guide-target" }, sprite("jogger", 0)), h("span", { class: "guide-cursor" }, "➤")),
          h("p", { class: "guide-keys" }, key("H"), " ", t("guide.walk.key")),
        ];
      case "distaff":
        return [notes(8, true)];
      case "drafts": {
        // a draft: four notes in a row, then woven on to what is selected
        const phrase = [0, 2, 1, 2];
        return [
          h("div", { class: "guide-draft" }, ...phrase.map((n) => h("span", { class: "guide-note", style: `--nc:${NOTE_COLORS[n]}` }, NOTE_GLYPHS[n], h("small", {}, NOTE_LETTERS[n]))), h("span", { class: "guide-arrow" }, "→"), sprite("skein", 0, 2)),
        ];
      }
      case "book":
        return [
          h(
            "div",
            { class: "guide-book" },
            h("span", { class: "guide-book-icon" }, "❦"),
            h("span", { class: "guide-book-entry" }, h("strong", {}, t("draft.opening")), ...[0, 2, 1, 2].map((n, i) => h("span", { class: `book-slot${i < 3 ? " filled" : ""}`, style: `--nc:${NOTE_COLORS[n]}` }, i < 3 ? NOTE_GLYPHS[n] : "?"))),
          ),
          h("p", { class: "guide-keys" }, key("B"), " ", t("ui.book")),
        ];
      case "stuck":
        return [h("div", { class: "guide-scene" }, sprite("skein", 1, 2), h("span", { class: "guide-bubble" }, "?")), h("p", { class: "guide-keys" }, key("K"), " ", t("menu.hint"), " · ", key("M"), " ", t("ui.menu"))];
    }
  }
}

interface Tip {
  id: string;
  /** shown when this holds and the game is idle */
  when: (g: Game) => boolean;
  /** gone (and counted as seen) once this holds */
  done?: (g: Game) => boolean;
  /** shown over the Loom View, where every other tip waits */
  inLoom?: boolean;
  text: (g: Game) => string;
}

const inRoom = (g: Game, id: string) => g.room?.id === id;

const TIPS: Tip[] = [
  { id: "echo", when: (g) => inRoom(g, "crossing") && g.flag("await_opening"), done: (g) => !g.flag("await_opening"), text: () => t("tip.echo") },
  { id: "walk", when: (g) => !inRoom(g, "crossing"), done: (g) => !!g.selection, text: () => t("tip.walk") },
  { id: "weave", when: (g) => inRoom(g, "pond") && g.flag("landed") && !g.flag("skein_healed"), done: (g) => g.flag("skein_healed"), text: () => t("tip.weave") },
  { id: "book", when: (g) => !inRoom(g, "crossing") && g.save.learned.length > 0, text: (g) => t(g.save.difficulty === "practice" ? "tip.book.practice" : "tip.book") },
  { id: "comb", when: (g) => g.save.tools.includes("combing") && !g.loom, text: () => t("tip.comb") },
  { id: "loom", when: (g) => !!g.loom, done: (g) => !g.loom, inLoom: true, text: () => t("tip.loom") },
  { id: "spindle", when: (g) => g.spindle.capacity > 0, text: () => t("tip.spindle") },
];

/** How long the player can stand in one room without progress before Skein's tip appears. */
const STUCK_MS = 90_000;

/**
 * First-time tips: a small panel at the top of the scene, one at a time, only while nothing else is on
 * screen, each shown once per device. Settings can switch them off (and on again, from the start).
 */
export class Tips {
  readonly el: HTMLElement;
  private text: HTMLElement;
  private current: Tip | null = null;
  private lastProgress = performance.now();

  constructor(private g: Game, private quiet: () => boolean, private loomOpen: () => boolean) {
    this.text = h("p", { class: "tip-text" });
    this.el = h(
      "div",
      { id: "tip", class: "hidden", role: "note" },
      h("span", { class: "tip-mark", "aria-hidden": "true" }, "✦"),
      this.text,
      h("div", { class: "tip-actions" }, h("button", { class: "tip-ok", onclick: () => this.dismiss() }, t("tip.ok")), h("button", { class: "tip-off", onclick: () => this.off() }, t("tip.off"))),
    );
    for (const ev of ["cast", "solved", "roomEntered", "learned", "flag"] as const) g.bus.on(ev, () => (this.lastProgress = performance.now()));
  }

  private seen(id: string): boolean {
    return this.g.settings.tipsSeen.includes(id);
  }

  private mark(id: string): void {
    if (this.seen(id)) return;
    this.g.settings.tipsSeen.push(id);
    writeSettings(this.g.settings);
  }

  /** Out of the way while someone talks or a panel is open; over the Loom View only if it is about it. */
  private blocked(tip: Tip): boolean {
    return this.quiet() || this.loomOpen() !== !!tip.inLoom;
  }

  dismiss(): void {
    if (this.current) this.mark(this.current.id);
    this.current = null;
    this.el.classList.add("hidden");
  }

  private off(): void {
    this.g.settings.tips = false;
    writeSettings(this.g.settings);
    this.dismiss();
  }

  /** Called every frame. */
  tick(): void {
    const g = this.g;
    if (!g.save || g.fast || !g.settings.tips) {
      this.current = null;
      this.el.classList.add("hidden");
      return;
    }
    // someone who has opened the Loom View already knows how to comb
    if (g.loom && !this.seen("comb")) this.mark("comb");
    if (this.current) {
      // out of the way while someone talks or a panel is open; back when the scene is quiet again
      if (this.current.done?.(g)) this.dismiss();
      else if (!this.quiet() && this.blocked(this.current)) {
        // its place (scene or Loom View) is not on screen: step aside unseen, so a tip that fits can show
        this.current = null;
        this.el.classList.add("hidden");
      } else {
        this.el.classList.toggle("hidden", this.blocked(this.current));
        return;
      }
    }
    if (this.quiet() || g.busy) return;
    const stuck: Tip = { id: "hint", when: () => performance.now() - this.lastProgress > STUCK_MS && !inRoom(g, "crossing"), text: () => t("tip.hint") };
    const next = [...TIPS, stuck].find((tip) => !this.seen(tip.id) && !this.blocked(tip) && tip.when(g) && !tip.done?.(g));
    if (!next) return;
    this.current = next;
    this.text.textContent = next.text(g);
    this.el.classList.remove("hidden");
  }
}
