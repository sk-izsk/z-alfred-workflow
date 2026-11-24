import { emptyPreview, previewPanel } from "../../ui/quick-preview.ts";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bridge } from "../calendar.ts";
import { agendaRange, dateKey, dayHeading, parseDate } from "../dates.ts";
import { cacheDir, str } from "../env.ts";
import {
  agendaView,
  calendarLabel,
  parseSnapshot,
  type CalendarEvent,
  type Snapshot,
  upcoming,
} from "../model.ts";
import { meetingLink } from "../meetings.ts";
import { type Action, finish, menuItem, merge, open, popup, update, vars } from "../ui.ts";

export const previewEvent = (
  snapshot: Snapshot,
  day: string,
  now = new Date(),
): CalendarEvent | undefined => {
  const { start, end } = agendaRange(day, 1, now);
  const mode = agendaView(str("agenda_view", "meetings"));
  const events = upcoming(snapshot, "", Date.parse(start), mode).filter(
    (event) => Date.parse(event.start) < Date.parse(end),
  );
  const future = events.filter((event) => Date.parse(event.end) > now.getTime());
  return day >= dateKey(now) && future.length ? future[0] : events.at(-1);
};

const requestPath = (): string => {
  const id = process.env.cal_window || "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Reopen Quick Calendar to load the day preview.");
  const directory = join(cacheDir(), "preview-requests");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return join(directory, `${id}.json`);
};

export const previewCleanup = async (): Promise<Action> => {
  try {
    unlinkSync(requestPath());
  } catch {
    /* No pending request. */
  }
  return {};
};

const empty = (): Action =>
  merge(
    { replace: { ids: { dayPreview: emptyPreview() } } },
    vars({ cal_preview: "", cal_scroll_title: "" }),
    { pulse: { interval: 0 } },
  );

export const previewLoad = async ([value = ""]: string[]): Promise<Action> => {
  const day = dateKey(parseDate(value));
  let path: string;
  try {
    path = requestPath();
  } catch {
    return {};
  }
  const token = randomUUID();
  writeFileSync(path, token, { mode: 0o600 });
  const current = () => {
    try {
      return readFileSync(path, "utf8") === token;
    } catch {
      return false;
    }
  };
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!current()) return {};
    const range = agendaRange(day, 1);
    const native = await bridge({ command: "snapshot", start: range.start, end: range.end });
    const snapshot = parseSnapshot(native);
    if (!current()) return {};
    const event = previewEvent(snapshot, day);
    if (!event) return empty();
    const calendar = snapshot.calendars.find((c) => c.id === event.calendarId);
    const subtitle = [dayHeading(day), event.links[0]?.provider, calendar ? calendarLabel(calendar) : ""]
      .filter(Boolean)
      .join(" · ");
    const time = event.allDay
      ? "All day"
      : new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return merge(
      { replace: { ids: { dayPreview: previewPanel(event.title, time, subtitle, event.links.length > 0) } } },
      vars({
        cal_preview: JSON.stringify({ day, links: event.links }),
        cal_scroll_title: event.title,
        cal_scroll_started: String(Date.now()),
      }),
      {
        pulse: {
          src: "../bin/cald",
          args: ["quick-scroll"],
          interval: native.reducedMotion === true || Array.from(event.title).length <= 60 ? 0 : 0.3,
          intervalmode: "delay",
        },
      },
    );
  } catch {
    return current() ? empty() : {};
  }
};

export const previewJoin = async ([index = ""]: string[]): Promise<Action> => {
  let data: { day: string; links: { url: string; provider: string }[] };
  try {
    data = JSON.parse(process.env.cal_preview || "");
  } catch {
    return {};
  }
  if (data.day !== process.env.cal_selected || !Array.isArray(data.links)) return {};
  const links = data.links.map((link) => meetingLink(String(link.url))).filter((link) => !!link);
  if (!links.length) return finish({ cal_out: "agenda", cal_day: data.day });
  if (links.length > 1 && !index)
    return popup(
      "actionsButton",
      links.map((link, i) => menuItem(`${link.provider} · Link ${i + 1}`, ["quick-preview-join", String(i)])),
    );
  const link = links[Number(index) || 0];
  return link ? merge(open(link.url), finish()) : {};
};

/** Native-label scrolling: keep an ellipsis pause, then reveal the remaining title without a web view. */
export const titleFrame = (title: string, elapsed: number): string => {
  const characters = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(title)].map(
    (part) => part.segment,
  );
  if (characters.length <= 60 || elapsed < 2500) return title;
  const last = Math.max(1, characters.length - 35);
  const cycle = 2500 + last * 300 + 1500;
  const phase = Math.max(0, elapsed) % cycle;
  if (phase < 2500) return title;
  const offset = Math.min(last, Math.floor((phase - 2500) / 300));
  return offset ? `…${characters.slice(offset).join("")}` : title;
};

export const scrollTitle = async (): Promise<Action> => {
  const title = process.env.cal_scroll_title || "";
  let preview: { day?: string };
  try {
    preview = JSON.parse(process.env.cal_preview || "");
  } catch {
    return { pulse: { interval: 0 } };
  }
  if (!title || preview.day !== process.env.cal_selected) return { pulse: { interval: 0 } };
  return update({
    previewTitle: {
      text: titleFrame(title, Date.now() - Number(process.env.cal_scroll_started || Date.now())),
    },
  });
};
