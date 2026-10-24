// src/main.ts: boot, title screen, audio unlock (GDD 9.3 rule 2: audio starts with a click).
import * as Phaser from "phaser";
import "@fontsource/pixelify-sans/latin-400.css";
import "@fontsource/pixelify-sans/latin-600.css";
import "./ui/style.css";
import { t } from "./content/strings";
import { readSave, readSettings, writeSettings, type Difficulty } from "./core/save";
import type { NoteIndex } from "./content/types";
import { Game } from "./world/game";
import { RoomScene, WORLD_H, WORLD_W } from "./world/room-scene";
import { LoomScene } from "./ui/loom-view";
import { FilmScene } from "./world/film-scene";
import { TitleScene } from "./world/title-scene";
import { HudImpl } from "./ui/hud";
import { runCalibration } from "./ui/settings";
import { h, clear, append, weave } from "./ui/dom";

declare const __DEBUG__: boolean;

const settings = readSettings();
const g = new Game(settings);
const stage = h("div", { id: "stage" });
const canvasHost = h("div", { id: "game" });
stage.append(canvasHost);
document.getElementById("app")!.append(stage);
const hud = new HudImpl(g, stage);
g.hud = hud;

const room = new RoomScene();
const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: canvasHost,
  width: WORLD_W,
  height: WORLD_H,
  backgroundColor: "#0d0b14",
  pixelArt: true,
  roundPixels: true,
  audio: { noAudio: true },
  input: { keyboard: false },
  scale: { mode: Phaser.Scale.NONE, zoom: 1 },
  scene: [],
  banner: false,
});
hud.phaser = phaser;
phaser.scene.add("room", room, true, { game: g });
phaser.scene.add("loom", new LoomScene(), false);
phaser.scene.add("film", new FilmScene(), false);
phaser.scene.add("title", new TitleScene(), false);
room.onHover = (label, x, y) => hud.hover(label, x, y);
hud.scene = room;

// ---- whole-number scaling (GDD 7.1) ----------------------------------------------------------------

function layout(): void {
  const w = window.innerWidth;
  const hgt = window.innerHeight;
  const fit = Math.min(w / WORLD_W, hgt / WORLD_H);
  // Whole numbers only; below 1x there is no whole number, so the stage shrinks (DECISIONS.md D-023).
  const s = fit >= 1 ? Math.floor(fit) : fit;
  stage.style.setProperty("--s", String(s));
  stage.style.width = `${WORLD_W * s}px`;
  stage.style.height = `${WORLD_H * s}px`;
  phaser.scale.setZoom(s);
  const ts = { s: 0.85, m: 1, l: 1.25 }[settings.textSize];
  stage.style.setProperty("--ts", String(ts));
  document.body.classList.toggle("contrast", settings.contrast);
  document.body.classList.toggle("plainfont", !settings.pixelFont);
  document.body.classList.toggle("portrait", hgt > w && w < WORLD_W);
}
window.addEventListener("resize", layout);
layout();
hud.settings.onApply = () => {
  layout();
  refreshTitleMusic();
};

// ---- the title screen ---------------------------------------------------------------------------------

const title = h("div", { id: "title" });
stage.append(title);

// the living backdrop runs whenever the title is showing and the art has loaded
let loaded = false;
let backdropOn = false;
function backdrop(on: boolean): void {
  stage.classList.toggle("at-title", on);
  const want = on && loaded;
  if (want === backdropOn) return;
  backdropOn = want;
  title.classList.toggle("live", want);
  if (want) phaser.scene.run("title");
  else phaser.scene.stop("title");
}
// however the title gets hidden or shown (the menu, a quit, the debug API), the backdrop follows it
new MutationObserver(() => backdrop(!title.classList.contains("hidden"))).observe(title, { attributes: true, attributeFilter: ["class"] });
room.onLoaded = () => {
  loaded = true;
  backdrop(!title.classList.contains("hidden"));
};
const bar = h("div", { class: "load-bar" }, h("span"));
room.onProgress = (p) => ((bar.firstChild as HTMLElement).style.width = `${Math.round(p * 100)}%`);

function showTitle(): void {
  clear(title);
  title.classList.remove("hidden");
  title.append(
    h("div", { class: "title-head" }, h("h1", { "aria-label": t("title.name") }, t("title.logo")), weave(), h("p", { class: "subtitle" }, t("title.sub"))),
    h("div", { class: "title-foot" }, bar, h("button", { class: "big", id: "begin", onclick: begin }, t("ui.begin")), h("p", { class: "fine" }, t("title.free"))),
  );
  refreshTitleMusic();
  title.append(titleMusic);
  (title.querySelector("#begin") as HTMLButtonElement).focus();
}

