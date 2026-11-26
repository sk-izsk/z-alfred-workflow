import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Mode, Item } from "./mole.ts";
export type Frame = {
  mode: Mode;
  query: string;
  selected: string;
  path: string;
  items: Item[];
  status: string;
  scroll?: number;
  ready?: boolean;
};
export type State = Frame & { id: string; returnTo: string; at: number; request: string; history: Frame[] };
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Mole.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Mole.");
  return s;
};
export const frame = (s: State): Frame => ({
  mode: s.mode,
  query: s.query,
  selected: s.selected,
  path: s.path,
  items: s.items,
  status: s.status,
  scroll: s.scroll || 0,
  ready: s.ready,
});
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    selected: "status",
    returnTo,
    at: Date.now(),
    mode: "menu",
    path: "",
    items: [],
    status: "Choose a command",
    request: randomUUID(),
    history: [],
  };
  save(s);
  return s;
};
