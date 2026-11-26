import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson, str } from "./env.ts";
import { providers, type Provider, type Gif } from "./gifs.ts";
export type State = {
  id: string;
  query: string;
  source: string;
  selected: string;
  rows: Gif[];
  page: number;
  at: number;
  fetched: number;
  more: boolean;
  request: string;
  returnTo: string;
};
const file = (id: string): string => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen GIF Search.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen GIF Search.");
  return s;
};
export const create = (query: string, returnTo: string): State => {
  const provider = str("default_provider", "giphy") as Provider;
  const s: State = {
    id: randomUUID(),
    query: query.slice(0, 50),
    returnTo,
    source: providers.includes(provider) ? provider : "giphy",
    selected: "",
    rows: [],
    page: 0,
    at: Date.now(),
    fetched: 0,
    more: false,
    request: "",
  };
  save(s);
  return s;
};
