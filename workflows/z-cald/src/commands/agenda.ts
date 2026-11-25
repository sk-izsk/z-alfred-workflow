import { forward } from "../navigation.ts";
import { bridge, cachedSnapshot, loadSnapshot } from "../calendar.ts";
import { agendaRange, dateKey, dayHeading } from "../dates.ts";
import { str } from "../env.ts";
import {
  agendaView,
  type AgendaView,
  calendarLabel,
  type CalendarEvent,
  eventDetail,
  type Snapshot,
  upcoming,
} from "../model.ts";
import {
  type Action,
  copy,
  finish,
  fn,
  menuItem,
  merge,
  open,
  popup,
  separator,
  status,
  update,
  vars,
} from "../ui.ts";

const day = (): string =>
  process.env.cal_day ||
  (/^\d{4}-\d{2}-\d{2}$/.test(process.env.cal_query ?? "") ? process.env.cal_query! : "");
const range = () =>
  agendaRange(day(), Math.max(1, Math.min(90, Math.floor(Number(str("lookahead_days", "7"))) || 7)));

const view = (): AgendaView => agendaView(process.env.cal_view || str("agenda_view", "meetings"));

export const providerBadge = (event: CalendarEvent): Action => {
  const provider = event.links[0]?.provider || "";
  const style = {
    "Google Meet": { icon: "meet.png", text: "Join Meet", color: "#34a85320" },
    Zoom: { icon: "zoom.png", text: "Join Zoom", color: "#2d8cff20" },
    "Microsoft Teams": { icon: "teams.png", text: "Join Teams", color: "#6264a720" },
  }[provider];
  return {
    "rowProvider.text": style?.text ?? (provider ? `Join ${provider}` : "No link"),
    "rowProviderIcon.image.type": style ? "file" : "symbol",
    "rowProviderIcon.image.src": style ? `../icons/${style.icon}` : provider ? "video" : "calendar",
    "rowProviderPill.background": style?.color ?? "#80808012",
    "rowProviderPill.tooltip": provider
      ? `${provider} meeting link available — press Return to join`
      : "No supported meeting link in the event URL, location or notes",
  };
};

export const agendaRows = (
  snapshot: Snapshot,
  filter: string,
  after: number,
  now = after,
  mode: AgendaView = "all",
): Action[] => {
  let previousDay = "";
  return upcoming(snapshot, filter, after, mode).map((event) => {
    const calendar = snapshot.calendars.find((c) => c.id === event.calendarId);
    const date = dateKey(new Date(event.start));
    const heading = date !== previousDay ? dayHeading(date, new Date(now)) : "";
    previousDay = date;
    const ongoing = Date.parse(event.start) <= now && Date.parse(event.end) > now && !event.allDay;
    const time = event.allDay
      ? "All day"
      : new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return {
      uid: event.uid,
      "rowDay.text": heading,
      "rowTitle.text": event.title,
      "rowTime.text": `${ongoing ? "Now · " : ""}${time}`,
      "rowCalendar.text": calendar ? calendarLabel(calendar) : "Calendar",
      "rowStripe.background": calendar?.color ?? "#0a84ff",
      ...providerBadge(event),
      match: `${event.title} ${date} ${dayHeading(date)} ${calendar?.title} ${calendar?.source} ${event.links.map((l) => l.provider).join(" ")}`,
    };
  });
};

const render = (snapshot: Snapshot, filter: string, mode = view()): Action => {
  const src = agendaRows(snapshot, filter, range().now, Date.now(), mode);
  return merge(
    fn({ items: process.env.cal_item ? ["filterdata"] : ["filterdata", "selectfirst"] }),
    status(
      src.length
        ? `${src.length} ${mode === "meetings" ? "meetings" : "events"} · ${day() || "Upcoming"} · ⌘R refresh`
        : mode === "meetings"
          ? "No meetings. Switch to Timed events or All events."
          : "No upcoming events in this range",
    ),
    update({
      primaryButton: { text: "Join / Open  ↩" },
      searchField: {
        placeholder: mode === "meetings" ? "Search meetings…" : "Search events…",
        text:
          process.env.cal_search ||
          (/^\d{4}-\d{2}-\d{2}$/.test(process.env.cal_query || "") ? "" : process.env.cal_query || ""),
      },
      items: {
        data: { src },
        ...(process.env.cal_item ? { select: process.env.cal_item } : {}),
        placeholder:
          mode === "meetings"
            ? "No meetings with a supported link. Choose Timed events for in-person meetings, or All events to include holidays."
            : "No events in this range or calendar.",
      },
      accessButton: { hidden: true, constraints: { size: { width: 0, height: 0 } } },
    }),
  );
};

