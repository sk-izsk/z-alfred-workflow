/* global ObjC, $, Ref */
// Plain JXA, executed by Apple's osascript. Request payloads arrive on stdin, never argv.
ObjC.import("EventKit");
ObjC.import("Foundation");
ObjC.import("AppKit");

var text = (value) => (value && !value.isNil() ? String(ObjC.unwrap(value)) : "");
var iso = (value) => new Date(Number(value.timeIntervalSince1970) * 1000).toISOString();
var nativeDate = (value) => $.NSDate.dateWithTimeIntervalSince1970(Date.parse(value) / 1000);
var authorization = () => Number($.EKEventStore.authorizationStatusForEntityType(0));
var color = (calendar) => {
  try {
    const rgb = $.NSColor.colorWithCGColor(calendar.CGColor).colorUsingColorSpace(
      $.NSColorSpace.sRGBColorSpace,
    );
    return (
      "#" +
      [rgb.redComponent, rgb.greenComponent, rgb.blueComponent]
        .map((component) =>
          Math.round(Number(component) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  } catch {
    return "#0a84ff";
  }
};

// A global handler is required by osascript's JXA runtime.
// oxlint-disable-next-line no-unused-vars
var run = () => {
  try {
    const data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
    const input = JSON.parse(
      ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)),
    );
    const store = $.EKEventStore.alloc.init;
    if (input.command === "status") return JSON.stringify({ ok: true, status: authorization() });
    if (input.command === "authorize" && authorization() === 0) {
      // Wait only while the user responds; a pending prompt is not an empty calendar.
      store.requestFullAccessToEventsWithCompletion(() => {});
      const deadline = Date.now() + 15000;
      while (authorization() === 0 && Date.now() < deadline)
        $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
    }
    if (authorization() !== 3)
      return JSON.stringify({
        ok: false,
        code: "permission",
        error:
          "Calendar access is required. Allow full access in System Settings → Privacy & Security → Calendars, then refresh (⌘R).",
      });
    if (input.command === "authorize") return JSON.stringify({ ok: true });
    const calendars = store.calendarsForEntityType(0);
    if (input.command === "create") {
      const draft = input.event;
      if (
        !draft ||
        typeof draft.title !== "string" ||
        !draft.title.trim() ||
        !Number.isFinite(Date.parse(draft.start)) ||
        !Number.isFinite(Date.parse(draft.end)) ||
        Date.parse(draft.end) <= Date.parse(draft.start)
      )
        throw new Error("Invalid event details.");
      const calendar = store.calendarWithIdentifier(String(draft.calendarId));
      if (!calendar || calendar.isNil() || !calendar.allowsContentModifications)
        throw new Error("This calendar is unavailable or read-only. Refresh and choose another calendar.");
      const event = $.EKEvent.eventWithEventStore(store);
      event.title = draft.title;
      event.calendar = calendar;
      event.startDate = nativeDate(draft.start);
      event.endDate = nativeDate(draft.end);
      event.allDay = draft.allDay === true;
      event.timeZone = $.NSTimeZone.localTimeZone;
      event.location = String(draft.location || "");
      event.notes = String(draft.notes || "");
      if (draft.url) {
        if (!draft.url.startsWith("https://")) throw new Error("Invalid meeting URL.");
        event.URL = $.NSURL.URLWithString(draft.url);
      }
      const error = Ref();
      if (!store.saveEventSpanCommitError(event, 0, true, error))
        throw new Error("Calendar could not save this event. Check the account and try again.");
      return JSON.stringify({ ok: true, id: text(event.eventIdentifier) });
    }
    if (input.command !== "snapshot") throw new Error("Unknown calendar command.");
    const start = Date.parse(input.start),
      end = Date.parse(input.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 367 * 86400000)
      throw new Error("Invalid event date range.");
    const result = { calendars: [], events: [] };
    const defaultCalendar = store.defaultCalendarForNewEvents;
    const defaultId =
      defaultCalendar && !defaultCalendar.isNil() ? text(defaultCalendar.calendarIdentifier) : "";
    for (let i = 0; i < Number(calendars.count); i++) {
      const calendar = calendars.objectAtIndex(i);
      result.calendars.push({
        id: text(calendar.calendarIdentifier),
        title: text(calendar.title),
        source: text(calendar.source.title),
        writable: !!calendar.allowsContentModifications,
        color: color(calendar),
        isDefault: text(calendar.calendarIdentifier) === defaultId,
      });
    }
    const predicate = store.predicateForEventsWithStartDateEndDateCalendars(
      nativeDate(input.start),
      nativeDate(input.end),
      calendars,
    );
    // EventKit expands recurring occurrences within this range; Calendar's scripting API does not.
    const events = store.eventsMatchingPredicate(predicate);
    for (let i = 0; i < Number(events.count); i++) {
      const event = events.objectAtIndex(i);
      if (Number(event.status) === 3) continue;
      result.events.push({
        id: text(event.eventIdentifier),
        title: text(event.title) || "Untitled event",
        calendarId: text(event.calendar.calendarIdentifier),
        start: iso(event.startDate),
        end: iso(event.endDate),
        allDay: !!event.allDay,
        location: text(event.location),
        notes: text(event.notes),
        url: event.URL && !event.URL.isNil() ? text(event.URL.absoluteString) : "",
      });
    }
    return JSON.stringify({ ok: true, ...result });
  } catch {
    // OS errors can contain event contents. Keep diagnostics free of calendar data.
    return JSON.stringify({
      ok: false,
      code: "native",
      error: "Calendar could not complete the request. Check calendar access and refresh.",
    });
  }
};
