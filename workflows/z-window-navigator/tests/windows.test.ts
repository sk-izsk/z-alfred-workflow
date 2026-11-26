import { expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { matchesWindow, type WindowItem } from "../../../shared/window-access.ts";
import { create, read, save } from "../src/state.ts";
const root = mkdtempSync(join(tmpdir(), "window-test-")),
  prior = process.env.alfred_workflow_cache;
process.env.alfred_workflow_cache = root;
afterAll(() => {
  if (prior === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = prior;
  rmSync(root, { recursive: true, force: true });
});
const example: WindowItem = {
  id: "12:0",
  pid: 12,
  bundle: "example.app",
  app: "Example",
  title: "Project Notes",
  index: 0,
  position: [10, 20],
  size: [400, 300],
  minimized: false,
  onscreen: true,
  appPath: "/Applications/Example.app",
};
test("search spans application and title; action only emits a validated handoff", () => {
  expect(matchesWindow(example, "example notes")).toBe(true);
  expect(matchesWindow(example, "missing")).toBe(false);
  const s = create("notes", ""),
    invoke = (cmd: string, ...args: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, s.id, ...args], {
          encoding: "utf8",
          env: process.env,
        }),
      );
  s.items = [example];
  save(s);
  expect(invoke("open", example.id).finish.variables.wnav_target).toBe(example.id);
  expect(invoke("query", "new query").update.ids.query).toBeUndefined();
  expect(read(s.id).query).toBe("new query");
  const menu = JSON.stringify(invoke("menu", example.id));
  expect(menu).toContain("Close Window");
  expect(menu).not.toContain('"Back');
});

import { visibleWindow } from "../../../shared/window-access.ts";
import { windowInput } from "../src/launch.ts";
test("Stage Manager thumbnails match the owning app and title despite scaled geometry", () => {
  const thumbnail = {
    kCGWindowOwnerPID: 12,
    kCGWindowLayer: 0,
    kCGWindowName: "Project Notes",
    kCGWindowBounds: { X: 15, Y: 500, Width: 160, Height: 100 },
  };
  expect(visibleWindow(example, [thumbnail])).toBe(true);
  expect(visibleWindow(example, [{ ...thumbnail, kCGWindowOwnerPID: 99 }])).toBe(false);
  expect(visibleWindow(example, [{ ...thumbnail, kCGWindowName: "Other window" }])).toBe(false);
  expect(visibleWindow(example, [])).toBe(false);
});
test("the wins keyword opens the same navigator in current-desktop mode", () => {
  expect(windowInput("desktop:notes")).toEqual({ query: "notes", returnTo: "", scope: "desktop" });
  expect(windowInput("notes").scope).toBe("all");
});

test("Stage Manager stale thumbnail titles fall back only when visible and accessible counts agree", () => {
  const thumbnail = {
    kCGWindowOwnerPID: 12,
    kCGWindowLayer: 0,
    kCGWindowName: "Older tab title",
    kCGWindowBounds: { X: 15, Y: 500, Width: 160, Height: 100 },
  };
  expect(visibleWindow(example, [thumbnail], 1)).toBe(true);
  expect(visibleWindow(example, [thumbnail], 2)).toBe(false);
});
