import data from "../assets/emoji.json" with { type: "json" };
import { join } from "node:path";
import { dataDir, readJson, writeJson, str } from "./env.ts";
export type Emoji = {
  id: string;
  emoji: string;
  version: number;
  name: string;
  group: string;
  subgroup: string;
  shortcode: string;
};
export const emojis: Emoji[] = data;
export const groups = [...new Set(emojis.map((e) => e.group))];
export const base = (text: string): string =>
  text.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "").replace(/\uFE0F/g, "");
export const variants = (entry: Emoji): Emoji[] => emojis.filter((e) => base(e.emoji) === base(entry.emoji));
export const find = (id: string): Emoji => {
  const value = emojis.find((e) => e.id === id);
  if (!value) throw new Error("Select an emoji.");
  return value;
};
export type Preferences = { favorites: string[]; recent: string[]; layout: "list" | "grid" };
export const preferences = (): Preferences => {
  const raw = readJson<Partial<Preferences>>(join(dataDir(), "preferences.json"), {}),
    valid = (values: unknown) =>
      Array.isArray(values)
        ? values.filter((v) => typeof v === "string" && emojis.some((e) => e.id === v))
        : [];
  return {
    favorites: valid(raw.favorites),
    recent: valid(raw.recent).slice(0, 80),
    layout: raw.layout === "grid" ? "grid" : "list",
  };
};
export const record = (id: string): void => {
  find(id);
  const p = preferences();
  p.recent = [id, ...p.recent.filter((e) => e !== id)].slice(0, 80);
  writeJson(join(dataDir(), "preferences.json"), p);
};
export const favorite = (id: string): void => {
  find(id);
  const p = preferences();
  p.favorites = p.favorites.includes(id) ? p.favorites.filter((e) => e !== id) : [id, ...p.favorites];
  writeJson(join(dataDir(), "preferences.json"), p);
};
export const search = (query: string, category: string, parent = ""): Emoji[] => {
  const p = preferences(),
    words = query.toLowerCase().replace(/_/g, " ").replace(/:/g, "").split(/\s+/).filter(Boolean),
    max = Number(str("max_version", "17")) || 17;
  let pool = parent
    ? variants(find(parent))
    : category === "Recent"
      ? p.recent.map(find)
      : category === "Favorites"
        ? p.favorites.map(find)
        : emojis.filter((e) => category === "All" || e.group === category);
  return pool
    .filter(
      (e) =>
        e.version <= max &&
        words.every((word) =>
          `${e.name} ${e.group} ${e.subgroup} ${e.emoji} ${e.shortcode}`.toLowerCase().includes(word),
        ),
    )
    .slice(0, 500);
};

export const setLayout = (layout: "list" | "grid"): void => {
  const p = preferences();
  p.layout = layout;
  writeJson(join(dataDir(), "preferences.json"), p);
};
