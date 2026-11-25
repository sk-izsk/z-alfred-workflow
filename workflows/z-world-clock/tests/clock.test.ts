import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { clock, offset, relative, matches, zones, canonical } from "../src/model.ts";
import { create, read, save, entries, duplicate, editStar } from "../src/state.ts";
import { clockPNG } from "../src/face.ts";
import { components } from "../ui/window.ts";
const root = mkdtempSync(join(tmpdir(), "clock-tests-")),
  before = { ...process.env };
process.env.alfred_workflow_data = join(root, "data");
process.env.alfred_workflow_cache = join(root, "cache");
afterAll(() => {
  for (const key of ["alfred_workflow_data", "alfred_workflow_cache"]) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
  rmSync(root, { recursive: true, force: true });
});
const now = Date.parse("2026-11-25T20:15:00Z");
const invoke = (cmd: string, id: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, id, ...args], {
      encoding: "utf8",
      env: process.env,
    }),
  );
test("DST is calculated at the instant rather than a stored UTC offset", () => {
  expect(offset("America/New_York", Date.parse("2026-03-08T06:59Z"))).toBe(-300);
  expect(offset("America/New_York", Date.parse("2026-03-08T07:00Z"))).toBe(-240);
});
test("fractional offsets, local dates and 12/24 hour formats", () => {
  expect(clock("Asia/Kathmandu", now)).toMatchObject({
    time: "02:00",
    date: "2026-11-26",
    offset: 345,
    utc: "UTC+05:45",
  });
  expect(offset("Asia/Kolkata", now)).toBe(330);
  expect(clock("Asia/Tokyo", now, false).time).toBe("5:15 AM");
  expect(clock("UTC", now, true, "eu").date).toBe("25/11/2026");
  expect(relative(-210)).toBe("3.5h behind");
});
test("catalog searches representative cities, countries and aliases", () => {
  expect(zones().length).toBeGreaterThan(350);
  const e = { id: "x", zone: "Asia/Dhaka", alias: "Family", memo: "Call parents", emoji: "", avatar: "" };
  for (const query of ["Bangladesh", "Dhaka", "family", "parents"]) expect(matches(e, query)).toBe(true);
  expect(matches(e, "Tokyo")).toBe(false);
  expect(() => canonical("Invalid/Timezone")).toThrow();
});
test("duplicated stars have stable independent IDs and alias/memo persistence", () => {
  const s = create("");
  const original = s.prefs.stars[0]!;
  duplicate(s, original.id);
  const second = s.prefs.stars[1]!;
  expect(second.zone).toBe(original.zone);
  expect(second.id).not.toBe(original.id);
  editStar(s, second.id, { alias: "Team", memo: "Morning calls" });
  expect(read(s.id).prefs.stars[1]).toMatchObject({ alias: "Team", memo: "Morning calls" });
  expect(entries(s).filter((e) => e.zone === original.zone)).toHaveLength(2);
});
test("analog images are valid transparent RGBA PNGs and reflect hand positions", () => {
  const data = clockPNG(3, 15);
  expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(data.readUInt32BE(16)).toBe(128);
  const chunks: Buffer[] = [];
  let at = 8;
  while (at < data.length) {
    const size = data.readUInt32BE(at),
      kind = data.subarray(at + 4, at + 8).toString();
    if (kind === "IDAT") chunks.push(data.subarray(at + 8, at + 8 + size));
    at += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  expect(raw.length).toBe((128 * 4 + 1) * 128);
  expect(raw[4]).toBe(0);
  expect(data.equals(clockPNG(9, 45))).toBe(false);
});
test("search and minute ticks preserve the existing text field and selection", () => {
  const s = create("");
  const changed = invoke("query", s.id, "Dhaka");
  expect(changed.update.ids).not.toHaveProperty("root");
  expect(changed.update.ids).not.toHaveProperty("search");
  expect(changed.update.ids.items.data.src.some((e: any) => e["clockTitle.text"].includes("Dhaka"))).toBe(
    true,
  );
  const tick = invoke("tick", s.id);
  expect(tick.update.ids).not.toHaveProperty("root");
  expect(invoke("tick", s.id)).toEqual({});
});
test("native list and grid IDs stay unique and arrow keys navigate both axes", () => {
  const s = create("");
  for (const layout of ["list", "grid"] as const) {
    s.prefs.layout = layout;
    const ids: string[] = [];
    const visit = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(visit);
        return;
      }
      const o = v as Record<string, unknown>;
      if (typeof o.id === "string") ids.push(o.id);
      Object.values(o).forEach(visit);
    };
    visit(components(s));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("back");
  }
});
test("reference actions exist and sheets close to their parent", () => {
  const s = create("");
  s.selected = s.prefs.stars[1]!.id;
  save(s);
  const menu = invoke("menu", s.id).popupmenu.menu.map((e: { text: string }) => e.text);
  for (const title of [
    "Copy Time",
    "Copy All Info",
    "Show Timezone Details",
    "Unstar Timezone",
    "Edit Timezone…",
    "Duplicate Timezone",
    "Move Up",
    "Move Down",
    "Switch to Grid View",
    "World Clock Preferences…",
  ])
    expect(menu.some((text: string) => text.startsWith(title))).toBe(true);
  expect(menu.some((text: string) => text.startsWith("Back"))).toBe(false);
  expect(JSON.stringify(invoke("edit", s.id))).toContain("editSheetBack");
  expect(invoke("back", s.id).finish.variables.clock_out).toBe("back");
});
