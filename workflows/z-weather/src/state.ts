import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { cacheDir, dataDir, readJson, writeJson, str } from "./env.ts";
import { cityQuery, type Report } from "./model.ts";
import { key } from "./api.ts";
export type City = { id: string; query: string };
export type State = {
  id: string;
  mode: "cities" | "details";
  fromList: boolean;
  query: string;
  selected: string;
  city: string;
  day: number;
  imperial: boolean;
  report?: Report;
  stale: boolean;
  detailOffset?: number;
  forecastOffset?: number;
  forecastMode?: "hourly" | "daily";
  forceAir?: boolean;
  request: string;
  at: number;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Weather; this session is invalid.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 24 * 3600000) throw new Error("Reopen Weather; this session expired.");
  return s;
};
export const create = (query: string): State => {
  const s: State = {
    id: randomUUID(),
    mode: "cities",
    fromList: true,
    query,
    selected: "",
    city: "",
    day: 0,
    imperial: str("units", "metric") === "imperial",
    stale: false,
    request: randomUUID(),
    at: Date.now(),
  };
  save(s);
  return s;
};
type Saved = { cities: string[]; hidden: string[] };
const path = () => join(dataDir(), "cities.json");
const user = (): Saved => readJson<Saved>(path(), { cities: [], hidden: [] });
export const cities = (): City[] => {
  const data = user();
  const all = [...str("cities").split(/[;\n]/), ...data.cities];
  const seen = new Set<string>();
  return all.flatMap((q) => {
    try {
      const query = cityQuery(q),
        id = key(query);
      if (seen.has(id) || data.hidden.includes(id)) return [];
      seen.add(id);
      return [{ id, query }];
    } catch {
      return [];
    }
  });
};
export const addCity = (query: string): void => {
  const q = cityQuery(query),
    data = user(),
    id = key(q);
  data.cities = [...new Set([...data.cities, q])];
  data.hidden = data.hidden.filter((v) => v !== id);
  writeJson(path(), data);
};
export const removeCity = (id: string): void => {
  const data = user();
  data.cities = data.cities.filter((q) => key(q) !== id);
  data.hidden = [...new Set([...data.hidden, id])];
  writeJson(path(), data);
};
