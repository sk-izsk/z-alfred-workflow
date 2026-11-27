// Menu items of the app in front (bin/menus.js, Accessibility API), how to show and find them.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
/** bin/menus.js sits next to the bundled bin/menubar.mjs. */
const HELPER = fileURLToPath(new URL("./menus.js", import.meta.url));

export type App = { pid: number; name: string; bundle: string; path: string };
export type MenuItem = {
  titles: string[];
  indexes: number[];
  enabled: boolean;
  key: string;
  glyph: number | null;
  mods: number;
};
export type Menus = { app: App; items: MenuItem[] };

const helper = async (args: string[]): Promise<any> => {
  const { stdout } = await execFileP("/usr/bin/osascript", ["-l", "JavaScript", HELPER, ...args], {
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 32e6,
  });
  const value = JSON.parse(stdout);
  if (value?.error) throw new Error(value.error);
  return value;
};
/** Every menu item of the app in front (or of `pid`), ~0.2–0.5 s. */
export const readMenus = async (pid = 0, withApple = false): Promise<Menus> => {
  const menus = (await helper(["list", String(pid || ""), withApple ? "apple" : ""])) as Menus;
  return { app: menus.app, items: dedupe(menus.items) };
};
export const pressItem = (pid: number, item: Pick<MenuItem, "indexes" | "titles">): Promise<unknown> =>
  helper(["press", String(pid), JSON.stringify(item.indexes), JSON.stringify(item.titles)]);

/** Hidden alternates (shown while holding ⌥) repeat a path; keep the first, as the menu shows it. */
export const dedupe = (items: MenuItem[]): MenuItem[] => {
  const seen = new Set<string>();
  return items.filter((x) => {
    const key = x.titles.join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// AXMenuItemCmdGlyph values for keys that aren't characters (Carbon kMenu…Glyph).
const GLYPHS: Record<number, string> = {
  0x02: "⇥",
  0x03: "⇤",
  0x04: "⌤",
  0x09: "Space",
  0x0a: "⌦",
  0x0b: "↩",
  0x10: "↓",
  0x17: "⌫",
  0x1b: "⎋",
  0x1c: "⌧",
  0x62: "⇞",
  0x63: "⇪",
  0x64: "←",
  0x65: "→",
  0x66: "↖",
  0x68: "↑",
  0x69: "↘",
  0x6a: "↓",
  0x6b: "⇟",
  0x6f: "F1",
  0x70: "F2",
  0x71: "F3",
  0x72: "F4",
  0x73: "F5",
  0x74: "F6",
  0x75: "F7",
  0x76: "F8",
  0x77: "F9",
  0x78: "F10",
  0x79: "F11",
  0x7a: "F12",
  0x87: "F13",
  0x88: "F14",
  0x89: "F15",
  0x8a: "Fn",
};
/**
 * The shortcut as the menu shows it: ⌃⌥⇧⌘ then the key. Modifier bits: 1 Shift, 2 Option,
 * 4 Control, 8 no Command.
 */
export const shortcut = (x: Pick<MenuItem, "key" | "glyph" | "mods">): string => {
  const glyph = x.glyph !== null ? GLYPHS[x.glyph] : undefined;
  const key = glyph ?? (x.key.trim() ? x.key.toUpperCase() : "");
  if (!key) return "";
  const m = x.mods;
  return `${m & 4 ? "⌃" : ""}${m & 2 ? "⌥" : ""}${m & 1 ? "⇧" : ""}${m & 8 ? "" : "⌘"}${key}`;
};
/** The menu it sits in: `File › Open Recent`. */
export const menuPath = (x: MenuItem): string => x.titles.slice(0, -1).join(" › ");
export const title = (x: MenuItem): string => x.titles.at(-1)!;

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
/**
 * How well an item matches (0 = not at all). Every query word must match the title or menu path,
 * by start of word, anywhere, or by initials (`nt` → New Tab). Title matches beat path matches.
 */
export const score = (x: MenuItem, query: string): number => {
  const q = words(query);
  if (!q.length) return 1;
  const t = title(x).toLowerCase(),
    titleWords = words(title(x)),
    path = menuPath(x).toLowerCase();
  const initials = titleWords.map((w) => w[0]).join("");
  let total = 0;
  for (const w of q) {
    if (t.startsWith(w)) total += 8;
    else if (titleWords.some((tw) => tw.startsWith(w))) total += 6;
    else if (t.includes(w)) total += 4;
    else if (w.length > 1 && initials.startsWith(w)) total += 5;
    else if (path.includes(w)) total += 2;
    else return 0;
  }
  return total;
};
/** Best matches first; ties keep menu order. Unavailable items only when asked for. */
export const search = (items: MenuItem[], query: string, showDisabled: boolean): MenuItem[] =>
  items
    .map((x, i) => ({ x, i, s: showDisabled || x.enabled ? score(x, query) : 0 }))
    .filter((r) => r.s > 0)
    .toSorted((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.x);
export const uid = (x: MenuItem): string => x.indexes.join(".");
