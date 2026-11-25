import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson, cacheMinutes } from "./env.ts";
import { parseMonth, type Day } from "./model.ts";
import { methods } from "./methods.ts";
export type Settings = { city: string; country: string; method: string; school: string; twelve: boolean };
export const validate = (s: Settings): Settings => {
  for (const name of ["city", "country"] as const)
    if (!s[name] || s[name].length > 120 || Array.from(s[name]).some((c) => c.charCodeAt(0) < 32))
      throw new Error("Enter a city and country in Settings.");
  if (!methods.some(([, id]) => id === s.method) || !["0", "1"].includes(s.school))
    throw new Error("Choose a supported calculation method and Asr school.");
  return s;
};
export type Month = { days: Day[]; fetched: number; stale: boolean };
export const calendar = async (settings: Settings, date: string, fresh = false): Promise<Month> => {
  validate(settings);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid calendar date.");
  const [year, month] = date.split("-"),
    key = createHash("sha256")
      .update(
        JSON.stringify([settings.city, settings.country, settings.method, settings.school, year, month]),
      )
      .digest("hex")
      .slice(0, 24),
    path = join(cacheDir(), `calendar-${key}.json`),
    old = readJson<Month | null>(path, null);
  if (old && !fresh && Date.now() - old.fetched < cacheMinutes("cache_minutes", 1440) * 60000) return old;
  try {
    const url = new URL(`https://api.aladhan.com/v1/calendarByCity/${year}/${Number(month)}`);
    url.search = new URLSearchParams({
      city: settings.city,
      country: settings.country,
      method: settings.method,
      school: settings.school,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Prayer service HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length > 2e6) throw new Error("Prayer calendar too large.");
    const result = { days: parseMonth(JSON.parse(text)), fetched: Date.now(), stale: false };
    if (result.days.some((d) => !d.date.startsWith(`${year}-${month}`)))
      throw new Error("Prayer service returned another month.");
    writeJson(path, result);
    return result;
  } catch (error) {
    if (old) return { ...old, stale: true };
    throw error;
  }
};
