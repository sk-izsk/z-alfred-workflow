import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { WindowItem, Scope } from "../../../shared/window-access.ts";
export type State = {
  id: string;
  returnTo: string;
  query: string;
  selected: string;
  scope: Scope;
  items: WindowItem[];
  request: string;
  status: string;
  at: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Window Navigator.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Window Navigator.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    selected: "",
    scope: "all",
    items: [],
    request: randomUUID(),
    status: "Loading windows…",
    at: Date.now(),
  };
  save(s);
  return s;
};
