import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { type ProcessInfo, type Metrics } from "./model.ts";
export type State = {
  id: string;
  rows: ProcessInfo[];
  metrics: Metrics;
  query: string;
  sort: string;
  selected: string;
  at: number;
  request: string;
};
const file = (id: string, prefix = "window") => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Kill Process; this window session is invalid.");
  return join(cacheDir(), `${prefix}-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 24 * 3600000)
    throw new Error("Reopen Kill Process; this window session expired.");
  return s;
};
export const create = (query: string, sort: string): State => {
  const s: State = {
    id: randomUUID(),
    rows: [],
    metrics: { cpu: null, memory: null, used: 0, total: 0 },
    query,
    sort,
    selected: "",
    at: Date.now(),
    request: randomUUID(),
  };
  save(s);
  return s;
};
export const selectionFile = (id: string): string => file(id, "selection");
export const selected = (s: State): string => readJson<string>(selectionFile(s.id), s.selected);
export const select = (s: State, id: string): void => {
  if (s.rows.some((p) => p.id === id)) writeJson(selectionFile(s.id), id);
};
export const planFile = (id: string): string => file(id, "plan");

export const windowFile = (id: string): string => file(id);
