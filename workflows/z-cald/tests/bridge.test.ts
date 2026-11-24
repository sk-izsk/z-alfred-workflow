import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const ns = (value: string) => ({ value, isNil: () => false });

const array = (items: unknown[]) => ({ count: items.length, objectAtIndex: (i: number) => items[i] });

/** Exercise the actual shipped JXA handler with a tiny EventKit fake; never touch real calendars. */
const invoke = (input: object, status = 3, writable = true) => {
  const calendar = {
    isNil: () => false,
    calendarIdentifier: ns("work"),
    title: ns("Calendar"),
    source: { title: ns("Work") },
    allowsContentModifications: writable,
  };
  const event = { eventIdentifier: ns("created-id") };
  let saved = 0;
  const store = {
    calendarsForEntityType: () => array([calendar]),
    calendarWithIdentifier: () => calendar,
    defaultCalendarForNewEvents: calendar,
    saveEventSpanCommitError: () => {
      saved++;
      return true;
    },
    predicateForEventsWithStartDateEndDateCalendars: () => ({}),
    eventsMatchingPredicate: () => array([]),
  };
  const context = {
    ObjC: {
      import: () => {},
      unwrap: (value: { value: string } | string) => (typeof value === "string" ? value : value.value),
    },
    Ref: () => ({}),
    console,
    $: {
      EKEventStore: { alloc: { init: store }, authorizationStatusForEntityType: () => status },
      EKEvent: { eventWithEventStore: () => event },
      NSUTF8StringEncoding: 4,
      NSFileHandle: { fileHandleWithStandardInput: { readDataToEndOfFile: JSON.stringify(input) } },
      NSString: { alloc: { initWithDataEncoding: (value: string) => value } },
      NSDate: { dateWithTimeIntervalSince1970: (value: number) => ({ timeIntervalSince1970: value }) },
      NSTimeZone: { localTimeZone: "local" },
      NSURL: { URLWithString: (value: string) => value },
    },
  };
  const output = runInNewContext(
    readFileSync(new URL("../scripts/eventkit.js", import.meta.url), "utf8") + "\nrun();",
    context,
  );
  return { result: JSON.parse(output), saved, event: event as Record<string, unknown> };
};

test("permission denial is an actionable error, not an empty calendar", () => {
  const { result, saved } = invoke({ command: "snapshot" }, 2);
  expect(result.ok).toBe(false);
  expect(result.code).toBe("permission");
  expect(saved).toBe(0);
});

test("the bridge validates ranges and returns calendar source metadata", () => {
  expect(invoke({ command: "snapshot", start: "bad", end: "bad" }).result.ok).toBe(false);
  const { result } = invoke({
    command: "snapshot",
    start: "2026-11-24T00:00:00Z",
    end: "2026-11-25T00:00:00Z",
  });
  expect(result.ok).toBe(true);
  expect(result.calendars[0]).toMatchObject({ id: "work", source: "Work", writable: true, isDefault: true });
});

test("creating an event saves into the chosen writable calendar once, preserving dates and URL", () => {
  const draft = {
    title: "Test",
    calendarId: "work",
    start: "2026-11-24T14:00:00Z",
    end: "2026-11-24T14:30:00Z",
    url: "https://meet.google.com/abc-defg-hij",
    allDay: false,
  };
  const { result, saved, event } = invoke({ command: "create", event: draft });
  expect(result).toMatchObject({ ok: true, id: "created-id" });
  expect(saved).toBe(1);
  expect(event.URL).toBe(draft.url);
  expect(invoke({ command: "create", event: draft }, 3, false).saved).toBe(0);
  expect(invoke({ command: "create", event: { ...draft, end: draft.start } }).saved).toBe(0);
  expect(invoke({ command: "create", event: { ...draft, url: "file:///tmp/x" } }).saved).toBe(0);
});
