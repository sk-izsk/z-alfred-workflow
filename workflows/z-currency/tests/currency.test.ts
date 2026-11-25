import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { calculate, parseQuery, validDate } from "../src/expression.ts";
import { parseRates, loadRates } from "../src/api.ts";
import { create, save, pin } from "../src/state.ts";
import { converted, rows, components } from "../ui/window.ts";
const dir = mkdtempSync(join(tmpdir(), "currency-tests-")),
  previous = { ...process.env };
process.env.alfred_workflow_cache = join(dir, "cache");
process.env.alfred_workflow_data = join(dir, "data");
process.env.provider = "allratestoday";
afterAll(() => {
  for (const k of ["alfred_workflow_cache", "alfred_workflow_data", "provider"]) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
  rmSync(dir, { recursive: true, force: true });
});
const raw = {
  rate_date: "2026-11-24",
  rates: [
    { base: "EUR", quote: "USD", value: 2 },
    { base: "EUR", quote: "CAD", value: 3 },
  ],
};
test("arithmetic precedence, exponents and percentages without eval", () => {
  expect(calculate("100+24/12")).toBe(102);
  expect(calculate("2^3^2")).toBe(512);
  expect(calculate("-2^2")).toBe(-4);
  expect(calculate("(100 + 20)*50%")).toBe(60);
  for (const bad of ["process.exit()", "1/0", "2..3", "2+", "(".repeat(80) + "1" + ")".repeat(80)])
    expect(() => calculate(bad)).toThrow();
});
test("query separates arithmetic, country filter and historical date", () => {
  expect(parseQuery("100+24/12 in Canada at 2021/9/25")).toEqual({
    amount: 102,
    filter: "canada",
    date: "2021-09-25",
  });
  expect(parseQuery("israel").filter).toBe("israel");
  expect(() => validDate("2026-02-30")).toThrow();
});
test("rate parsing rejects missing dates and invalid rates", () => {
  const parsed = parseRates(
    { ...raw, rates: [...raw.rates, { base: "EUR", quote: "GBP", value: null }] },
    "allratestoday",
  );
  expect(parsed.rates).toEqual({ EUR: 1, USD: 2, CAD: 3 });
  expect(parsed.asof).toBe("2026-11-24");
  expect(() => parseRates({ ...raw, rate_date: null }, "allratestoday")).toThrow();
});
test("historical tables must verify requested date", () => {
  expect(() =>
    parseRates({ conversion_rates: { USD: 1, CAD: 2 }, base_code: "USD" }, "exchangerate-api", "2021-09-25"),
  ).toThrow();
  expect(
    parseRates(
      { conversion_rates: { USD: 1, CAD: 2 }, base_code: "USD", year: 2021, month: 9, day: 25 },
      "exchangerate-api",
      "2021-09-25",
    ).date,
  ).toBe("2021-09-25");
});
test("conversion cross-rates, filtering and pin order are local", () => {
  const s = create("");
  s.rates = parseRates(raw, "allratestoday");
  s.amount = 100;
  s.base = "USD";
  expect(converted(s, "CAD")).toBe(150);
  s.filter = "canada";
  expect(rows(s).map((r) => r.uid)).toEqual(["CAD"]);
  s.filter = "";
  pin("EUR");
  expect(rows(s)[0]?.uid).toBe("CAD");
  expect(() => converted(s, "GBP")).toThrow();
});
test("cache fallback stays stale and no-key history is rejected", async () => {
  const old = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify(raw));
    }) as unknown as typeof fetch;
    const a = await loadRates();
    await loadRates();
    expect(calls).toBe(1);
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await loadRates("", true)).toMatchObject({ fetched: a.fetched, stale: true });
    await expect(loadRates("2021-09-25")).rejects.toThrow("no history");
  } finally {
    globalThis.fetch = old;
  }
});
test("native IDs, footer Back, date sheet and screenshot Actions", () => {
  const s = create("");
  s.rates = parseRates(raw, "allratestoday");
  save(s);
  const ids: string[] = [];
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
  visit(components(s));
  expect(new Set(ids).size).toBe(ids.length);
  const invoke = (cmd: string) =>
    JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, s.id, "CAD"], {
        encoding: "utf8",
        env: process.env,
      }),
    );
  expect(invoke("back").finish.variables.fx_out).toBe("back");
  const menu = invoke("menu").popupmenu.menu.map((m: { text: string }) => m.text);
  for (const expected of ["Copy to Clipboard", "Unpin Currency", "Set Currency Date…"])
    expect(menu.some((text: string) => text.startsWith(expected))).toBe(true);
  expect(JSON.stringify(invoke("date"))).toContain("dateSheetBack");
});
