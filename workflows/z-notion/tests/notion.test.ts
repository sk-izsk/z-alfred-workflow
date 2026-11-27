import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "nt-test-"));
process.env.alfred_workflow_cache = join(dir, "cache");
process.env.alfred_workflow_data = join(dir, "data");

const nt = await import("../src/notion.ts");
const screens = await import("../src/screens.ts");
const { isAllDay, parseWhen } = await import("../src/format.ts");
const f = await import("./fixtures.ts");

describe("mapping Notion objects", () => {
  test("a database page with its properties", () => {
    const page = nt.pageMapper(f.rawPage);
    expect(page).toMatchObject({ object: "page", title: "Theme Explorer", emoji: "🎨", lastEditedBy: "u1" });
    const byName = Object.fromEntries(page.properties.map((p) => [p.name, p]));
    expect(byName.Status).toMatchObject({ type: "status", option: { name: "Accepted", color: "green" } });
    expect(byName.Reviewers).toMatchObject({ type: "people", ids: ["u2", "u3"] });
    expect(byName.Done).toMatchObject({ type: "checkbox", checked: true });
    expect(byName.Score).toMatchObject({ type: "number", text: "7" });
  });
  test("a data source is a database, titled from its title array", () => {
    const db = nt.pageMapper({ object: "data_source", id: "d", title: [{ plain_text: "Articles" }] });
    expect(db).toMatchObject({ object: "database", title: "Articles", properties: [] });
    expect(nt.pageMapper({ object: "page", id: "x", properties: {} }).title).toBe("Untitled");
  });
});

describe("form values to Notion", () => {
  test("property values", () => {
    expect(nt.propertyValue("select", "acc")).toEqual({ select: { id: "acc" } });
    expect(nt.propertyValue("select", "_none_")).toBeUndefined();
    expect(nt.propertyValue("multi_select", ["a", "b"])).toEqual({
      multi_select: [{ id: "a" }, { id: "b" }],
    });
    expect(nt.propertyValue("people", ["u1"])).toEqual({ people: [{ id: "u1" }] });
    expect(nt.propertyValue("checkbox", false)).toEqual({ checkbox: false });
    expect(nt.propertyValue("number", "4.5")).toEqual({ number: 4.5 });
    expect(nt.propertyValue("number", "four")).toBeUndefined();
    expect(nt.propertyValue("url", "https://example.com")).toEqual({ url: "https://example.com" });
    const title = nt.propertyValue("title", "Hello **world**") as { title: { text: { content: string } }[] };
    expect(title.title.map((t) => t.text.content).join("")).toBe("Hello world");
  });
  test("dates: whole days, or local times with the time zone", () => {
    const day = nt.propertyValue("date", { date: new Date(2026, 9, 12, 12), allDay: true }) as {
      date: { start: string };
    };
    expect(day.date.start).toBe("2026-10-12");
    const timed = nt.propertyValue("date", { date: new Date(2026, 9, 12, 9, 0), allDay: false }) as {
      date: { start: string; time_zone: string };
    };
    expect(timed.date.start).toBe("2026-10-12T09:00:00");
    expect(timed.date.time_zone).toBeTruthy();
    expect(isAllDay("2026-10-12")).toBe(true);
    expect(isAllDay("tomorrow 9:00")).toBe(false);
    expect(isAllDay("6pm")).toBe(false);
    expect(parseWhen("2026-10-12 09:00")?.getHours()).toBe(9);
  });
  test("notes, capture and URLs", () => {
    expect(nt.noteBlock("hi", "todo")).toEqual({
      to_do: { rich_text: [{ type: "text", text: { content: "hi" } }], checked: false },
    });
    expect(nt.noteBlock("x".repeat(4500), "bulleted").bulleted_list_item.rich_text).toHaveLength(3);
    expect(nt.captureContent("https://example.com", "url")).toEqual([
      { type: "bookmark", bookmark: { url: "https://example.com" } },
    ]);
    expect(nt.captureContent("https://example.com", "full", { title: "Ex [1]", text: "Body" })).toBe(
      "[Ex 1](https://example.com)\n\nBody",
    );
    expect(nt.isUrl("https://example.com/a")).toBe(true);
    expect(nt.isUrl("www.example.com")).toBe(true);
    expect(nt.isUrl("not a url")).toBe(false);
  });
});

describe("screens", () => {
  test("rows show icon, title, property tags, editor initials and age", () => {
    const row = screens.pageRow(f.articles[0]!, f.users, ["topic", "state"]);
    expect(row).toMatchObject({
      "pEmoji.text": "📄",
      "pTitle.text": "Safari Link Tracking Protection",
      "t0.text": "Tech",
      "t1.text": "To read",
      "pUser.text": "AM",
      "pWhen.text": "5m",
    });
    expect(row["t2Box.background"]).toBeNull();
    expect(screens.initials("Alex Morgan")).toBe("AM");
  });
  test("a field for every property except formulas, read the right way", () => {
    const specs = screens.fieldSpecs(f.meetingProps);
    expect(specs.map((s) => [s.prop.name, s.read])).toEqual([
      ["Name", "{value:f0.text}"],
      ["Date", "{value:f1.text}"],
      ["Type", "{value:f2.selected.value}"],
      ["Participants", ""],
    ]);
    const people = [
      { id: "u1", name: "Alex Morgan" },
      { id: "u2", name: "Jamie Chen" },
    ];
    expect(screens.multiText(people, ["u1", "u2"])).toBe("Alex Morgan, Jamie Chen  ▾");
  });
  test("metadata pane: last edited, status, people and created by", () => {
    const text = JSON.stringify(screens.metadata(nt.pageMapper(f.rawPage), f.users));
    for (const s of [
      "Last Edited",
      "Accepted",
      "Product",
      "Jamie Chen",
      "Sam Taylor",
      "Created By",
      "Alex Morgan",
    ])
      expect(text).toContain(s);
  });
});
