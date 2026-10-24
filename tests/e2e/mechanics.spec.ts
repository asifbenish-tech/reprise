// Wrong moves teach and never dead-end; saves restore; the Spindle keeps time (GDD 6, 9.8).
import { expect, test } from "@playwright/test";
import { RELEASE_1, boot, solve, state, step, watchErrors } from "./helpers";

const upTo = (id: string) => RELEASE_1.slice(0, RELEASE_1.indexOf(id));

test("an offline bar with two spools lands every note within 1 ms", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__reprise);
  const r = await page.evaluate(() => (window as any).__reprise.timingTest());
  expect(r.notes).toBe(8);
  expect(r.detail.every((d: number[]) => Number.isFinite(d[2]))).toBe(true);
  expect(r.maxErrorMs).toBeLessThan(1);
});

test("a save restores the room, drafts and notes after a reload", async ({ page }) => {
  await boot(page, 4242);
  await solve(page, upTo("A1-1"));
  const before = await state(page);
  await page.evaluate(() => (window as any).__reprise.g.persist(true));
  await page.reload();
  await page.waitForFunction(() => (window as any).__reprise);
  await page.evaluate(() => (window as any).__reprise.resume({ fast: true, tempo: 4 }));
  const after = await state(page);
  expect(after.room).toBe(before.room);
  expect(after.learned.sort()).toEqual(before.learned.sort());
  expect(after.notes).toBe(3);
  await solve(page, ["A1-1"]);
});

test("puzzle 1: pulling everything is a joke, and an unknown draft does nothing", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, 99);
  await solve(page, upTo("A1-5"));
  await step(page, "walk:rehearsal_hall");
  // Unmasking isn't learned yet: the phrase fails, nothing is cast
  const ph = await page.evaluate(() => (window as any).__reprise.phrase("unmasking"));
  await page.evaluate((p: number[]) => { const g = (window as any).__reprise.g; g.select({ kind: "hotspot", id: "lyrix" }); for (const n of p) g.playNote(n); }, ph);
  expect((await state(page)).flags.lyra_unmasked).toBeFalsy();
  for (const s of ["comb:hook_engine", "pull:kick", "pull:bass", "pull:supersaw", "pull:vocal", "pull:riser"]) await step(page, s);
  await step(page, "flag:said_miming");
  await step(page, "close");
  await solve(page, ["A1-5"]);
  expect(errors).toEqual([]);
});

test("the conveyor needs a loop, and the Sidechain Gate punishes the wrong order without a dead end", async ({ page }) => {
  await boot(page, 2024);
  await solve(page, upTo("A2-3"));
  // one Quickening: the conveyor slows halfway
  await step(page, "walk:press_floor");
  await step(page, "cast:quickening>hotspot:conveyor");
  await step(page, "exit:conveyor_up");
  expect((await state(page)).room).toBe("press_floor");
  await solve(page, ["A2-3", "A2-4", "A2-5"]);
  // Hushing looped on the kick before covering it: the alarm sounds and the foreman clears the spool
  for (const s of ["walk:floor3", "clear:1", "clear:2", "comb:speakers", "spool:2", "arm", "cast:hushing>thread:kick", "close"]) await step(page, s);
  await step(page, "flag:said_two_kicks").catch(() => {});
  await page.waitForFunction(() => (window as any).__reprise.g.spindle.spool(1) === null, null, { timeout: 60_000 });
  expect((await state(page)).flags.gate_passed).toBeFalsy();
  // the right order still works afterwards, once Preset Zero is open
  await solve(page, ["A2-11", "A2-6"]);
  expect((await state(page)).room).toBe("dominic_studio");
});

test("a click selects the locked gate, so the player can aim Opening at it with the keys", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, 77);
  await solve(page, ["P1", "P2", "P3"]);
  await step(page, "walk:park_gate");
  const box = (await page.locator("#stage").boundingBox())!;
  // the gate's centre in art pixels (490, 200), scaled to the stage
  await page.mouse.click(box.x + (490 / 640) * box.width, box.y + (200 / 360) * box.height);
  await page.waitForFunction(() => (window as any).__reprise.g.selection?.id === "gate", null, { timeout: 5000 });
  await page.waitForFunction(() => !(window as any).__reprise.g.busy, null, { timeout: 10000 });
  const ph: number[] = await page.evaluate(() => (window as any).__reprise.phrase("opening"));
  for (const n of ph) await page.keyboard.press(String(n + 1));
  await page.waitForFunction(() => (window as any).__reprise.g.flag("gate_open"), null, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test("a first new game opens the guide, and the Crossing shows how to answer the call", async ({ page }) => {
  const errors = watchErrors(page);
  // a first visit, with the latency check already done
  await page.addInitScript(() => localStorage.setItem("reprise.settings.v1", JSON.stringify({ calibrated: true })));
  await page.goto("/");
  await page.waitForSelector("#title.live", { timeout: 30000 });
  await page.click("#begin");
  await page.click("#newgame");
  await expect(page.locator("#guide")).toBeVisible();
  for (let i = 0; i < 5; i++) await page.evaluate(() => (document.getElementById("guide-next") as HTMLButtonElement).click());
  await expect(page.locator("#guide")).toBeHidden();
  await page.waitForSelector(".film-skip", { timeout: 60000 });
  await page.click(".film-skip");
  await page.waitForFunction(() => (window as any).__reprise.g.flag("await_opening"), null, { timeout: 120000 });
  await expect(page.locator("#tip")).toBeVisible({ timeout: 20000 });
  // answering the call takes the tip away
  const ph: number[] = await page.evaluate(() => (window as any).__reprise.phrase("opening"));
  for (const n of ph) await page.keyboard.press(String(n + 1));
  await page.waitForFunction(() => !(window as any).__reprise.g.flag("await_opening"), null, { timeout: 20000 });
  await expect(page.locator("#tip")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("reprise.settings.v1")!).guideSeen)).toBe(true);
  expect(errors).toEqual([]);
});

test("the Chairman meets Bobbin once, at the first visit to the Spire, and is refused", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, 2026);
  await solve(page, upTo("A1-1"));
  await step(page, "walk:spire_lobby");
  await page.waitForFunction(() => (window as any).__reprise.g.flag("chairman_met") && !(window as any).__reprise.g.busy, null, { timeout: 20000 });
  expect((await state(page)).flags.chairman_here).toBeFalsy();
  // out and back in: no second meeting
  await step(page, "walk:street");
  await step(page, "walk:spire_lobby");
  expect(await page.evaluate(() => (window as any).__reprise.g.busy)).toBe(false);
  await solve(page, ["A1-1"]);
  expect(errors).toEqual([]);
});

test("the factory gate waits until Bobbin has found the Song of Originality", async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page, 31);
  await solve(page, upTo("A2-11"));
  await step(page, "walk:floor3");
  await step(page, "exit:gate");
  expect((await state(page)).room).toBe("floor3");
  expect((await state(page)).flags.gate_passed).toBeFalsy();
  await solve(page, ["A2-11", "A2-6"]);
  expect((await state(page)).flags.gate_passed).toBe(true);
  expect(errors).toEqual([]);
});