export const agendaLoad = async (): Promise<Action> => {
  const { start, end } = range();
  const snapshot = await loadSnapshot(start, end);
  const selected = snapshot.calendars.some((c) => c.id === process.env.cal_filter)
    ? process.env.cal_filter!
    : "";
  return merge(render(snapshot, selected), vars({ cal_filter: selected, cal_day: day(), cal_view: view() }));
};

export const agendaPickers = async (): Promise<Action> => {
  const snapshot = cachedSnapshot();
  const selected = snapshot.calendars.some((c) => c.id === process.env.cal_filter)
    ? process.env.cal_filter!
    : "";
  return update({
    viewPicker: { selected: view() },
    calendarPicker: {
      items: [
        { text: "All Calendars", value: "" },
        ...snapshot.calendars
          .toSorted((a, b) => calendarLabel(a).localeCompare(calendarLabel(b)))
          .map((c) => ({ text: calendarLabel(c), value: c.id })),
      ],
      selected,
    },
  });
};

export const agendaFilter = async ([filter = "", selectedView = "meetings"]: string[]): Promise<Action> => {
  const snapshot = cachedSnapshot();
  const id = snapshot.calendars.some((c) => c.id === filter) ? filter : "";
  const mode = agendaView(selectedView);
  return merge(vars({ cal_filter: id, cal_view: mode }), render(snapshot, id, mode));
};

const selectedEvent = (uid: string): { event: CalendarEvent; snapshot: Snapshot } => {
  const snapshot = cachedSnapshot();
  const event = snapshot.events.find((e) => e.uid === uid);
  if (!event) throw new Error("Select an event, or refresh the list (⌘R).");
  return { event, snapshot };
};

const joinMenu = (event: CalendarEvent, action: "join" | "copy-link"): Action =>
  popup(
    "actionsButton",
    event.links.map((link, index) =>
      menuItem(`${link.provider} · Link ${index + 1}`, ["event", action, event.uid, String(index)]),
    ),
  );

export const eventAction = async ([action = "", uid = "", index = ""]: string[]): Promise<Action> => {
  if (action === "create") return forward("agenda", "create", day());
  if (action === "selected" && !uid) return {};
  let selection: { event: CalendarEvent; snapshot: Snapshot };
  try {
    selection = selectedEvent(uid);
  } catch (error) {
    if (action === "selected") return {};
    throw error;
  }
  const { event, snapshot } = selection;
  if (action === "selected")
    return merge(
      vars({ cal_item: uid }),
      status(
        `${event.title} · ${event.allDay ? "All day" : new Date(event.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
      ),
      update({
        primaryButton: {
          text: event.links.length ? `Join ${event.links[0]!.provider}  ↩` : "Open Calendar  ↩",
        },
      }),
    );
  if (action === "menu")
    return popup("actionsButton", [
      ...(event.links.length
        ? [
            menuItem("Join Meeting", ["event", "join", uid], "↩"),
            menuItem("Copy Meeting Link", ["event", "copy-link", uid]),
          ]
        : []),
      menuItem("Show Date in Calendar", ["event", "open", uid], "⌘O"),
      menuItem("Copy Event Details", ["event", "copy", uid]),
      separator,
      menuItem("Create Event", ["event", "create", uid], "⌘N"),
    ]);
  if (action === "open" || (action === "join" && !event.links.length))
    return finish({ cal_out: "show-date", cal_day: dateKey(new Date(event.start)) });
  if (action === "copy")
    return copy(
      eventDetail(
        event,
        snapshot.calendars.find((c) => c.id === event.calendarId),
      ),
    );
  if (action === "join" || action === "copy-link") {
    if (event.links.length > 1 && index === "") return joinMenu(event, action);
    const link = event.links[Number(index) || 0];
    if (!link) return status("This event has no supported meeting link.");
    return action === "copy-link" ? copy(link.url) : merge(open(link.url), finish());
  }
  return fn({ items: "filterdata" });
};

export const authorize = async (): Promise<Action> => {
  await bridge({ command: "authorize" });
  return status("Calendar access granted. Refresh with ⌘R.");
};
