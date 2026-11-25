import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, dataDir, readJson, writeJson, str } from "./env.ts";
import type { Rates } from "./api.ts";
export type State = {
  id: string;
  query: string;
  base: string;
  selected: string;
  date: string;
  amount: number;
  filter: string;
  rates?: Rates;
  request: string;
  at: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Currency Exchange.");
  return join(cacheDir(), `window-${id}.json`);
};
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Currency Exchange.");
  return s;
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const create = (query: string): State => {
  const s = {
    id: randomUUID(),
    query,
    base: str("base_currency", "USD").toUpperCase(),
    selected: "",
    date: "",
    amount: 1,
    filter: "",
    request: randomUUID(),
    at: Date.now(),
  };
  save(s);
  return s;
};
export const pinned = (): string[] =>
  readJson<string[]>(join(dataDir(), "pinned.json"), ["USD", "CAD", "EUR", "BDT"]);
export const pin = (code: string): void => {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Invalid currency.");
  const all = pinned();
  writeJson(
    join(dataDir(), "pinned.json"),
    all.includes(code) ? all.filter((c) => c !== code) : [...all, code],
  );
};
