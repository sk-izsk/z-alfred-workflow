import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clock,
  formatTime,
  localDate,
  shiftDate,
  parseMonth,
  prayerInstant,
  nextPrayer,
  countdown,
  type Day,
} from "../src/model.ts";
import { calendar, validate } from "../src/api.ts";
import { methods } from "../src/methods.ts";
import { components, next } from "../ui/window.ts";
import { create, save } from "../src/state.ts";
import { execFileSync } from "node:child_process";
const temp = mkdtempSync(join(tmpdir(), "adhan-tests-"));
const previous = process.env.alfred_workflow_cache;
const previousData = process.env.alfred_workflow_data;
process.env.alfred_workflow_data = join(temp, "data");
process.env.alfred_workflow_cache = temp;
afterAll(() => {
  if (previousData === undefined) delete process.env.alfred_workflow_data;
  else process.env.alfred_workflow_data = previousData;
  if (previous === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = previous;
  rmSync(temp, { recursive: true, force: true });
});
const day: Day = {
  date: "2026-11-25",
  hijri: "15 Jumada 1448 AH",
  timezone: "America/Toronto",
  method: "ISNA",
  school: "STANDARD",
  times: { Fajr: "06:00", Sunrise: "07:24", Dhuhr: "12:05", Asr: "14:26", Maghrib: "16:45", Isha: "18:09" },
};
const raw = {
  code: 200,
  data: [
    {
      date: { gregorian: { year: "2026", month: { number: 11 }, day: "25" } },
      meta: { timezone: day.timezone, method: { name: "ISNA" }, school: "STANDARD" },
      timings: Object.fromEntries(Object.entries(day.times).map(([k, v]) => [k, `${v} (EST)`])),
    },
  ],
};
const config = { city: "Example", country: "Canada", method: "2", school: "0", twelve: true };
describe("city-local prayer time calculations", () => {
  test("strips provider zone suffixes and preserves missing times", () => {
    expect(clock("06:00 (EST)")).toBe("06:00");
    expect(clock("24:15")).toBe("—");
    expect(clock(null)).toBe("—");
    expect(formatTime("00:05", true)).toBe("12:05 AM");
    expect(formatTime("13:05", true)).toBe("1:05 PM");
  });
  test("validates provider timezone, dates and required prayer data", () => {
    expect(parseMonth(raw)[0]?.date).toBe(day.date);
    expect(() => parseMonth({ code: 200, data: [] })).toThrow();
    expect(() => parseMonth({ code: 200, data: [{ ...raw.data[0], timings: {} }] })).toThrow();
  });
  test("uses city timezone independently of the Mac and handles DST", () => {
    expect(prayerInstant(day, "06:00")).toBe(Date.parse("2026-11-25T11:00Z"));
    expect(prayerInstant({ ...day, date: "2026-07-25" }, "06:00")).toBe(Date.parse("2026-07-25T10:00Z"));
    expect(localDate(Date.parse("2026-11-25T02:00Z"), day.timezone)).toBe("2026-11-24");
  });
  test("sunrise is not a next prayer and after Isha selects tomorrow Fajr", () => {
    expect(nextPrayer([day], Date.parse("2026-11-25T11:01Z"))?.name).toBe("Dhuhr");
    const tomorrow = { ...day, date: "2026-11-26" };
    expect(nextPrayer([day, tomorrow], Date.parse("2026-11-26T01:00Z"))).toMatchObject({
      name: "Fajr",
      day: { date: "2026-11-26" },
    });
  });
  test("missing future calendar yields unavailable, never yesterday Fajr", () => {
    expect(nextPrayer([day], Date.parse("2026-11-26T01:00Z"))).toBeNull();
    expect(countdown(120001, 0)).toBe("0h 3m");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
  test("method labels use verified provider identifiers", () => {
    expect(methods.find(([name]) => name === "Muslim World League")?.[1]).toBe("3");
    expect(methods.find(([name]) => name.includes("Karachi"))?.[1]).toBe("1");
    expect(() => validate({ ...config, method: "99" })).toThrow();
    expect(() => validate({ ...config, city: "" })).toThrow();
  });
});
describe("calendar cache and UI", () => {
  test("cache fallback is marked and retains its original timestamp", async () => {
    const old = globalThis.fetch;
    try {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        return new Response(JSON.stringify(raw));
      }) as unknown as typeof fetch;
      const first = await calendar(config, day.date);
      await calendar(config, day.date);
      expect(calls).toBe(1);
      globalThis.fetch = (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch;
      expect(await calendar(config, day.date, true)).toMatchObject({ stale: true, fetched: first.fetched });
      await expect(calendar({ ...config, city: "Never cached" }, day.date, true)).rejects.toThrow();
    } finally {
      globalThis.fetch = old;
    }
  });
  test("browsing another month retains actual next prayer from current calendar", () => {
    const s = create();
    s.month = { days: [{ ...day, date: "2026-12-01" }], fetched: 1, stale: false };
    s.liveMonth = { days: [day], fetched: 1, stale: false };
    expect(next(s, Date.parse("2026-11-25T11:01Z"))?.name).toBe("Dhuhr");
  });
  test("native UI IDs are unique and Back remains outside Actions", () => {
    const s = create();
    s.settings = config;
    s.month = { days: [day], fetched: 1, stale: false };
    s.date = day.date;
    const tree = components(s),
      ids: string[] = [];
    const visit = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(visit);
        return;
      }
      const o = v as Record<string, unknown>;
      if (typeof o.id === "string") ids.push(o.id);
      Object.values(o).forEach(visit);
    };
    visit(tree);
    expect(ids.length).toBe(new Set(ids).size);
    expect(ids).toContain("back");
    save(s);
    const invoke = (cmd: string) =>
      JSON.parse(
        execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, s.id], {
          encoding: "utf8",
          env: { ...process.env, alfred_workflow_cache: temp },
        }),
      );
    expect(invoke("back").finish.variables.adhan_out).toBe("back");
    expect(invoke("menu").popupmenu.menu.some((m: { text: string }) => m.text.startsWith("Back"))).toBe(
      false,
    );
  });
});

test("Ramadan keeps actual Hijri month length, dates and Imsak separate from Fajr", async () => {
  const { parseRamadan, ramadanText } = await import("../src/ramadan.ts");
  const data = Array.from({ length: 29 }, (_, i) => {
    const date = new Date(Date.UTC(2027, 1, 8 + i));
    return {
      ...raw.data[0],
      date: {
        gregorian: {
          year: String(date.getUTCFullYear()),
          month: { number: date.getUTCMonth() + 1 },
          day: String(date.getUTCDate()),
        },
        hijri: { year: "1448", month: { number: 9, en: "Ramadan" }, day: String(i + 1) },
      },
      timings: { ...raw.data[0]!.timings, Imsak: "05:50 (EST)" },
    };
  });
  const days = parseRamadan({ code: 200, data }, 1448);
  expect(days).toHaveLength(29);
  expect(days[0]?.times.Imsak).toBe("05:50");
  expect(days.at(-1)?.date).toBe("2027-03-08");
  expect(() => parseRamadan({ code: 200, data: data.slice(0, 28) }, 1448)).toThrow();
  expect(() => parseRamadan({ code: 200, data }, 1449)).toThrow();
  expect(ramadanText(config, 1448, { days, fetched: 1, stale: false })).toContain("Fajr (fast begins)");
});
