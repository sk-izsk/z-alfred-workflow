import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Entry } from "./catalog.ts";
export type State = {
  id: string;
  query: string;
  selected: string;
  filter: string;
  entries: Entry[];
  request: string;
  at: number;
  status: string;
  queue: string[];
  installing?: { bundle: string; version: string };
  detail?: string;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Workflow Manager.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Workflow Manager.");
  return s;
};
export const create = (query: string): State => {
  const s = {
    id: randomUUID(),
    query,
    selected: "",
    filter: "installed",
    entries: [],
    request: randomUUID(),
    at: Date.now(),
    status: "Reading installed workflows…",
    queue: [],
  };
  save(s);
  return s;
};
