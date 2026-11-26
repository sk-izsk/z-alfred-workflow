import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Entry, Index } from "./tags.ts";
export type State = {
  id: string;
  level: string;
  query: string;
  selected: string;
  mode: "list" | "edit";
  path: string;
  returnTo: string;
  parent?: { query: string; selected: string };
  index: Index;
  editing?: Entry;
  request: string;
  at: number;
  pending?: Entry[];
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Tag Manager.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (state: State): void => writeJson(file(state.id), state);
export const read = (id: string): State => {
  const state = readJson<State | null>(file(id), null);
  if (!state || Date.now() - state.at > 86400000) throw new Error("Reopen Tag Manager.");
  return state;
};
export const create = (query: string, returnTo = ""): State => {
  const state: State = {
    id: randomUUID(),
    level: randomUUID(),
    request: randomUUID(),
    query,
    returnTo,
    selected: "",
    mode: "list",
    path: "",
    index: { entries: [], fetched: 0, limited: false, unavailable: 0 },
    at: Date.now(),
  };
  save(state);
  return state;
};
