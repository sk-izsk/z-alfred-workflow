import metadata from "../assets/zones.json" with { type: "json" };
export type Zone = { zone: string; country: string; aliases: string[] };
export type Entry = { id: string; zone: string; alias: string; memo: string; emoji: string; avatar: string };
export type Clock = {
  zone: string;
  date: string;
  time: string;
  hour: number;
  minute: number;
  offset: number;
  utc: string;
  difference: string;
  day: boolean;
  iso: string;
};
const canonicalNames = new Map<string, string>();
export const canonical = (zone: string): string => {
  if (zone.length > 100) throw new Error("Invalid timezone.");
  try {
    const cached = canonicalNames.get(zone);
    if (cached) return cached;
    const value = new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
    canonicalNames.set(zone, value);
    return value;
  } catch {
    throw new Error("Choose a valid IANA timezone.");
  }
};
const regions = new Intl.DisplayNames(["en"], { type: "region" });
let catalog: Zone[] | undefined;
const lookup = new Map<string, Zone>();
export const zones = (): Zone[] => {
  if (catalog) return catalog;
  const labels = new Map<string, { country: string; aliases: string[] }>();
  for (const [zone, info] of Object.entries(metadata)) {
    try {
      const name = canonical(zone),
        old = labels.get(name);
      labels.set(name, {
        country: old?.country || regions.of(info.country) || info.country,
        aliases: [...(old?.aliases || []), zone, info.notes],
      });
    } catch {}
  }
  catalog = [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])].map((zone) => ({
    zone,
    country: labels.get(canonical(zone))?.country || "",
    aliases: labels.get(canonical(zone))?.aliases || [],
  }));
  for (const item of catalog) lookup.set(canonical(item.zone), item);
  return catalog;
};
export const localZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const offset = (zone: string, now: number): number => {
  const name = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")!.value;
  const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
};
export const offsetText = (minutes: number): string =>
  `UTC${minutes < 0 ? "−" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
export const relative = (minutes: number): string => {
  if (!minutes) return "Same time";
  return `${Number((Math.abs(minutes) / 60).toFixed(2))}h ${minutes > 0 ? "ahead" : "behind"}`;
};
export const clock = (zone: string, now = Date.now(), hour24 = true, dateFormat = "iso"): Clock => {
  const parts = new Intl.DateTimeFormat("en", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now),
    part = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = Number(part("hour")),
    minute = Number(part("minute")),
    iso = `${part("year")}-${part("month")}-${part("day")}`;
  const time = hour24
    ? `${part("hour")}:${part("minute")}`
    : `${hour % 12 || 12}:${part("minute")} ${hour < 12 ? "AM" : "PM"}`;
  const date =
    dateFormat === "us"
      ? `${part("month")}/${part("day")}/${part("year")}`
      : dateFormat === "eu"
        ? `${part("day")}/${part("month")}/${part("year")}`
        : iso;
  const minutes = offset(zone, now);
  return {
    zone,
    date,
    time,
    hour,
    minute,
    offset: minutes,
    utc: offsetText(minutes),
    difference: relative(minutes - offset(localZone(), now)),
    day: hour >= 6 && hour < 18,
    iso,
  };
};
export const matches = (entry: Entry, query: string): boolean => {
  zones();
  const info = lookup.get(canonical(entry.zone));
  const haystack =
    `${entry.zone} ${entry.alias} ${entry.memo} ${info?.country || ""} ${info?.aliases.join(" ") || ""}`
      .replaceAll("_", " ")
      .toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .split(/\s+/)
    .every((word) => haystack.includes(word));
};
