import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, dataDir, readJson, writeJson, str, bool } from "./env.ts";
import type { Settings, Month } from "./api.ts";
export type State = {
  id: string;
  settings: Settings;
  date: string;
  month?: Month;
  nextMonth?: Month;
  liveMonth?: Month;
  request?: string;
  ramadanRequest?: string;
  ramadanYear?: number;
  ramadanTable?: Month;
  ramadanToday?: string;
  at: number;
};
export const settings = (): Settings =>
  readJson(join(dataDir(), "settings.json"), {
    city: str("city"),
    country: str("country"),
    method: str("method", "2"),
    school: str("school", "0"),
    twelve: bool("twelve", true),
  });
export const saveSettings = (s: Settings): void => writeJson(join(dataDir(), "settings.json"), s);
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Adhan Time.");
  return join(cacheDir(), `session-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 24 * 3600000) throw new Error("Reopen Adhan Time.");
  return s;
};
export const create = (): State => {
  const s = { id: randomUUID(), settings: settings(), date: "", at: Date.now() };
  save(s);
  return s;
};
