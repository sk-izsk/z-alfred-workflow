import { addDays, dateKey, localDateTime, parseDate } from "./dates.ts";
import { type MeetingLink, meetingLinks, validateMeetingURL } from "./meetings.ts";

export type Calendar = {
  id: string;
  title: string;
  source: string;
  writable: boolean;
  color: string;
  isDefault: boolean;
};
export type CalendarEvent = {
  id: string;
  uid: string;
  title: string;
  calendarId: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  links: MeetingLink[];
};
export type Snapshot = { calendars: Calendar[]; events: CalendarEvent[] };

export const calendarLabel = (calendar: Calendar): string => `${calendar.source} — ${calendar.title}`;

/** Validate native bridge output before displaying or caching it. Do not retain event notes. */
const string = (x: unknown): x is string => typeof x === "string";

export const parseSnapshot = (value: unknown): Snapshot => {
  if (!value || typeof value !== "object") throw new Error("Invalid calendar response.");
  const { calendars, events } = value as Record<string, unknown>;
  if (!Array.isArray(calendars) || !Array.isArray(events)) throw new Error("Invalid calendar response.");
  const validCalendars = calendars.map((c: Record<string, unknown>) => {
    if (!c || !string(c.id) || !string(c.title) || !string(c.source) || typeof c.writable !== "boolean")
      throw new Error("Invalid calendar metadata.");
    return {
      id: c.id,
      title: c.title,
      source: c.source,
      writable: c.writable,
      isDefault: c.isDefault === true,
      color: string(c.color) && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : "#0a84ff",
    };
  });
  const validEvents = events.map((e: Record<string, unknown>) => {
    if (
      !e ||
      ![e.id, e.title, e.calendarId, e.start, e.end].every(string) ||
      !Number.isFinite(Date.parse(String(e.start))) ||
      !Number.isFinite(Date.parse(String(e.end)))
    )
      throw new Error("Invalid calendar event.");
    const id = String(e.id),
      start = String(e.start);
    return {
      id,
      uid: Buffer.from(JSON.stringify([id, start])).toString("base64url"),
      title: String(e.title),
      calendarId: String(e.calendarId),
      start,
      end: String(e.end),
      allDay: e.allDay === true,
      location: string(e.location) ? e.location : "",
      links: meetingLinks(String(e.url ?? ""), String(e.location ?? ""), String(e.notes ?? "")),
    };
  });
  return { calendars: validCalendars, events: validEvents };
};

export type AgendaView = "meetings" | "timed" | "all";
export const agendaView = (value: string): AgendaView =>
  value === "all" || value === "timed" ? value : "meetings";

export const upcoming = (
  snapshot: Snapshot,
  calendarId: string,
  now: number,
  view: AgendaView = "all",
): CalendarEvent[] =>
  snapshot.events
    .filter(
      (e) =>
        (!calendarId || e.calendarId === calendarId) &&
        Date.parse(e.end) > now &&
        (view === "all" || (view === "timed" ? !e.allDay : e.links.length > 0)),
    )
    .toSorted((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title));

export type EventForm = {
  title: string;
  calendarId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  location: string;
  notes: string;
  meetingURL: string;
};
export type NewEvent = {
  title: string;
  calendarId: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  notes: string;
  url: string;
};

export const eventFromForm = (form: EventForm, calendars: Calendar[]): NewEvent => {
  if (!form.title.trim()) throw new Error("Enter an event title.");
  if (form.title.length > 1000 || form.notes.length > 50000 || form.location.length > 2000)
    throw new Error("The title, notes or location is too long.");
  const calendar = calendars.find((c) => c.id === form.calendarId);
  if (!calendar?.writable)
    throw new Error("Choose a writable calendar. Refresh if the calendar was removed.");
  const start = form.allDay ? parseDate(form.startDate) : localDateTime(form.startDate, form.startTime);
  // The UI asks for an inclusive last day; EventKit stores all-day end dates exclusively.
  const end = form.allDay ? addDays(parseDate(form.endDate), 1) : localDateTime(form.endDate, form.endTime);
  if (form.allDay) {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
  }
  if (end <= start) throw new Error("The event must end after it starts.");
  return {
    title: form.title.trim(),
    calendarId: calendar.id,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: form.allDay,
    location: form.location.trim(),
    notes: form.notes,
    url: validateMeetingURL(form.meetingURL),
  };
};

export const eventDetail = (event: CalendarEvent, calendar?: Calendar): string =>
  [
    event.title,
    event.allDay
      ? `${dateKey(new Date(event.start))} · All day`
      : `${new Date(event.start).toLocaleString()} – ${new Date(event.end).toLocaleString()}`,
    calendar ? calendarLabel(calendar) : "",
    event.location,
    ...event.links.map((l) => l.url),
  ]
    .filter(Boolean)
    .join("\n");
