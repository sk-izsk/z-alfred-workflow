import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Network } from "./wifi.ts";
export type State = {
  id: string;
  query: string;
  selected: string;
  filter: string;
  rows: Network[];
  device: string;
  power: boolean;
  note: string;
  returnTo: string;
  at: number;
  paused: boolean;
};
const file = (id: string): string => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Wi-Fi.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Wi-Fi.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    selected: "",
    filter: "All",
    rows: [],
    device: "",
    power: false,
    note: "",
    at: Date.now(),
    paused: false,
  };
  save(s);
  return s;
};
