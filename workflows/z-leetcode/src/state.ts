import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Problem, ProblemRow, Profile, RandomFilters } from "./api.ts";
import { cacheDir, dataDir, readJson, writeJson } from "./env.ts";

export type Screen =
  | { kind: "search" }
  | { kind: "preview"; slug: string; date?: string; random?: boolean }
  | { kind: "profile"; username: string };
export type State = {
  id: string;
  returnTo: string;
  stack: Screen[];
  query: string;
  category: string;
  rows: ProblemRow[];
  page: number;
  hasMore: boolean;
  selected: string;
  status: string;
  request: string;
  problem?: Problem;
  profile?: Profile;
  filters: RandomFilters;
  at: number;
  selectedAt?: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen LeetCode.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen LeetCode.");
  return s;
};
export const top = (s: State): Screen => s.stack.at(-1) ?? { kind: "search" };

/** Remembered between windows: the search category and the random-problem filters. */
type Prefs = { category: string; filters: RandomFilters; username: string };
const prefsFile = () => join(dataDir(), "preferences.json");
export const prefs = (): Prefs =>
  readJson<Prefs>(prefsFile(), {
    category: "",
    filters: { category: "", difficulty: "", topic: "", excludePremium: true },
    username: "",
  });
export const savePrefs = (p: Partial<Prefs>): void => writeJson(prefsFile(), { ...prefs(), ...p });

export const create = (returnTo: string, first: Screen, query = ""): State => {
  const p = prefs();
  const s: State = {
    id: randomUUID(),
    returnTo,
    stack: [first],
    query,
    category: p.category,
    rows: [],
    page: 0,
    hasMore: false,
    selected: "",
    status: "Loading…",
    request: randomUUID(),
    filters: p.filters,
    at: Date.now(),
  };
  save(s);
  return s;
};
