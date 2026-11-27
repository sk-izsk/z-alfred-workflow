import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Snapshot } from "./displays.ts";
import { cacheDir, readJson, writeJson } from "./env.ts";

export type State = {
  id: string;
  returnTo: string;
  query: string;
  /** "displays" (first level) or "modes" of one display. */
  screen: "displays" | "modes";
  /** The display whose modes are shown. */
  display: number;
  /** Selected row uid: `d<display id>` or `m<mode id>`. */
  selected: string;
  /** The display list's query and selection, restored by Back. */
  parent?: { query: string; selected: string };
  snapshot: Snapshot;
  /** The mode to go back to with ⌘Z. */
  undo?: { display: number; mode: number };
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Displays.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Displays.");
  return s;
};
const EMPTY: Snapshot = { dark: false, displays: [] };
/** The last list, so the window shows it at once while a fresh one loads. */
export const lastSnapshot = (): Snapshot => readJson<Snapshot>(join(cacheDir(), "displays.json"), EMPTY);
export const storeSnapshot = (s: Snapshot): void => writeJson(join(cacheDir(), "displays.json"), s);
export const create = (query: string, returnTo: string): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    screen: "displays",
    display: 0,
    selected: "",
    snapshot: lastSnapshot(),
    request: randomUUID(),
    status: "Loading displays…",
    at: Date.now(),
  };
  save(s);
  return s;
};
