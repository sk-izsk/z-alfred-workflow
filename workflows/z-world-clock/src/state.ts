import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { cacheDir, dataDir, readJson, writeJson, str, bool } from "./env.ts";
import { canonical, zones, type Entry } from "./model.ts";
export type Preferences = {
  stars: Entry[];
  layout: "list" | "grid";
  filter: string;
  hour24: boolean;
  dateFormat: string;
  columns: number;
};
export const preferences = (): Preferences => {
  const defaults: Preferences = {
    stars: str("starred_zones", "UTC; Europe/London; Asia/Dhaka; Asia/Tokyo; America/New_York")
      .split(";")
      .flatMap((raw) => {
        try {
          const zone = canonical(raw.trim());
          return [{ id: zone, zone, alias: "", memo: "", emoji: "", avatar: "" }];
        } catch {
          return [];
        }
      })
      .filter((e, index, all) => all.findIndex((other) => other.id === e.id) === index),
    layout: str("layout", "list") === "grid" ? "grid" : "list",
    filter: "all",
    hour24: bool("hour24", true),
    dateFormat: str("date_format", "iso"),
    columns: Math.max(3, Math.min(6, Number(str("columns", "5")) || 5)),
  };
  return { ...defaults, ...readJson<Partial<Preferences>>(join(dataDir(), "clocks.json"), {}) };
};
export const savePreferences = (p: Preferences): void => writeJson(join(dataDir(), "clocks.json"), p);
export type State = {
  id: string;
  query: string;
  selected: string;
  prefs: Preferences;
  minute: number;
  at: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen World Clock.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen World Clock.");
  return s;
};
export const create = (query: string): State => {
  const s = { id: randomUUID(), query, selected: "", prefs: preferences(), minute: 0, at: Date.now() };
  save(s);
  return s;
};
export const entries = (s: State): Entry[] => {
  const stars = s.prefs.stars,
    seen = new Set(stars.map((e) => canonical(e.zone)));
  const other = zones()
    .filter((z) => !seen.has(canonical(z.zone)))
    .map((z) => ({ id: `zone:${z.zone}`, zone: z.zone, alias: "", memo: "", emoji: "", avatar: "" }));
  return s.prefs.filter === "starred"
    ? stars
    : s.prefs.filter === "other"
      ? other
      : [...stars, ...other].filter(
          (e) => s.prefs.filter === "all" || e.zone.startsWith(s.prefs.filter + "/"),
        );
};
export const entry = (s: State, id: string): Entry => {
  const found = entries({ ...s, prefs: { ...s.prefs, filter: "all" } }).find((e) => e.id === id);
  if (!found) throw new Error("Select a timezone first.");
  return found;
};
export const avatarPath = (input: string): string => {
  const path = input.trim().replace(/^~(?=\/)/, homedir());
  if (!path) return "";
  if (!/\.(png|jpe?g|gif|heic|tiff?)$/i.test(extname(path)) || !existsSync(path) || !statSync(path).isFile())
    throw new Error("Choose an existing PNG, JPEG, GIF, HEIC or TIFF image.");
  return path;
};
export const editStar = (s: State, id: string, patch: Partial<Entry>): void => {
  const index = s.prefs.stars.findIndex((e) => e.id === id);
  if (index < 0) throw new Error("Star this timezone before editing it.");
  const e = s.prefs.stars[index]!;
  s.prefs.stars[index] = { ...e, ...patch, id: e.id, zone: e.zone };
  savePreferences(s.prefs);
  save(s);
};
export const duplicate = (s: State, id: string): void => {
  const i = s.prefs.stars.findIndex((e) => e.id === id);
  if (i < 0) throw new Error("Star this timezone first.");
  s.prefs.stars.splice(i + 1, 0, { ...s.prefs.stars[i]!, id: randomUUID() });
  savePreferences(s.prefs);
  save(s);
};
