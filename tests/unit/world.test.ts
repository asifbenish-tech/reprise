import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RoomDef } from "../../src/content/types";
import { check, validCondition } from "../../src/world/flags";
import { clampInside, findPath, inside, standBeside, type Pt } from "../../src/world/walker";
import { STAFF_TIP } from "../../src/world/staff-tip";
import { BOBBIN_TIP } from "../../tools/figures";

const SCENE_H = 296; // src/world/room-scene.ts: the panel starts here

describe("conditions", () => {
  const s = { flags: { a: true }, learned: ["tuning"], solved: ["P1"], ownedNotes: 4, tools: ["combing"], capacity: 2 };
  it("joins terms with & and negates with !", () => {
    expect(check(s, "flag:a&draft:tuning&puzzle:P1&note:f&tool:combing&spools:2")).toBe(true);
    expect(check(s, "!flag:a")).toBe(false);
    expect(check(s, "note:g")).toBe(false);
    expect(check(s, undefined)).toBe(true);
  });
  it("rejects unknown terms", () => {
    expect(validCondition("flag:x&weird:y")).toBe(false);
  });
});

describe("walking (GDD 9.7)", () => {
  const rooms = readdirSync(new URL("../../content/rooms/", import.meta.url)).map(
    (f) => JSON.parse(readFileSync(new URL(`../../content/rooms/${f}`, import.meta.url), "utf8")) as RoomDef,
  );
  it("every entry and hotspot stand point can be reached inside the walkable polygon", () => {
    for (const r of rooms) {
      if (r.swan && r.id === "crossing") continue;
      const poly = r.walk as Pt[];
      for (const [name, p] of Object.entries(r.entries)) {
        const start = clampInside(poly, p as Pt);
        for (const h of r.hotspots) {
          const goal: Pt = h.stand ?? [h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] + 6];
          const path = findPath(poly, start, goal);
          const end = path[path.length - 1];
          expect(inside(poly, end), `${r.id}: ${name} -> ${h.id}`).toBe(true);
        }
      }
    }
  });
});

describe("content", () => {
  it("passes schema and reference validation (tools/validate-content.ts)", () => {
    const out = execFileSync("npx", ["tsx", "tools/validate-content.ts"], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
    expect(out).toMatch(/content ok/);
  });
});

describe("the LOOM layout (GDD 4.1)", () => {
  const rooms = readdirSync(new URL("../../content/rooms/", import.meta.url)).map(
    (f) => JSON.parse(readFileSync(new URL(`../../content/rooms/${f}`, import.meta.url), "utf8")) as RoomDef,
  );
  it("keeps every walkable point above the panel, so Bobbin's feet stay in the scene", () => {
    for (const r of rooms) for (const [, y] of r.walk as Pt[]) expect(y, r.id).toBeLessThan(SCENE_H);
  });
  it("puts the casting light where the sprite painter drew the Distaff's tip", () => {
    expect(STAFF_TIP).toEqual(BOBBIN_TIP);
  });
});

describe("standing beside things (owner: never on top of them)", () => {
  const rooms = readdirSync(new URL("../../content/rooms/", import.meta.url)).map(
    (f) => JSON.parse(readFileSync(new URL(`../../content/rooms/${f}`, import.meta.url), "utf8")) as RoomDef,
  );
  it("puts Bobbin clear of every small thing he walks up to, from either side of the room", () => {
    const blocked: string[] = [];
    for (const r of rooms) {
      if (r.swan && r.id === "crossing") continue;
      for (const h of r.hotspots) {
        const [x, , w] = h.rect;
        if (h.id === "_self" || w > 140 || x + w < 0 || x > r.width) continue;
        for (const from of [0, r.width]) {
          const [sx] = standBeside(r.walk as Pt[], h.rect as [number, number, number, number], from);
          if (Math.abs(sx - (x + w / 2)) < w / 2 + 10) blocked.push(`${r.id}/${h.id} from ${from}: x ${Math.round(sx)}`);
        }
      }
    }
    expect(blocked).toEqual([]);
  });
});
