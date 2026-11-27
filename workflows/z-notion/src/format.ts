// Relative times and typed dates (shared with the Splitwise workflow).

/** `38m`, `5h`, `3d`, `2w`, `4mo`, `1y`, like Raycast's date accessory. */
export const ago = (iso: string, now = Date.now()): string => {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
};

export const longDate = (iso: string | Date): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });

const pad = (n: number) => String(n).padStart(2, "0");
/** The value shown in a date field: `2026-01-04 12:00`. */
export const fieldDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Dates typed into a form: `2026-01-04`, `2026-01-04 12:00`, `today`, `yesterday`, `tomorrow`,
 * `-3d`, `+1w`, or just `18:30` / `6pm` (today). Empty means now.
 */
export const parseWhen = (input: string, now = new Date()): Date | undefined => {
  const text = input.trim().toLowerCase();
  if (!text || text === "now") return new Date(now);
  const day = new Date(now);
  let rest = text;
  const named = /^(today|yesterday|tomorrow)\b\s*/.exec(rest);
  const relative = /^([+-]\d+)\s*([dw])\b\s*/.exec(rest);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})\b\s*/.exec(rest);
  if (named) {
    const shift = { today: 0, yesterday: -1, tomorrow: 1 }[named[1] as "today" | "yesterday" | "tomorrow"];
    day.setDate(day.getDate() + shift);
    rest = rest.slice(named[0].length);
  } else if (relative) {
    day.setDate(day.getDate() + Number(relative[1]) * (relative[2] === "w" ? 7 : 1));
    rest = rest.slice(relative[0].length);
  } else if (iso) {
    day.setFullYear(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (day.getMonth() !== Number(iso[2]) - 1) return undefined;
    rest = rest.slice(iso[0].length);
  }
  const time = /^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(rest);
  if (rest && !time) return undefined;
  if (time) {
    let hours = Number(time[1]);
    if (time[3] === "pm" && hours < 12) hours += 12;
    if (time[3] === "am" && hours === 12) hours = 0;
    const minutes = Number(time[2] ?? 0);
    if (hours > 23 || minutes > 59) return undefined;
    day.setHours(hours, minutes, 0, 0);
  } else day.setHours(12, 0, 0, 0);
  return day;
};

/** True when the typed date had no time: Notion stores it as a whole day. */
export const isAllDay = (input: string): boolean => !/\d:\d|\d\s*(am|pm)\b|\bat\b/i.test(input.trim());
