import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
export type State = {
  id: string;
  query: string;
  category: string;
  selected: string;
  parent: string;
  returnTo: string;
  at: number;
  history: { query: string; category: string; selected: string; parent: string }[];
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Emoji Picker.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Emoji Picker.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const s = {
    id: randomUUID(),
    query,
    returnTo,
    category: "All",
    selected: "",
    parent: "",
    at: Date.now(),
    history: [],
  };
  save(s);
  return s;
};
