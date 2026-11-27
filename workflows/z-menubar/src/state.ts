import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { App, MenuItem, Menus } from "./menus.ts";

export type State = {
  id: string;
  returnTo: string;
  query: string;
  app?: App;
  items: MenuItem[];
  /** Selected item uid (its index path). */
  selected: string;
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Menu Bar.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Menu Bar.");
  return s;
};
const lastFile = (bundle: string) => join(cacheDir(), `last-${bundle.replace(/[^\w.-]/g, "_")}.json`);
/** The app's menus from last time. */
export const lastMenus = (bundle: string): MenuItem[] => readJson<MenuItem[]>(lastFile(bundle), []);
export const storeMenus = (menus: Menus): void => {
  if (menus.app.bundle) writeJson(lastFile(menus.app.bundle), menus.items);
};
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    items: [],
    selected: "",
    request: randomUUID(),
    status: "Reading menus…",
    at: Date.now(),
  };
  save(s);
  return s;
};
