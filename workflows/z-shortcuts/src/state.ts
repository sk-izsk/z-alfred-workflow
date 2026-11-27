import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Shortcut } from "./shortcuts.ts";
/** Input the window was opened with (Universal Action text/URL, or File Action paths). */
export type Input = { text?: string; paths?: string[] };
export type State = {
  id: string;
  returnTo: string;
  query: string;
  selected: string;
  folder: string;
  items: Shortcut[];
  input: Input;
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Shortcuts.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Shortcuts.");
  return s;
};
/** The last list, so the window shows it at once while a fresh one loads. */
export const lastList = (): Shortcut[] => readJson<Shortcut[]>(join(cacheDir(), "shortcuts.json"), []);
export const storeList = (items: Shortcut[]): void => writeJson(join(cacheDir(), "shortcuts.json"), items);
export const create = (query: string, returnTo: string, input: Input): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    selected: "",
    folder: "all",
    items: lastList(),
    input,
    request: randomUUID(),
    status: "Loading shortcuts…",
    at: Date.now(),
  };
  save(s);
  return s;
};
