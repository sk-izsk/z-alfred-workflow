import { emptyPreview, previewPanel, previewTitle } from "../ui/quick-preview.ts";
import { expect, test } from "bun:test";
import { previewEvent, previewJoin, titleFrame } from "../src/commands/preview.ts";
import { type CalendarEvent, type Snapshot } from "../src/model.ts";

const meeting = (id: string, day: string, hour: number, links = true): CalendarEvent => ({
  id,
  uid: id,
  title: id,
  calendarId: "work",
  start: `${day}T${String(hour).padStart(2, "0")}:00:00Z`,
  end: `${day}T${String(hour + 1).padStart(2, "0")}:00:00Z`,
  allDay: false,
  location: "",
  links: links ? [{ provider: "Google Meet", url: "https://meet.google.com/abc-defg-hij" }] : [],
});

test("day preview selects ongoing/next meetings today and the most recent on past days", () => {
  const now = new Date("2026-11-24T16:30:00Z");
  const snapshot: Snapshot = {
    calendars: [],
    events: [
      meeting("morning", "2026-11-24", 14),
      meeting("ongoing", "2026-11-24", 16),
      meeting("next", "2026-11-24", 18),
      meeting("no-link", "2026-11-24", 17, false),
    ],
  };
  expect(previewEvent(snapshot, "2026-11-24", now)?.id).toBe("ongoing");
  expect(
    previewEvent(
      { ...snapshot, events: snapshot.events.filter((e) => e.id !== "ongoing") },
      "2026-11-24",
      now,
    )?.id,
  ).toBe("next");
  expect(previewEvent(snapshot, "2026-11-24", new Date("2026-11-25T16:00:00Z"))?.id).toBe("next");
  expect(previewEvent(snapshot, "2026-11-26", now)).toBeUndefined();
});

test("long titles remain native labels with ellipsis and bounded scrolling", () => {
  const title =
    '<script>alert("bad")</script> & a very long meeting title that continues beyond the visible viewport';
  const label = previewTitle(title);
  expect(label.type).toBe("label");
  expect(label.text).toBe(title);
  expect(label.colour).toBe("labelColor");
  expect(label.linebreak).toBe("truncatetail");
  expect(label.background).toBeUndefined();
  expect(titleFrame(title, 0)).toBe(title);
  expect(titleFrame(title, 2800)).toBe(`…${Array.from(title).slice(1).join("")}`);
  expect(titleFrame("Short title", 9999)).toBe("Short title");
});

test("preview join ignores stale dates and revalidates URLs", async () => {
  const previous = { day: process.env.cal_selected, preview: process.env.cal_preview };
  try {
    process.env.cal_selected = "2026-11-24";
    process.env.cal_preview = JSON.stringify({
      day: "2026-11-23",
      links: [{ url: "https://meet.google.com/abc-defg-hij" }],
    });
    expect(await previewJoin([])).toEqual({});
    process.env.cal_preview = JSON.stringify({
      day: "2026-11-24",
      links: [{ url: "https://meet.google.com/abc-defg-hij" }],
    });
    expect((await previewJoin([])).open).toEqual({
      type: "url",
      src: "https://meet.google.com/abc-defg-hij",
    });
    process.env.cal_preview = JSON.stringify({ day: "2026-11-24", links: [{ url: "javascript:alert(1)" }] });
    expect((await previewJoin([])).open).toBeUndefined();
  } finally {
    if (previous.day === undefined) delete process.env.cal_selected;
    else process.env.cal_selected = previous.day;
    if (previous.preview === undefined) delete process.env.cal_preview;
    else process.env.cal_preview = previous.preview;
  }
});

test("empty days have no preview controls or empty-state card", () => {
  const empty = emptyPreview();
  expect(empty.components).toEqual([]);
  expect((empty.constraints as any).size.height).toBe(0);
  const populated = previewPanel("Meeting", "12:30 PM", "Google Meet", true);
  expect((populated.components as any[]).at(-1).text).toBe("Join  ⌘J");
  expect(populated.background).toBeNull();
  expect(populated.border).toEqual({ width: 1, colour: "separatorColor" });
});

test("rapid date changes cancel old preview reads before reaching EventKit", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "cald-preview-test-"));
  try {
    const child = Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `
      import {mock} from "bun:test";
      let reads=0;
      mock.module("./src/calendar.ts",()=>({bridge:async()=>{reads++;return {calendars:[],events:[]}}}));
      const {previewLoad,previewCleanup}=await import("./src/commands/preview.ts");
      const first=previewLoad(["2026-11-24"]);
      await new Promise(r=>setTimeout(r,30));
      const second=previewLoad(["2026-11-25"]);
      const result=await Promise.all([first,second]);
      await previewCleanup();
      console.log(JSON.stringify({reads,first:result[0],second:result[1].replace.ids.dayPreview.components}));
    `,
      ],
      {
        cwd: import.meta.dir + "/..",
        env: {
          ...process.env,
          cal_window: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          alfred_workflow_cache: directory,
        },
      },
    );
    expect(child.exitCode).toBe(0);
    expect(JSON.parse(child.stdout.toString())).toEqual({ reads: 1, first: {}, second: [] });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
