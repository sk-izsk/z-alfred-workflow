import { condition, first, hourLabel, type Report, type Json } from "./model.ts";
export type ForecastMode = "hourly" | "daily";
export type ForecastCard = {
  date: string;
  time: string;
  description: string;
  temperature: number | null;
  low: number | null;
  rain: number | null;
  emoji: string;
};
const numeric = (value: unknown): number | null =>
  value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : null;
const clock = (value: unknown): number | null => {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  return ((Number(m[1]) % 12) + (m[3]!.toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2]);
};
const emoji = (hour: Json, day: Json): string => {
  const sunrise = clock(day.astronomy?.[0]?.sunrise),
    sunset = clock(day.astronomy?.[0]?.sunset),
    minutes = (Number(hour.time) / 100) * 60;
  const night = sunrise !== null && sunset !== null && (minutes < sunrise || minutes >= sunset),
    icon = condition(hour.weatherCode, first(hour.weatherDesc)).icon;
  if (icon.includes("bolt")) return "⛈️";
  if (icon.includes("snow")) return "🌨️";
  if (icon.includes("rain")) return "🌧️";
  if (icon.includes("fog")) return "🌫️";
  if (icon.includes("cloud.sun")) return night ? "🌙☁️" : "🌤️";
  if (icon === "sun.max.fill") return night ? "🌙" : "☀️";
  if (icon === "cloud.fill") return "☁️";
  return "❔";
};
export const forecastCards = (
  r: Report,
  dayIndex: number,
  imperial: boolean,
  mode: ForecastMode,
): ForecastCard[] => {
  const days = r.days.slice(dayIndex);
  return days.flatMap((day) => {
    if (mode === "daily") {
      const noon = day.hourly.find((h: Json) => Number(h.time) === 1200) || day.hourly[0] || {},
        rain = day.hourly
          .map((h: Json) => numeric(h.chanceofrain))
          .filter((v: number | null): v is number => v !== null);
      return [
        {
          date: day.date,
          time: "Daily",
          description: first(noon.weatherDesc),
          temperature: numeric(day[imperial ? "maxtempF" : "maxtempC"]),
          low: numeric(day[imperial ? "mintempF" : "mintempC"]),
          rain: rain.length ? Math.max(...rain) : null,
          emoji: emoji({ ...noon, time: "1200" }, day),
        },
      ];
    }
    return day.hourly.map((hour: Json) => ({
      date: day.date,
      time: hourLabel(hour.time),
      description: first(hour.weatherDesc),
      temperature: numeric(hour[imperial ? "tempF" : "tempC"]),
      low: null,
      rain: numeric(hour.chanceofrain),
      emoji: emoji(hour, day),
    }));
  });
};
