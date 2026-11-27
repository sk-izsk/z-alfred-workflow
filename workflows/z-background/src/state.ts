import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Filter, Item } from "./items.ts";

export type State = {
  id: string;
  returnTo: string;
  query: string;
  filter: Filter;
  /** Selected item id. */
  selected: string;
  items: Item[];
  /** System Events access was denied, so login items are missing. */
  loginDenied: boolean;
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Background Items.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Background Items.");
  return s;
};
/** The last list, so the window shows it at once while a fresh one loads. */
export const lastItems = (): Item[] => readJson<Item[]>(join(cacheDir(), "items.json"), []);
export const storeItems = (list: Item[]): void => writeJson(join(cacheDir(), "items.json"), list);
export const create = (query: string, returnTo: string, filter: Filter): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    filter,
    selected: "",
    items: lastItems(),
    loginDenied: false,
    request: randomUUID(),
    status: "Loading background items…",
    at: Date.now(),
  };
  save(s);
  return s;
};