// Browsers keep sound off until the first click; any click on the title starts the title music (D-046).
let audioStarted: Promise<void> | null = null;
function wakeAudio(): Promise<void> {
  audioStarted ??= (async () => {
    await g.conductor.start(96);
    g.audioReady();
    g.playSong("title");
  })();
  return audioStarted;
}
title.addEventListener("pointerdown", () => void wakeAudio());

// A music switch on the title screen too: some players will want silence from the first second.
const titleMusic = h("button", {
  class: "title-music",
  onclick: () => {
    g.setMusicOn(!settings.musicOn);
    refreshTitleMusic();
  },
});
function refreshTitleMusic(): void {
  titleMusic.textContent = settings.musicOn ? t("ui.music_is_on") : t("ui.music_is_off");
  titleMusic.classList.toggle("off", !settings.musicOn);
  titleMusic.setAttribute("aria-pressed", String(settings.musicOn));
}

async function begin(): Promise<void> {
  await wakeAudio();
  if (!settings.calibrated && !g.fast) await runCalibration(g);
  showMenu();
}

function showMenu(): void {
  clear(title);
  const save = readSave();
  let diff: Difficulty = "standard";
  const diffs: Difficulty[] = ["practice", "standard", "expert"];
  const pick = h("div", { class: "difficulty", role: "radiogroup", "aria-label": t("set.difficulty") });
  const renderPick = () => {
    clear(pick);
    for (const d of diffs) {
      pick.append(h("button", { role: "radio", "aria-checked": String(d === diff), class: d === diff ? "on" : "", onclick: () => { diff = d; renderPick(); } }, h("strong", {}, t(`diff.${d}`)), h("small", {}, t(`diff.${d}.help`))));
    }
  };
  renderPick();
  const foot = h("div", { class: "title-foot" });
  append(
    foot,
    save ? h("button", { class: "big", id: "continue", onclick: () => start(() => g.load(save)) }, t("menu.continue")) : null,
    h("div", { class: "newgame" }, pick, h("button", { class: "big", id: "newgame", onclick: () => void newGame(diff) }, t("menu.new"))),
    h("div", { class: "title-links" }, h("button", { class: "link", id: "howto", onclick: () => void hud.guide.open() }, t("ui.howto")), h("button", { class: "link", onclick: () => hud.settings.open() }, t("ui.menu"))),
  );
  append(title, h("div", { class: "title-head" }, h("h1", { "aria-label": t("title.name") }, t("title.logo")), weave(), h("p", { class: "subtitle" }, t("title.sub"))), foot);
  refreshTitleMusic();
  title.append(titleMusic);
  (title.querySelector("button.big") as HTMLButtonElement).focus();
}

/** A first new game opens with the guide to how to play (D-049); it stays in the menus after that. */
async function newGame(diff: Difficulty): Promise<void> {
  if (!settings.guideSeen) await hud.guide.open();
  start(() => g.newGame(newSeed(), diff));
}

function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

function start(fn: () => void): void {
  const go = () => {
    title.classList.add("hidden");
    backdrop(false);
    fn();
  };
  if (g.view) go();
  else room.onReady = go;
}

hud.settings.onQuit = () => {
  g.persist(true);
  hud.settings.close();
  g.closeLoom();
  showMenu();
  title.classList.remove("hidden");
  backdrop(true);
};

// ---- keyboard, gamepad, frame tick --------------------------------------------------------------------

let revealHeld = false;
let tabIndex = -1;

function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  return el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
}

window.addEventListener("keydown", (e) => {
  if (typing(e) || !g.save || !title.classList.contains("hidden")) return;
  if (document.getElementById("calibration") || hud.guide.isOpen) return;
  const k = e.key;
  if (hud.filming) {
    if (k === "Escape") hud.skipFilm();
    else if (k === " " || k === "Enter") {
      e.preventDefault();
      hud.skip();
    }
    return;
  }
  if (k >= "1" && k <= "8" && !e.repeat) {
    g.playNote((Number(k) - 1) as NoteIndex);
    return;
  }
  if (hud.book.isOpen || hud.settings.isOpen) {
    if (k === "Escape") {
      hud.book.close();
      hud.settings.close();
    }
    return;
  }
  if (k === " " || k === "Enter") {
    if (hud.advance && document.activeElement?.tagName !== "BUTTON") {
      e.preventDefault();
      hud.advance();
      return;
    }
    if (hud.skip()) {
      e.preventDefault();
      return;
    }
    if (k === "Enter" && g.selection?.kind === "hotspot" && document.activeElement === document.body) {
      void g.clickHotspot(g.selection.id, true);
    }
  } else if (k === "h" || k === "H") {
    if (!revealHeld) hud.reveal((revealHeld = true));
  } else if (k === "Tab" && !g.loom && !g.busy) {
    e.preventDefault();
    const hs = g.hotspots().filter((x) => x.id !== "_self");
    if (!hs.length) return;
    tabIndex = (tabIndex + (e.shiftKey ? -1 : 1) + hs.length) % hs.length;
    g.select({ kind: "hotspot", id: hs[tabIndex].id });
    hud.announce(t(hs[tabIndex].name));
  } else if (k === "Escape") {
    if (g.loom) g.closeLoom();
    else g.select(null);
  } else if (k === "b" || k === "B") hud.book.open();
  else if (k === "m" || k === "M") hud.settings.open();
  else if (k === "k" || k === "K" || k === "?") void g.hint();
  else if (k === "c" || k === "C") {
    if (g.loom) g.closeLoom();
    else g.comb();
  } else if (k === "r" || k === "R") {
    if (g.spindle.capacity) g.spindle.setArmed(!g.spindle.armed);
  } else if (k === "[" || k === "]") {
    const n = g.spindle.capacity;
    if (n) g.spindle.select((g.spindle.selected + (k === "]" ? 1 : n - 1)) % n);
  } else if (k === "Backspace" || k === "Delete") {
    if (g.spindle.capacity) g.spindle.clear(g.spindle.selected);
  } else if (g.loom) loomKeys(e);
});

