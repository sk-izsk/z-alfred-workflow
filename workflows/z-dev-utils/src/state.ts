import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
export type State = { id: string; query: string; selected: string; returnTo: string; at: number };
const file = (id: string): string => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Dev Utils.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Dev Utils.");
  return s;
};
export const create = (returnTo: string): State => {
  const s: State = { id: randomUUID(), query: "", selected: "json", returnTo, at: Date.now() };
  save(s);
  return s;
};
