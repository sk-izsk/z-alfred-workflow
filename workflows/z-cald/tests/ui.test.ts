import { expect, test } from "bun:test";
import { compactDays, quickTable } from "../ui/quick-table.ts";
import { footer, hiddenKey, button } from "../ui/shared.ts";
import { packages } from "../ui/index.ts";
import { infoPlist } from "../scripts/plist.ts";
import { calendarMarkdown, quick } from "../src/commands/quick.ts";
import { createInit, formFromEnv } from "../src/commands/create.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("filter commands preserve row data while changing the empty-state text", () => {
  const cache = mkdtempSync(join(tmpdir(), "cald-filter-test-"));
  try {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `
      import {saveSnapshot} from "./src/calendar.ts";
      import {agendaFilter} from "./src/commands/agenda.ts";
      const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString();
      saveSnapshot({calendars:[],events:[
        {id:"a",uid:"a",title:"Video meeting",calendarId:"work",start,end,allDay:false,location:"",links:[{provider:"Zoom",url:"https://zoom.us/j/123"}]},
        {id:"b",uid:"b",title:"In-person meeting",calendarId:"work",start,end,allDay:false,location:"",links:[]},
        {id:"c",uid:"c",title:"Holiday",calendarId:"work",start,end,allDay:true,location:"",links:[]}
      ]});
      const counts=[];
      for(const mode of ["meetings","timed","all"]){
        const action=await agendaFilter(["",mode]);
        counts.push(action.update.ids.items.data.src.length);
        if(!action.update.ids.items.placeholder)throw new Error("Missing empty-state text");
      }
      console.log(JSON.stringify(counts));
    `,
      ],
      { cwd: import.meta.dir + "/..", env: { ...process.env, alfred_workflow_cache: cache } },
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual([1, 2, 3]);
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test("quick calendar selects a date and handles month/year navigation without calendar access", async () => {
  const initial = await quick(["init", "2024-02"]);
  expect(initial.variables).toMatchObject({
    cal_month: "2024-02-01",
    cal_selected: "2024-02-01",
    cal_preview: "",
  });
  const table = (initial.replace as { ids: Record<string, any> }).ids.calendarTable;
  expect(table.rows).toBe(6);
  expect(table.cols).toBe(8);
  expect(table.components).toHaveLength(48);
  const next = await quick(["shift", "12"]);
  expect(next.variables).toBeDefined();
  await expect(quick(["shift", "99"])).rejects.toThrow("Invalid");
  expect((await quick(["agenda", "2026-12-01"])).finish).toEqual({
    args: "",
    variables: { cal_out: "agenda", cal_day: "2026-12-01" },
  });
});

test("form initializes offline and keeps form values in environment rather than argv", async () => {
  const result = await createInit(["Team sync"]);
  expect((result.update as { ids: Record<string, any> }).ids.titleField.text).toBe("Team sync");
  const form = formFromEnv({
    cal_title: "Private title",
    cal_meeting_url: "https://meet.google.com/abc-defg-hij",
    cal_all_day: "true",
  });
  expect(form.title).toBe("Private title");
  expect(form.allDay).toBe(true);
  const serialized = JSON.stringify(packages["create.alfredui"]);
  expect(serialized).toContain('"scriptenv":true');
  expect(serialized).not.toContain('"args":["create-save","{value:');
});

test("windows have unique component IDs, valid local scripts and configured keywords", () => {
  for (const window of Object.values(packages)) {
    const ids = new Set<string>();
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach(walk);
      const object = value as Record<string, unknown>;
      if (typeof object.type === "string" && typeof object.id === "string") {
        expect(ids.has(object.id)).toBe(false);
        ids.add(object.id);
      }
      if (object.type === "script") expect(object.src).toBe("../bin/cald");
      Object.values(object).forEach(walk);
    };
    walk(window);
    expect(ids.has("statusLabel")).toBe(true);
    expect(ids.has("backButton")).toBe(true);
  }
  const keywords = infoPlist.userconfigurationconfig.filter((v) => String(v.variable).startsWith("kw_"));
  expect(keywords).toHaveLength(4);
  for (const config of infoPlist.userconfigurationconfig.filter((v) => v.type === "popupbutton"))
    expect((config.config as { pairs: unknown[] }).pairs.length).toBeGreaterThan(0);
  const objects = infoPlist.objects as { uid: string; type: string; config: Record<string, unknown> }[];
  expect(objects.filter((o) => o.type === "alfred.workflow.trigger.external")).toHaveLength(3);
  expect(objects.filter((o) => o.type === "alfred.workflow.userinterface.alfredui")).toHaveLength(3);
});

test("compact calendar uses only the required weeks and copies the displayed table", async () => {
  expect(compactDays(new Date(2021, 1, 1), 1)).toHaveLength(28);
  expect(compactDays(new Date(2024, 0, 1), 1)).toHaveLength(35);
  expect(compactDays(new Date(2026, 10, 1), 1)).toHaveLength(42);
  const table = quickTable(new Date(2024, 0, 1), 1, false, "2024-01-01");
  expect(table.cols).toBe(7);
  expect(table.components as unknown[]).toHaveLength(42);
  const text = calendarMarkdown(new Date(2024, 0, 1), 1, true, new Date(2024, 0, 31));
  expect(text).toContain("# January 2024");
  expect(text).toContain("| # | Mon | Tue | Wed | Thu | Fri | Sat | Sun |");
  expect(text).toContain("• 31");
  expect(text.trim().split("\n")).toHaveLength(9);
  const menu = (await quick(["menu"])).popupmenu as { menu: { text?: string }[] };
  expect(menu.menu.map((item) => item.text?.split("\t")[0]).filter(Boolean)).toEqual([
    "Current Month",
    "Copy Calendar to Clipboard",
    "Previous Month",
    "Next Month",
    "Previous Year",
    "Next Year",
    "Selected Date",
  ]);
});

test("hidden shortcuts do not consume inline footer spacing", () => {
  const result = footer([button("action", "Actions", {}), hiddenKey("shortcut", "⌘X", {})], true);
  const layers = result.components as Record<string, any>[];
  expect(result.layout).toBe("stack");
  expect(layers[1]?.id).toBe("shortcut");
  expect(layers[0]?.padding).toBe(14);
  expect(layers[0]?.components[1].components.map((item: any) => item.id)).toEqual(["action"]);
});
