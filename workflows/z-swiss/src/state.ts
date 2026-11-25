import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Installed } from "./tools.ts";
export type State = { id: string; query: string; selected: string; installed: Installed[]; at: number };
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid Swiss session.");
  return join(cacheDir(), `session-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Swiss session expired. Type swiss to reopen it.");
  return s;
};
export const create = (query: string, installed: Installed[]): State => {
  const s = { id: randomUUID(), query, selected: "speedtest", installed, at: Date.now() };
  save(s);
  return s;
};
