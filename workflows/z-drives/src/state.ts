import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Drive } from "./drives.ts";
import { cacheDir, readJson, writeJson } from "./env.ts";

export type State = {
  id: string;
  returnTo: string;
  query: string;
  /** Selected drive's mount point. */
  selected: string;
  drives: Drive[];
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Drives.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Drives.");
  return s;
};
/** The last list, so the window shows it at once while a fresh one loads. */
export const lastDrives = (): Drive[] => readJson<Drive[]>(join(cacheDir(), "drives.json"), []);
export const storeDrives = (list: Drive[]): void => writeJson(join(cacheDir(), "drives.json"), list);
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    selected: "",
    drives: lastDrives(),
    request: randomUUID(),
    status: "Loading drives…",
    at: Date.now(),
  };
  save(s);
  return s;
};
