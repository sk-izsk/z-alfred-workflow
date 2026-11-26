import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson, bool } from "./env.ts";
import type { Item } from "./files.ts";
export type Frame = {
  mode: "search" | "browse";
  path: string;
  scope: string;
  query: string;
  selected: string;
  hidden: boolean;
};
export type State = Frame & {
  id: string;
  returnTo: string;
  level: string;
  focusPending?: boolean;
  request: string;
  history: Frame[];
  items: Item[];
  limited: boolean;
  status: string;
  error: boolean;
  at: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Folder Navigator.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Folder Navigator.");
  return s;
};
export const frame = (s: State): Frame => ({
  mode: s.mode,
  path: s.path,
  scope: s.scope,
  query: s.query,
  selected: s.selected,
  hidden: s.hidden,
});
export const create = (query: string, returnTo = ""): State => {
  const s: State = {
    id: randomUUID(),
    returnTo,
    level: randomUUID(),
    focusPending: true,
    request: randomUUID(),
    mode: "search",
    path: "",
    scope: "",
    query,
    selected: "",
    hidden: bool("show_hidden", false),
    history: [],
    items: [],
    limited: false,
    status: "Loading folders…",
    error: false,
    at: Date.now(),
  };
  save(s);
  return s;
};
export const push = (s: State, target: Partial<Frame>): void => {
  if (s.history.length >= 256) throw new Error("Navigation history is full. Go Back before continuing.");
  s.history.push(frame(s));
  Object.assign(s, target);
  s.level = randomUUID();
  s.focusPending = true;
  s.request = randomUUID();
  s.items = [];
  s.error = false;
  s.status = "Loading…";
  save(s);
};
export const previous = (s: State): boolean => {
  const last = s.history.pop();
  if (!last) return false;
  Object.assign(s, last);
  s.level = randomUUID();
  s.focusPending = true;
  s.request = randomUUID();
  s.items = [];
  s.error = false;
  s.status = "Restoring folder…";
  save(s);
  return true;
};
