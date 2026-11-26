import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Display } from "./lunar.ts";
export type State = {
  id: string;
  returnTo: string;
  query: string;
  selected: string;
  displays: Display[];
  adaptive: string;
  presets: string[];
  at: number;
  status: string;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Lunar Controls.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Lunar Controls.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const s = {
    id: randomUUID(),
    query,
    returnTo,
    selected: "",
    displays: [],
    adaptive: "off",
    presets: [],
    at: Date.now(),
    status: "Loading Lunar…",
  };
  save(s);
  return s;
};
