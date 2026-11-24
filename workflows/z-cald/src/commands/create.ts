import { cachedSnapshot, createEvent, loadSnapshot } from "../calendar.ts";
import { addDays, agendaRange, dateKey, defaultTimes, parseDate } from "../dates.ts";
import { dataDir, readJson, writeJson } from "../env.ts";
import { calendarLabel, eventFromForm, type EventForm } from "../model.ts";
import { type Action, merge, status, update } from "../ui.ts";
import { join } from "node:path";

const preferences = () => join(dataDir(), "selection.json");

export const createInit = async ([query = ""]: string[]): Promise<Action> => {
  const times = defaultTimes();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(query) ? dateKey(parseDate(query)) : "";
  const today = day || times.startDate;
  return merge(
    update({
      titleField: { text: day ? "" : query },
      startDate: { text: today },
      startTime: { text: times.startTime },
      endDate: {
        text: day
          ? dateKey(addDays(parseDate(day), times.startDate === times.endDate ? 0 : 1))
          : times.endDate,
      },
      endTime: { text: times.endTime },
      timezoneLabel: {
        text: `Times: ${Intl.DateTimeFormat().resolvedOptions().timeZone} · Dates: YYYY-MM-DD · Time: HH:MM (24h)`,
      },
      createButton: { enabled: false },
    }),
    status("Choose a calendar, fill the form, then ⌘↩ to create."),
  );
};

export const createRefresh = async (): Promise<Action> => {
  const range = agendaRange("", 1);
  await loadSnapshot(range.start, range.end);
  return merge(
    update({
      createButton: { enabled: true },
      accessButton: { hidden: true, constraints: { size: { width: 0, height: 0 } } },
    }),
    status("Choose a calendar, then ⌘↩ to create."),
  );
};

export const createPickers = async ([current = ""]: string[] = []): Promise<Action> => {
  const calendars = cachedSnapshot()
    .calendars.filter((c) => c.writable)
    .toSorted((a, b) => calendarLabel(a).localeCompare(calendarLabel(b)));
  const last = readJson<{ calendarId: string }>(preferences(), { calendarId: "" }).calendarId;
  const selected =
    calendars.find((c) => c.id === current) ??
    calendars.find((c) => c.id === last) ??
    calendars.find((c) => c.isDefault) ??
    calendars[0];
  if (!selected)
    return merge(
      update({ createButton: { enabled: false } }),
      status("No writable calendars. Add an account in macOS Calendar and refresh."),
    );
  return update({
    calendarPicker: {
      items: calendars.map((c) => ({ text: calendarLabel(c), value: c.id })),
      selected: selected.id,
    },
  });
};

export const formFromEnv = (env = process.env): EventForm => ({
  title: env.cal_title || "",
  calendarId: env.cal_calendar || "",
  startDate: env.cal_start_date || "",
  startTime: env.cal_start_time || "",
  endDate: env.cal_end_date || "",
  endTime: env.cal_end_time || "",
  allDay: env.cal_all_day === "true" || env.cal_all_day === "1",
  location: env.cal_location || "",
  notes: env.cal_notes || "",
  meetingURL: env.cal_meeting_url || "",
});

export const createSave = async (): Promise<Action> => {
  const form = formFromEnv();
  const event = eventFromForm(form, cachedSnapshot().calendars);
  await createEvent(event);
  // Preference persistence must not turn a successful save into an apparent failure and duplicate event.
  try {
    writeJson(preferences(), { calendarId: event.calendarId });
  } catch {
    /* Event is already saved. */
  }
  return {
    notification: {
      post: { title: "Calendar", text: "Event created. macOS will sync it with the selected account." },
    },
    finish: {},
  };
};
