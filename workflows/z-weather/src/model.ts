import { airCategory, airForDate, type AirQuality } from "./air-quality.ts";
export type Json = Record<string, any>;
export type Report = {
  air?: AirQuality | null;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  current: Json;
  days: Json[];
  fetched: number;
  query: string;
};
const string = (v: unknown) => (typeof v === "string" ? v : "");
export const first = (v: unknown): string => (Array.isArray(v) ? string(v[0]?.value) : "");
export const cityQuery = (query: string): string => {
  const value = query.trim();
  if (value.length < 2 || value.length > 160 || [...value].some((c) => c.charCodeAt(0) < 32))
    throw new Error("Enter a city, optionally followed by its country (2–160 characters).");
  return value;
};
export const parseReport = (raw: unknown, query: string, now = Date.now()): Report => {
  if (!raw || typeof raw !== "object") throw new Error("Weather service returned an unsupported response.");
  const data = raw as Json,
    place = data.nearest_area?.[0];
  if (
    !place ||
    !first(place.areaName) ||
    !data.current_condition?.[0] ||
    !Array.isArray(data.weather) ||
    !data.weather.length
  )
    throw new Error("No weather report was found for that location.");
  const latitude = Number(place.latitude),
    longitude = Number(place.longitude);
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw new Error("Weather service returned invalid coordinates.");
  const days = data.weather.filter(
    (day: Json) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Array.isArray(day.hourly),
  );
  if (!days.length) throw new Error("No dated forecast was found.");
  return {
    city: first(place.areaName),
    region: first(place.region),
    country: first(place.country),
    latitude,
    longitude,
    current: data.current_condition[0],
    days,
    fetched: now,
    query,
  };
};
export const value = (n: unknown, unit = "", digits = 0): string => {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(digits)}${unit ? " " + unit : ""}`;
};
export const temperature = (data: Json, imperial: boolean, current = false): string =>
  value(
    data[current ? (imperial ? "temp_F" : "temp_C") : imperial ? "tempF" : "tempC"],
    imperial ? "°F" : "°C",
  );
export const condition = (code: unknown): { icon: string; colour: string } => {
  const n = Number(code);
  if (n === 113) return { icon: "sun.max.fill", colour: "systemOrangeColor" };
  if (n === 116) return { icon: "cloud.sun.fill", colour: "systemOrangeColor" };
  if ([200, 386, 389, 392, 395].includes(n))
    return { icon: "cloud.bolt.rain.fill", colour: "systemPurpleColor" };
  if (
    [
      179, 182, 185, 227, 230, 281, 284, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368,
      371, 374, 377,
    ].includes(n)
  )
    return { icon: "cloud.snow.fill", colour: "systemCyanColor" };
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359].includes(n))
    return { icon: "cloud.rain.fill", colour: "systemBlueColor" };
  if ([143, 248, 260].includes(n)) return { icon: "cloud.fog.fill", colour: "secondaryLabelColor" };
  if ([119, 122].includes(n)) return { icon: "cloud.fill", colour: "systemGrayColor" };
  return { icon: "questionmark.circle", colour: "secondaryLabelColor" };
};
export const hourLabel = (time: unknown): string => {
  const n = Number(time);
  return Number.isInteger(n) && n >= 0 && n <= 2300 && n % 100 === 0
    ? `${String(n / 100).padStart(2, "0")}:00`
    : "—";
};
export const summary = (r: Report, dayIndex: number, imperial: boolean) => {
  const day = r.days[dayIndex] || r.days[0]!;
  const current = dayIndex === 0;
  const data = current
    ? r.current
    : day.hourly.find((h: Json) => Number(h.time) === 1200) || day.hourly[0] || {};
  return {
    day,
    data,
    current,
    title: `${r.city}${r.region ? ", " + r.region : ""}, ${r.country}`,
    description: first(data.weatherDesc) || "Conditions unavailable",
    temperature: temperature(data, imperial, current),
    ...condition(data.weatherCode),
  };
};
const detailRow = (title: string, result: string, icon: string, colour = "systemBlueColor") => ({
  title,
  value: result,
  icon,
  colour,
});

export const details = (
  r: Report,
  index: number,
  imperial: boolean,
): { title: string; value: string; icon: string; colour: string; tooltip?: string }[] => {
  const { day, data } = summary(r, index, imperial),
    astronomy = day.astronomy?.[0] || {};
  const rows = [
    detailRow(
      "Feels Like",
      value(data[imperial ? "FeelsLikeF" : "FeelsLikeC"], imperial ? "°F" : "°C"),
      "thermometer.medium",
      "systemOrangeColor",
    ),
    detailRow("Humidity", value(data.humidity, "%"), "humidity.fill"),
    detailRow("Cloud Cover", value(data.cloudcover, "%"), "cloud.fill", "systemGrayColor"),
    detailRow(
      "Wind",
      `${value(data[imperial ? "windspeedMiles" : "windspeedKmph"], imperial ? "mph" : "km/h")} ${data.winddir16Point || ""} ${value(data.winddirDegree, "°")}`,
      "wind",
      "systemTealColor",
    ),
    detailRow("UV Index", value(data.uvIndex), "sun.max.fill", "systemOrangeColor"),
    detailRow(
      "Pressure",
      value(data[imperial ? "pressureInches" : "pressure"], imperial ? "inHg" : "hPa", imperial ? 2 : 0),
      "gauge.with.dots.needle.33percent",
      "systemPurpleColor",
    ),
    detailRow(
      "Visibility",
      value(data[imperial ? "visibilityMiles" : "visibility"], imperial ? "mi" : "km"),
      "eye.fill",
      "systemTealColor",
    ),
    detailRow(
      "Precipitation",
      value(data[imperial ? "precipInches" : "precipMM"], imperial ? "in" : "mm", 1),
      "drop.fill",
    ),
    detailRow(
      "Coordinates",
      `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`,
      "location.fill",
      "systemRedColor",
    ),
    detailRow(
      "Sunrise / Sunset",
      `${astronomy.sunrise || "—"}  ·  ${astronomy.sunset || "—"}`,
      "sunrise.fill",
      "systemOrangeColor",
    ),
    detailRow("Sunshine", value(day.sunHour, "hours", 1), "sun.max.fill", "systemYellowColor"),
    detailRow(
      "Low / High",
      `${value(day[imperial ? "mintempF" : "mintempC"], imperial ? "°F" : "°C")} / ${value(day[imperial ? "maxtempF" : "maxtempC"], imperial ? "°F" : "°C")}`,
      "thermometer.low",
      "systemOrangeColor",
    ),
    detailRow(
      "Moon",
      `${astronomy.moon_phase || "—"} · ${value(astronomy.moon_illumination, "%")}`,
      "moon.fill",
      "systemPurpleColor",
    ),
  ];
  const order = new Map(
    ["Feels Like", "UV Index", "Pressure", "Visibility", "Coordinates", "Sunrise / Sunset"].map(
      (title, rank) => [title, rank],
    ),
  );
  const sorted = rows.toSorted((a, b) => (order.get(a.title) ?? 99) - (order.get(b.title) ?? 99));
  const air = r.air;
  const sample = air ? airForDate(air, day.date, index === 0) : null;
  const category = airCategory(sample?.index ?? null);
  const airRow = {
    title: "AQI (US)",
    value:
      sample?.index !== null && sample?.index !== undefined
        ? `${Math.round(sample.index)} · ${category.short} · ${air?.stale ? "cached" : sample.time.slice(11, 16)}`
        : air === undefined
          ? "Loading…"
          : "Unavailable",
    icon: "leaf.fill",
    colour: category.colour,
    tooltip:
      air && sample
        ? `${category.label} · US AQI · ${sample.time} (${air.timezone}) · Modeled data from Open-Meteo/CAMS · Fetched ${new Date(air.fetched).toISOString()}${air.stale ? " · Cached after failed refresh" : ""}`
        : "Air-quality data is unavailable; this does not mean the air is clean.",
  };
  return [airRow, ...sorted];
};
