import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  alfredItem,
  dedupe,
  matchText,
  menuPath,
  score,
  search,
  shortcut,
  title,
  type MenuItem,
} from "../src/menus.ts";

const item = (titles: string[], extra: Partial<MenuItem> = {}): MenuItem => ({
  titles,
  indexes: titles.map((_, i) => i),
  enabled: true,
  key: "",
  glyph: null,
  mods: 0,
  ...extra,
});

test("shortcuts read like the menu: ⌃⌥⇧⌘ then the key or glyph", () => {
  expect(shortcut({ key: "t", glyph: null, mods: 0 })).toBe("⌘T");
  expect(shortcut({ key: "N", glyph: null, mods: 1 })).toBe("⇧⌘N");
  expect(shortcut({ key: "O", glyph: null, mods: 4 })).toBe("⌃⌘O");
  expect(shortcut({ key: "\b", glyph: 0x17, mods: 3 })).toBe("⌥⇧⌘⌫");
  expect(shortcut({ key: "", glyph: 0x7a, mods: 8 })).toBe("F12");
  expect(shortcut({ key: "", glyph: null, mods: 0 })).toBe("");
});

test("matches words, initials and menu names; titles rank above paths", () => {
  const newTab = item(["File", "New Tab"]),
    close = item(["File", "Close Window"]),
    tabs = item(["Window", "Show All Tabs"]),
    zoom = item(["View", "Zoom In"]);
  expect(score(newTab, "nt")).toBeGreaterThan(0);
  expect(score(close, "cw")).toBeGreaterThan(0);
  expect(score(zoom, "file")).toBe(0);
  expect(search([tabs, newTab, close, zoom], "tab", false).map(title)).toEqual(["Show All Tabs", "New Tab"]);
  expect(search([tabs, newTab, close, zoom], "new", false).map(title)).toEqual(["New Tab"]);
  expect(search([newTab, close], "file", false).map(title)).toEqual(["New Tab", "Close Window"]);
  expect(menuPath(item(["File", "Open Recent", "Notes.txt"]))).toBe("File › Open Recent");
});

test("unavailable items hide unless asked for; alternates appear once", () => {
  const off = item(["Edit", "Undo"], { enabled: false });
  expect(search([off], "", false)).toEqual([]);
  expect(search([off], "", true)).toHaveLength(1);
  const first = item(["File", "Empty Trash"], { mods: 1 }),
    alternate = item(["File", "Empty Trash"], { mods: 3, indexes: [0, 9] });
  expect(dedupe([first, alternate])).toEqual([first]);
});

test("the Accessibility helper never redeclares JXA globals and converts NSArray counts", () => {
  const source = readFileSync(new URL("../workflow/bin/menus.js", import.meta.url), "utf8");
  for (const name of [
    "\\$",
    "Path",
    "delay",
    "Application",
    "Library",
    "ObjC",
    "Ref",
    "Progress",
    "Automation",
  ])
    expect(source).not.toMatch(new RegExp(`(?:const|let|var|function)\\s+${name}\\b`));
  expect(source).toContain("Number(array.count)");
});

test("Alfred results: initials and menus are matchable; ↩ carries what to press; unavailable can't be actioned", () => {
  const app = { pid: 42, name: "Demo", bundle: "com.example.demo", path: "/Applications/Demo.app" };
  const x = item(["File", "Open Recent", "Clear Menu"], { key: "N", mods: 1 });
  expect(matchText(x)).toBe("Clear Menu cm File Open Recent");
  expect(matchText(item(["View", "Zoom"]))).toBe("Zoom View");
  const result = alfredItem(app, x);
  expect(result.subtitle).toBe("File › Open Recent   ·   ⇧⌘N");
  expect(JSON.parse(result.arg)).toEqual({
    pid: 42,
    indexes: [0, 1, 2],
    titles: ["File", "Open Recent", "Clear Menu"],
  });
  expect(result.icon).toEqual({ type: "fileicon", path: "/Applications/Demo.app" });
  expect(alfredItem(app, item(["Edit", "Undo"], { enabled: false })).valid).toBe(false);
});
