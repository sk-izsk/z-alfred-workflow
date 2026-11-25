import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
export type AirQuality = {
  fetched: number;
  stale: boolean;
  timezone: string;
  current: {
    time: string;
    us: number | null;
    european: number | null;
    pm25: number | null;
    pm10: number | null;
  };
  hours: { time: string; us: number | null }[];
};
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
export const parseAirQuality = (raw: unknown, now = Date.now()): AirQuality => {
  if (!raw || typeof raw !== "object") throw new Error("Unsupported air-quality response.");
  const data = raw as Record<string, any>,
    current = data.current;
  if (!current || typeof current.time !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current.time))
    throw new Error("Air-quality timestamp is unavailable.");
  const hours = Array.isArray(data.hourly?.time)
    ? data.hourly.time.flatMap((time: unknown, i: number) =>
        typeof time === "string" ? [{ time, us: number(data.hourly.us_aqi?.[i]) }] : [],
      )
    : [];
  return {
    fetched: now,
    stale: false,
    timezone: typeof data.timezone === "string" ? data.timezone : "Local time",
    current: {
      time: current.time,
      us: number(current.us_aqi),
      european: number(current.european_aqi),
      pm25: number(current.pm2_5),
      pm10: number(current.pm10),
    },
    hours,
  };
};
export const airCategory = (index: number | null): { label: string; short: string; colour: string } => {
  if (index === null || !Number.isFinite(index) || index < 0)
    return { label: "Unavailable", short: "Unavailable", colour: "secondaryLabelColor" };
  if (index <= 50) return { label: "Good", short: "Good", colour: "systemGreenColor" };
  if (index <= 100) return { label: "Moderate", short: "Moderate", colour: "systemYellowColor" };
  if (index <= 150)
    return { label: "Unhealthy for sensitive groups", short: "Sensitive", colour: "systemOrangeColor" };
  if (index <= 200) return { label: "Unhealthy", short: "Unhealthy", colour: "systemRedColor" };
  if (index <= 300) return { label: "Very unhealthy", short: "Very unhealthy", colour: "systemPurpleColor" };
  return { label: "Hazardous", short: "Hazardous", colour: "systemRedColor" };
};
export const airForDate = (
  air: AirQuality,
  date: string,
  current: boolean,
): { index: number | null; time: string } => {
  if (current) return { index: air.current.us, time: air.current.time };
  const hour = air.hours.find((h) => h.time === `${date}T12:00`);
  return { index: hour?.us ?? null, time: hour?.time || `${date}T12:00` };
};
export const loadAirQuality = async (
  latitude: number,
  longitude: number,
  fresh = false,
): Promise<AirQuality | null> => {
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    return null;
  const name = createHash("sha256").update(`${latitude},${longitude}`).digest("hex").slice(0, 24),
    path = join(cacheDir(), `air-${name}.json`),
    old = readJson<AirQuality | null>(path, null);
  if (old && !fresh && Date.now() - old.fetched < 15 * 60000) return old;
  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "us_aqi,european_aqi,pm2_5,pm10",
      hourly: "us_aqi",
      timezone: "auto",
      forecast_days: "3",
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Air-quality service unavailable.");
    const text = await response.text();
    if (text.length > 1e6) throw new Error("Air-quality response too large.");
    const air = parseAirQuality(JSON.parse(text));
    writeJson(path, air);
    return air;
  } catch {
    return old ? { ...old, stale: true } : null;
  }
};
