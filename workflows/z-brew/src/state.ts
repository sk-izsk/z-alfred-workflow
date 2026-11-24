import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { type Package } from "./model.ts";
export type Mode =
  | "installed"
  | "search"
  | "upgrades"
  | "adopt"
  | "services"
  | "taps"
  | "doctor"
  | "vulns"
  | "maintenance";
export type ViewState = {
  mode: Mode;
  packages: Package[];
  selected: string[];
  report?: string;
  items?: Item[];
  at: number;
};
export type Item = {
  id: string;
  title: string;
  description: string;
  value: string;
  colour: string;
  icon: string;
  path?: string;
  packageId?: string;
};
export const session = (): string => {
  const id = process.env.brew_window || "";
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reload this Brew view (⌘R).");
  return id;
};
export const createState = (state: Omit<ViewState, "at">): string => {
  const id = randomUUID();
  writeJson(join(cacheDir(), `view-${id}.json`), { ...state, at: Date.now() });
  return id;
};
export const getState = (id = session()): ViewState => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid Brew session.");
  const state = readJson<ViewState | null>(join(cacheDir(), `view-${id}.json`), null);
  if (!state || Date.now() - state.at > 3600000) throw new Error("The Brew view expired. Refresh with ⌘R.");
  return state;
};
export const setState = (state: ViewState): void =>
  writeJson(join(cacheDir(), `view-${session()}.json`), state);
export const select = (id: string): void => writeJson(join(cacheDir(), `selected-${session()}.json`), id);
export const selected = (): string => readJson<string>(join(cacheDir(), `selected-${session()}.json`), "");
