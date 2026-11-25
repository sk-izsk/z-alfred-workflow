export const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export const displayed = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type Day = {
  date: string;
  hijri: string;
  timezone: string;
  method: string;
  school: string;
  times: Record<string, string>;
};
export const localDate = (now: number, timezone: string): string => {
  const p = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (key: string) => p.find((v) => v.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
export const shiftDate = (date: string, amount: number): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date.");
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};
export const clock = (raw: unknown): string => {
  const m = String(raw ?? "").match(/^(\d{2}):(\d{2})(?:\s|$)/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1]}:${m[2]}` : "—";
};
export const formatTime = (time: string, twelve: boolean): string => {
  if (time === "—" || !twelve) return time;
  const [h, m] = time.split(":").map(Number);
  return `${h! % 12 || 12}:${String(m).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};
export const parseMonth = (raw: unknown): Day[] => {
  const response = raw as { code?: number; data?: any[] };
  if (response?.code !== 200 || !Array.isArray(response.data) || !response.data.length)
    throw new Error("Prayer service returned no calendar.");
  return response.data.map((item) => {
    const g = item.date?.gregorian,
      timezone = item.meta?.timezone;
    if (!g || typeof timezone !== "string")
      throw new Error("Prayer calendar is missing its date or timezone.");
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    const date = `${g.year}-${String(g.month?.number).padStart(2, "0")}-${String(g.day).padStart(2, "0")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || localDate(Date.parse(`${date}T12:00:00Z`), "UTC") !== date)
      throw new Error("Invalid calendar date.");
    const times = Object.fromEntries(displayed.map((name) => [name, clock(item.timings?.[name])]));
    if (prayers.every((name) => times[name] === "—"))
      throw new Error("No prayer times available for this location/date.");
    const h = item.date.hijri;
    return {
      date,
      timezone,
      times,
      hijri: h ? `${h.day} ${h.month?.en || ""} ${h.year} AH` : "",
      method: item.meta.method?.name || "Unknown method",
      school: item.meta.school || "Unknown school",
    };
  });
};
// Convert city-local wall time rather than interpreting the provider's clock in the Mac's timezone.
export const prayerInstant = (day: Day, time: string): number | null => {
  if (time === "—") return null;
  const target = Date.parse(`${day.date}T${time}:00Z`);
  let epoch = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: day.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const p = formatter.formatToParts(epoch),
      part = (key: string) => p.find((v) => v.type === key)!.value;
    const wall = Date.parse(
      `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`,
    );
    const delta = target - wall;
    if (!delta) return epoch;
    epoch += delta;
  }
  return null;
};
export const nextPrayer = (days: Day[], now = Date.now()): { name: string; day: Day; at: number } | null => {
  const candidates = days.flatMap((day) =>
    prayers.flatMap((name) => {
      const at = prayerInstant(day, day.times[name]!);
      return at !== null && at > now ? [{ name, day, at }] : [];
    }),
  );
  return candidates.toSorted((a, b) => a.at - b.at)[0] || null;
};
export const countdown = (at: number, now = Date.now()): string => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
