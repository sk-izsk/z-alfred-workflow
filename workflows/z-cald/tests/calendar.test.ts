import { expect, test } from "bun:test";
import {
  addDays,
  dateKey,
  defaultTimes,
  isoWeek,
  localDateTime,
  monthGrid,
  parseDate,
  shiftMonth,
} from "../src/dates.ts";
import { meetingLinks, validateMeetingURL } from "../src/meetings.ts";
import {
  agendaView,
  calendarLabel,
  eventFromForm,
  parseSnapshot,
  upcoming,
  type EventForm,
} from "../src/model.ts";
import { rootItems } from "../src/commands/root.ts";
import { agendaRows } from "../src/commands/agenda.ts";

test("cal is a searchable menu with direct aliases and forwarded form titles", () => {
  expect(rootItems("").map((i) => i.variables.cal_target)).toEqual(["agenda", "quick", "create"]);
  expect(rootItems("calc")[0]?.variables.cal_target).toBe("create");
  expect(rootItems("create")[0]?.variables.cal_target).toBe("create");
  expect(rootItems("quick cal")[0]?.variables.cal_target).toBe("quick");
  expect(rootItems("create Team sync")[0]?.arg).toBe("Team sync");
  expect(rootItems("upcoming interview")[0]?.arg).toBe("interview");
  expect(rootItems("not-a-command")).toEqual([]);
});

test("month grids handle week starts, leap years and year boundaries", () => {
  const monday = monthGrid(new Date(2024, 1, 1), 1);
  expect(monday).toHaveLength(42);
  expect(monday[0]?.date).toBe("2024-01-29");
  expect(monday.filter((d) => d.currentMonth)).toHaveLength(29);
  expect(monthGrid(new Date(2024, 1, 1), 0)[0]?.date).toBe("2024-01-28");
  expect(dateKey(shiftMonth(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  expect(isoWeek(parseDate("2021-01-01"))).toBe(53);
  expect(isoWeek(parseDate("2021-01-04"))).toBe(1);
});

test("dates and times reject normalized invalid input", () => {
  expect(() => parseDate("2026-02-29")).toThrow();
  expect(() => parseDate("2026-13-01")).toThrow();
  expect(() => localDateTime("2026-11-24", "24:00")).toThrow();
  expect(() => localDateTime("2026-11-24", "9:00")).toThrow();
  expect(defaultTimes(new Date(2026, 11, 31, 23, 50))).toEqual({
    startDate: "2027-01-01",
    startTime: "00:00",
    endDate: "2027-01-01",
    endTime: "00:30",
  });
});

test("day arithmetic and nonexistent local times respect daylight-saving transitions", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `
    import { parseDate, addDays, localDateTime } from "./src/dates.ts";
    const start=parseDate("2026-03-07"), end=addDays(start,1);
    let rejected=false; try { localDateTime("2026-03-08","02:30"); } catch { rejected=true; }
    console.log(JSON.stringify({hours:(end-start)/3600000,rejected}));
  `,
    ],
    { cwd: import.meta.dir + "/..", env: { ...process.env, TZ: "America/Toronto" } },
  );
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())).toEqual({ hours: 23, rejected: true });
});

test("links preserve passcodes, reject spoofed hosts/schemes and deduplicate", () => {
  const zoom = "https://company.zoom.us/j/123456789?pwd=secret&other=1";
  const links = meetingLinks(
    `<a href="${zoom.replace("&", "&amp;")}">Join</a>`,
    `Meeting (${zoom}). Also https://meet.google.com/abc-defg-hij`,
    "https://teams.microsoft.com/l/meetup-join/abc?context=xyz",
  );
  expect(links.map((l) => l.provider)).toEqual(["Zoom", "Google Meet", "Microsoft Teams"]);
  expect(links[0]?.url).toBe(zoom);
  for (const url of [
    "https://zoom.us.evil.test/j/123",
    "https://evilzoom.us/j/123",
    "javascript:alert(1)",
    "file:///tmp/x",
    "https://user:password@zoom.us/j/123",
  ])
    expect(() => validateMeetingURL(url)).toThrow();
  expect(validateMeetingURL("")).toBe("");
});

