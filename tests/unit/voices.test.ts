import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasLine } from "../../src/audio/voice-lines";

const strings = JSON.parse(readFileSync(new URL("../../content/strings/en.json", import.meta.url), "utf8")) as Record<string, string>;
const names = JSON.parse(readFileSync(new URL("../../content/names.json", import.meta.url), "utf8")) as { sets: Record<string, Record<string, string>> };
const index = JSON.parse(readFileSync(new URL("../../assets/voice/index.json", import.meta.url), "utf8")) as { sprites: string[]; lines: Record<string, [number, number, number]> };
const shown = (key: string, set: string) => strings[key].replace(/\{(\w+)\}/g, (m, k: string) => names.sets[set][k] ?? m);

describe("spoken lines (D-044)", () => {
  it("finds a recording the way the game shows the line, in both name sets", () => {
    for (const set of Object.keys(names.sets)) {
      expect(hasLine("bobbin", shown("pond.land1", set)), `pond.land1 ${set}`).toBe(true);
      expect(hasLine("bobbin", shown("film.island1", set)), `film.island1 ${set}`).toBe(true);
      expect(hasLine("receptionist", shown("dlg.receptionist.a1", set)), `receptionist ${set}`).toBe(true);
    }
  });
  it("keeps the swans silent and never voices a line for the wrong speaker", () => {
    expect(hasLine("skein", strings["pond.skein_honk"])).toBe(false);
    expect(hasLine("lyra", strings["pond.land1"])).toBe(false);
  });
  it("points every line at a sprite that exists", () => {
    for (const [, [sprite, start, dur]] of Object.entries(index.lines)) {
      expect(sprite).toBeLessThan(index.sprites.length);
      expect(start).toBeGreaterThan(0);
      expect(dur).toBeGreaterThan(0.2);
    }
    for (const f of index.sprites) expect(existsSync(new URL(`../../assets/voice/${f}`, import.meta.url))).toBe(true);
  });
});

describe("Marcus's memory (D-045)", () => {
  it("is told in Marcus's voice", () => {
    for (const k of ["mem.1", "mem.3", "mem.6", "dlg.marcus_memory.n3"]) expect(hasLine("marcus", strings[k]), k).toBe(true);
    expect(hasLine("bobbin", strings["street.drained2"])).toBe(true);
  });
});
