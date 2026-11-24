/** Calendar arithmetic uses local dates, never 24-hour jumps across daylight-saving changes. */
export const dateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const parseDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Use YYYY-MM-DD for dates.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (dateKey(date) !== value) throw new Error("That date does not exist.");
  return date;
};

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes());

export const shiftMonth = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, 1, 12);

/** ISO week numbering (Monday, first week contains January 4). */
export const isoWeek = (date: Date): number => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  return Math.ceil(((utc.getTime() - Date.UTC(utc.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};

export const monthGrid = (month: Date, weekStart: 0 | 1) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date: dateKey(date), day: date.getDate(), currentMonth: date.getMonth() === month.getMonth() };
  });
};

/** Reject normalized invalid times, including a time skipped by a daylight-saving transition. */
export const localDateTime = (day: string, time: string): Date => {
  const date = parseDate(day);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw new Error("Use 24-hour HH:MM for times.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  date.setHours(hours, minutes, 0, 0);
  if (dateKey(date) !== day || date.getHours() !== hours || date.getMinutes() !== minutes)
    throw new Error("That local time does not exist because the clocks change. Choose another time.");
  return date;
};

export const timeText = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const defaultTimes = (now = new Date()) => {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(Math.floor(start.getMinutes() / 30) * 30 + 30);
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    startDate: dateKey(start),
    startTime: timeText(start),
    endDate: dateKey(end),
    endTime: timeText(end),
  };
};

export const agendaRange = (day: string, lookahead: number, now = new Date()) => {
  const start = day ? parseDate(day) : new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, day ? 1 : lookahead);
  return { start: start.toISOString(), end: end.toISOString(), now: day ? start.getTime() : now.getTime() };
};

export const dayHeading = (day: string, now = new Date()): string => {
  if (day === dateKey(now)) return "Today";
  if (day === dateKey(addDays(now, 1))) return "Tomorrow";
  return parseDate(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};
