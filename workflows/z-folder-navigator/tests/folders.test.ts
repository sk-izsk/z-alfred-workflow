import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { children, item, predicate, search, pathInput, favorites, mountedDrives } from "../src/files.ts";
import { create, read, save, push } from "../src/state.ts";
import { components } from "../ui/window.ts";
const root = mkdtempSync(join(tmpdir(), "folders-tests-")),
  prior = process.env.alfred_workflow_cache;
process.env.alfred_workflow_cache = join(root, "cache");
const demo = join(root, "Demo"),
  a = join(demo, "A"),
  b = join(a, "B");
mkdirSync(b, { recursive: true });
writeFileSync(join(demo, "Readme.txt"), "Example");
writeFileSync(join(demo, ".hidden"), "Example");
mkdirSync(join(demo, "Demo.app"));
symlinkSync(a, join(demo, "Link"));
afterAll(() => {
  if (prior === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = prior;
  rmSync(root, { recursive: true, force: true });
});
const invoke = (command: string, id: string, level: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), command, id, level, ...args], {
      encoding: "utf8",
      env: process.env,
    }),
  );
const load = (id: string) => {
  const s = read(id);
  return invoke("load", id, s.level, s.request);
};
test("directory listing classifies packages and links, sorts folders first and filters hidden names", async () => {
  const visible = await children(demo);
  expect(visible.items.some((e) => e.name === ".hidden")).toBe(false);
  expect((await children(demo, true)).items.some((e) => e.name === ".hidden")).toBe(true);
  expect((await item(join(demo, "Demo.app"))).kind).toBe("package");
  expect((await item(join(demo, "Link"))).directory).toBe(true);
  expect(visible.items[0]!.kind).toBe("folder");
  expect((await children(demo, false, "read")).items.map((e) => e.name)).toEqual(["Readme.txt"]);
});
test("literal paths bypass Spotlight while search predicates quote operators and enforce bounds", async () => {
  expect((await search(demo, "", false)).items[0]!.uid).toBe(demo);
  expect(() => pathInput("relative/path")).toThrow("absolute");
  expect(() => pathInput("/tmp/\0bad")).toThrow();
  expect(predicate('name" || x')).toContain('name\\"');
  expect(() => predicate("x".repeat(301))).toThrow("300");
  expect(predicate("test")).toContain("public.folder");
});
test("folder history restores every query and selection; old level events cannot corrupt Back", () => {
  const s = create(demo, "6b2e51b0-d9d1-41b8-a405-d24feafba521");
  load(s.id);
  const entered = invoke("enter", s.id, s.level, demo);
  expect(entered.update.ids.root).toBeUndefined();
  load(s.id);
  let current = read(s.id);
  expect(current.path).toBe(demo);
  invoke("query", s.id, current.level, "a");
  load(s.id);
  current = read(s.id);
  invoke("enter", s.id, current.level, a);
  load(s.id);
  current = read(s.id);
  invoke("enter", s.id, current.level, b);
  load(s.id);
  const deepest = read(s.id);
  expect(deepest.history).toHaveLength(3);
  invoke("back", s.id, deepest.level);
  load(s.id);
  current = read(s.id);
  expect(current.path).toBe(a);
  expect(current.selected).toBe(b);
  expect(invoke("select", s.id, deepest.level, join(demo, "Readme.txt"))).toEqual({});
  expect(read(s.id).selected).toBe(b);
  invoke("back", s.id, current.level);
  load(s.id);
  current = read(s.id);
  expect(current.path).toBe(demo);
  expect(current.query).toBe("a");
  expect(current.selected).toBe(a);
  invoke("back", s.id, current.level);
  load(s.id);
  current = read(s.id);
  expect(current.mode).toBe("search");
  expect(current.query).toBe(demo);
  expect(current.selected).toBe(demo);
  const finish = invoke("back", s.id, current.level);
  expect(finish.finish.variables.swiss_return).toBe(s.returnTo);
});
test("typing never rebuilds the search field and an older queued search cannot replace the new query", () => {
  const s = create("");
  const first = invoke("query", s.id, s.level, "first");
  const second = invoke("query", s.id, s.level, "second");
  expect(first.update.ids.root).toBeUndefined();
  expect(second.update.ids.query).toBeUndefined();
  expect(invoke("load", s.id, s.level, first.pulse.args[3])).toEqual({});
  expect(read(s.id).query).toBe("second");
});
test("a vanished folder shows an error while retaining its parent navigation", () => {
  const path = join(root, "Vanishing");
  mkdirSync(path);
  const s = create("");
  s.mode = "browse";
  s.path = demo;
  save(s);
  push(s, { path, query: "", selected: "" });
  rmSync(path, { recursive: true });
  const error = load(s.id);
  expect(error.update.ids.statusLabel.colour).toBe("systemRedColor");
  const current = read(s.id);
  invoke("back", s.id, current.level);
  load(s.id);
  expect(read(s.id).path).toBe(demo);
  expect(read(s.id).error).toBe(false);
});
test("menus contain file actions and current-folder actions, with Back exclusively in the footer", () => {
  const s = create("");
  s.mode = "browse";
  s.path = demo;
  save(s);
  load(s.id);
  const menu = invoke("menu", s.id, s.level, a).popupmenu.menu;
  expect(menu.some((m: any) => m.text?.startsWith("Back"))).toBe(false);
  expect(menu.some((m: any) => m.text === "All Alfred File Actions…")).toBe(true);
  expect(menu.some((m: any) => m.text === "Open Current Folder in Finder")).toBe(true);
  const ids: string[] = [];
  const visit = (v: any) => {
    if (!v || typeof v !== "object") return;
    if (v.id) ids.push(v.id);
    Object.values(v).forEach(visit);
  };
  visit(components(s));
  expect(ids.length).toBe(new Set(ids).size);
  expect(ids).toContain("back");
});

test("configured external starting paths work without Spotlight and mounted-drive discovery tolerates missing paths", async () => {
  const previous = { show_volumes: process.env.show_volumes, favorite_folders: process.env.favorite_folders };
  try {
    process.env.show_volumes = "0";
    process.env.favorite_folders = `${demo};${a};${demo}`;
    expect(await favorites()).toEqual([demo, a]);
    expect((await search("", "")).items.map((i) => i.uid)).toEqual([demo, a]);
    expect(await mountedDrives(join(root, "does-not-exist"))).toEqual([]);
    expect(await mountedDrives(demo)).toEqual([]);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
