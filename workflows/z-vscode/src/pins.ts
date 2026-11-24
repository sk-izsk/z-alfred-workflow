import { join } from "node:path";
import { editor } from "./editors.ts";
import { dataDir, readJson, writeJson } from "./env.ts";

/** Pinned project URIs, in order, per editor (each editor has its own recents). */
const file = () => join(dataDir(), `pins-${editor().id.replace(/\W+/g, "-")}.json`);

export const pins = (): string[] => readJson<string[]>(file(), []);

const save = (list: string[]) => writeJson(file(), list);

export const togglePin = (uri: string): boolean => {
  const list = pins();
  const pinned = list.includes(uri);
  save(pinned ? list.filter((u) => u !== uri) : [...list, uri]);
  return !pinned;
};

export const movePin = (uri: string, by: -1 | 1): void => {
  const list = pins();
  const from = list.indexOf(uri);
  const to = from + by;
  if (from < 0 || to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to]!, list[from]!];
  save(list);
};

export const unpinAll = (): void => save([]);
