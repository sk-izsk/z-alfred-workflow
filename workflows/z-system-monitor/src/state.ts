import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Snapshot } from "./metrics.ts";
export type State = {
  id: string;
  query: string;
  selected: string;
  returnTo: string;
  at: number;
  sample?: Snapshot;
  paused: boolean;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen System Monitor.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen System Monitor.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const s = { id: randomUUID(), query, selected: "system", returnTo, at: Date.now(), paused: false };
  save(s);
  return s;
};
