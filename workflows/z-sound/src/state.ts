import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Kind, Snapshot } from "./devices.ts";
import { cacheDir, readJson, writeJson } from "./env.ts";

export type State = {
  id: string;
  returnTo: string;
  query: string;
  kind: Kind;
  /** Selected device UID. */
  selected: string;
  snapshot: Snapshot;
  request: string;
  status: string;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Sound.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Sound.");
  return s;
};
const EMPTY: Snapshot = { output: null, input: null, alert: null, devices: [] };
/** The last device list, so the window shows it at once while a fresh one loads. */
export const lastSnapshot = (): Snapshot => readJson<Snapshot>(join(cacheDir(), "devices.json"), EMPTY);
export const storeSnapshot = (s: Snapshot): void => writeJson(join(cacheDir(), "devices.json"), s);
export const create = (query: string, returnTo: string, kind: Kind): State => {
  const s: State = {
    id: randomUUID(),
    query,
    returnTo,
    kind,
    selected: "",
    snapshot: lastSnapshot(),
    request: randomUUID(),
    status: "Loading devices…",
    at: Date.now(),
  };
  save(s);
  return s;
};