const snapshot = () =>
  parseSnapshot({
    calendars: [
      { id: "work", title: "Calendar", source: "Work", writable: true, isDefault: true, color: "#123456" },
      { id: "personal", title: "Calendar", source: "Personal", writable: false, color: "invalid" },
    ],
    events: [
      {
        id: "recurring",
        title: "Standup",
        calendarId: "work",
        start: "2026-11-24T14:00:00Z",
        end: "2026-11-24T15:00:00Z",
        notes: "Private notes https://meet.google.com/abc-defg-hij",
      },
      {
        id: "recurring",
        title: "Standup",
        calendarId: "work",
        start: "2026-11-25T14:00:00Z",
        end: "2026-11-25T15:00:00Z",
      },
      {
        id: "past",
        title: "Yesterday",
        calendarId: "personal",
        start: "2026-11-23T14:00:00Z",
        end: "2026-11-23T15:00:00Z",
      },
    ],
  });

test("native snapshot distinguishes recurring occurrences and removes notes before caching", () => {
  const data = snapshot();
  expect(data.events[0]?.uid).not.toBe(data.events[1]?.uid);
  expect(data.events[0]?.links[0]?.provider).toBe("Google Meet");
  expect(JSON.stringify(data)).not.toContain("Private notes");
  expect(data.calendars[1]?.color).toBe("#0a84ff");
  expect(calendarLabel(data.calendars[0]!)).not.toBe(calendarLabel(data.calendars[1]!));
  expect(() => parseSnapshot({ calendars: [], events: [{ start: "garbage" }] })).toThrow();
});

test("agenda retains ongoing meetings, drops ended ones and filters calendars", () => {
  const data = snapshot();
  const now = Date.parse("2026-11-24T14:30:00Z");
  expect(upcoming(data, "", now)).toHaveLength(2);
  expect(upcoming(data, "personal", now)).toEqual([]);
  const rows = agendaRows(data, "work", now);
  expect(rows[0]?.["rowTime.text"]).toContain("Now");
  expect(rows[0]?.["rowDay.text"]).toBe("Today");
  expect(rows[0]?.["rowProvider.text"]).toBe("Join Meet");
  expect(rows[0]?.["rowProviderIcon.image.src"]).toBe("../icons/meet.png");
  expect(rows[1]?.["rowProvider.text"]).toBe("No link");
});

const form = (): EventForm => ({
  title: "Team sync",
  calendarId: "work",
  startDate: "2026-11-24",
  startTime: "14:00",
  endDate: "2026-11-24",
  endTime: "14:30",
  allDay: false,
  location: "Room 1",
  notes: "Agenda",
  meetingURL: "https://meet.google.com/abc-defg-hij",
});

test("event form validates calendars, times and inclusive all-day dates", () => {
  const data = snapshot();
  expect(eventFromForm(form(), data.calendars).url).toBe("https://meet.google.com/abc-defg-hij");
  expect(() => eventFromForm({ ...form(), calendarId: "personal" }, data.calendars)).toThrow("writable");
  expect(() => eventFromForm({ ...form(), title: " " }, data.calendars)).toThrow("title");
  expect(() => eventFromForm({ ...form(), endTime: "13:00" }, data.calendars)).toThrow("after");
  const allDay = eventFromForm({ ...form(), allDay: true }, data.calendars);
  expect(dateKey(new Date(allDay.end))).toBe("2026-11-25");
  expect(new Date(allDay.start).getHours()).toBe(0);
  const longer = eventFromForm({ ...form(), allDay: true, endDate: "2026-11-26" }, data.calendars);
  expect(dateKey(new Date(longer.end))).toBe("2026-11-27");
  expect(dateKey(addDays(parseDate("2026-11-24"), 1))).toBe("2026-11-25");
});

test("meetings view hides holiday noise; timed and all views keep their distinct scope", () => {
  const data = snapshot();
  data.events.push({
    ...data.events[1]!,
    id: "holiday",
    uid: "holiday",
    title: "Public holiday",
    allDay: true,
  });
  const now = Date.parse("2026-11-24T14:30:00Z");
  expect(upcoming(data, "", now, "meetings").map((e) => e.title)).toEqual(["Standup"]);
  expect(upcoming(data, "", now, "timed")).toHaveLength(2);
  expect(upcoming(data, "", now, "all")).toHaveLength(3);
  expect(upcoming(data, "personal", now, "meetings")).toEqual([]);
  expect(agendaView("bad")).toBe("meetings");
});