window.addEventListener("keyup", (e) => {
  if (e.key === "h" || e.key === "H") hud.reveal((revealHeld = false));
  if ((e.key === "i" || e.key === "I") && g.loom) g.isolate(null);
});

function loomKeys(e: KeyboardEvent): void {
  const lv = g.loom!;
  const rows = lv.song.model.stems().filter((s) => !s.golden).map((s) => s.id);
  const cur = g.selection?.kind === "thread" ? rows.indexOf(g.selection.stem) : -1;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const next = rows[(cur + (e.key === "ArrowDown" ? 1 : rows.length - 1) + rows.length) % rows.length];
    hud.selectThread(next);
    hud.announce(t(lv.song.model.stem(next)!.label));
  } else if ((e.key === "p" || e.key === "P") && cur >= 0) {
    g.pull(rows[cur]);
    hud.refresh();
  } else if ((e.key === "i" || e.key === "I") && cur >= 0 && !e.repeat) g.isolate(rows[cur]);
  else if ((e.key === "y" || e.key === "Y") && cur >= 0) {
    g.copyToSpool(rows[cur]);
    hud.refresh();
  }
}

const pad = { prevButtons: [] as boolean[], sector: null as number | null };

function pollGamepad(): void {
  const gp = navigator.getGamepads?.().find((p) => p);
  if (!gp || !g.save) return;
  const pressed = gp.buttons.map((b) => b.pressed);
  const edge = (i: number) => pressed[i] && !pad.prevButtons[i];
  const rx = gp.axes[2] ?? 0;
  const ry = gp.axes[3] ?? 0;
  if (Math.hypot(rx, ry) > 0.5) {
    const a = Math.atan2(ry, rx) + Math.PI / 2;
    pad.sector = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  } else pad.sector = null;
  hud.wheelState(pad.sector);
  if (edge(0)) {
    if (pad.sector !== null) g.playNote(pad.sector as NoteIndex);
    else if (!hud.skip()) hud.advance?.();
  }
  if (edge(2) && g.selection?.kind === "hotspot") void g.clickHotspot(g.selection.id, true);
  if (edge(1)) {
    if (g.loom) g.closeLoom();
    else g.select(null);
  }
  if (edge(3)) void g.hint();
  if (edge(9)) hud.settings.open();
  if (edge(4) || edge(5)) {
    const n = g.spindle.capacity;
    if (n) g.spindle.select((g.spindle.selected + (edge(5) ? 1 : n - 1)) % n);
  }
  if (edge(6) && g.spindle.capacity) g.spindle.setArmed(!g.spindle.armed);
  if (edge(14) || edge(15)) {
    const hs = g.hotspots().filter((x) => x.id !== "_self");
    if (hs.length) {
      tabIndex = (tabIndex + (edge(15) ? 1 : hs.length - 1)) % hs.length;
      g.select({ kind: "hotspot", id: hs[tabIndex].id });
      void g.walkToHotspot(hs[tabIndex]);
    }
  }
  pad.prevButtons = pressed;
}

function frame(): void {
  pollGamepad();
  hud.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Skein is the hint system: tap her (GDD 4.7).
room.onSkein = () => void g.hint();

window.addEventListener("pagehide", () => g.persist(true));
window.addEventListener("beforeunload", () => {
  g.persist(true);
  writeSettings(settings);
});

const framed = (() => {
  try {
    return window.top !== window;
  } catch {
    return true;
  }
})();
if ("serviceWorker" in navigator && location.protocol === "https:" && !framed && !(typeof __DEBUG__ !== "undefined" && __DEBUG__)) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

if (typeof __DEBUG__ !== "undefined" && __DEBUG__) {
  void import("./debug/api").then((m) => m.install(g, hud, { begin, start, showMenu }));
}

document.title = t("title.name");
document.getElementById("app")!.dataset.rotate = t("ui.rotate");
showTitle();
