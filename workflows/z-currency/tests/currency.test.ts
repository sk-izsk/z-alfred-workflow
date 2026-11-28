import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { calculate, parseQuery, validDate } from "../src/expression.ts";
import { parseRates, loadRates } from "../src/api.ts";
import { create, read, save, pin } from "../src/state.ts";
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
    from: "",
  });
  expect(parseQuery("israel").filter).toBe("israel");
  expect(parseQuery("100 in inr")).toMatchObject({ amount: 100, filter: "inr", from: "" });
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

test("typing refreshes amounts without replacing or refocusing the query field", () => {
  const s = create("20");
  s.rates = parseRates(raw, "allratestoday");
  save(s);
  const result = JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "query", s.id, "200"], {
      encoding: "utf8",
      env: process.env,
    }),
  );
  expect(result.update.ids).not.toHaveProperty("root");
  expect(result.update.ids).not.toHaveProperty("query");
  expect(result.update.ids.items.data.src.some((row: any) => row["rowTitle.text"] === "USD  200.00")).toBe(
    true,
  );
});

test("open access includes Bangladesh and other broader currencies without a key", () => {
  const table = parseRates(
    {
      result: "success",
      base_code: "USD",
      time_last_update_utc: "Wed, 25 Nov 2026 00:02:31 +0000",
      rates: { USD: 1, BDT: 124.68, PKR: 280, NPR: 134, LKR: 300 },
    },
    "open-er",
  );
  const s = create("");
  s.rates = table;
  s.amount = 10;
  s.filter = "bangladesh";
  expect(rows(s).map((row) => row.uid)).toEqual(["BDT"]);
  expect(converted(s, "BDT")).toBeCloseTo(1246.8);
});

import { quickBases, baseMatches } from "../src/base-currencies.ts";
test("three configurable quick bases and searchable code/name/country options are local", () => {
  const settings = {
    base_currency: process.env.base_currency,
    secondary_currency: process.env.secondary_currency,
    third_currency: process.env.third_currency,
  };
  process.env.base_currency = "CAD";
  process.env.secondary_currency = "USD";
  process.env.third_currency = "BDT";
  try {
    const s = create("100+24/12");
    s.rates = { ...parseRates(raw, "allratestoday"), rates: { CAD: 1, USD: 0.7, BDT: 80, EUR: 0.6 } };
    s.amount = 102;
    save(s);
    expect(quickBases(s)).toEqual(["CAD", "USD", "BDT"]);
    expect(baseMatches(s, "bangladesh")).toEqual(["BDT"]);
    expect(baseMatches(s, "us dollar")).toEqual(["USD"]);
    const invoke = (command: string, ...args: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), command, s.id, ...args], {
          encoding: "utf8",
          env: process.env,
        }),
      );
    const picker = invoke("base-picker");
    expect(picker.sheet.closeonescape).toBe(true);
    expect(JSON.stringify(picker)).toContain("Search code, currency or country");
    const found = invoke("base-search", "bangladesh");
    expect(found.update.ids.baseItems.data.src.map((r: any) => r.uid)).toEqual(["BDT"]);
    const switched = invoke("base", "USD");
    expect(switched.update.ids.basePicker.text).toContain("USD");
    expect(switched.finish).toBeUndefined();
    const selected = invoke("choose-base", "BDT");
    expect(selected.sheet.close).toBe("baseSheet");
    expect(read(s.id).base).toBe("BDT");
    expect(read(s.id).query).toBe("100+24/12");
    expect(read(s.id).amount).toBe(102);
    expect(JSON.stringify(components(s))).not.toContain('"type":"picker"');
  } finally {
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("quick favorites persist and reject a fourth until one is removed", () => {
  const settings = Object.fromEntries(
    ["base_currency", "secondary_currency", "third_currency"].map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, { base_currency: "CAD", secondary_currency: "USD", third_currency: "BDT" });
  const favoriteFile = join(dir, "data", "quick-favorites.json");
  rmSync(favoriteFile, { force: true });
  try {
    const s = create("42");
    s.rates = { ...parseRates(raw, "allratestoday"), rates: { CAD: 1, USD: 0.7, BDT: 80, EUR: 0.6 } };
    save(s);
    const invoke = (command: string, code: string, search = "") =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [join(import.meta.dir, "../src/main.ts"), command, s.id, code, search],
          {
            encoding: "utf8",
            env: process.env,
          },
        ),
      );
    const warning = invoke("favorite", "EUR");
    expect(JSON.stringify(warning)).toContain("Remove one quick favorite");
    expect(warning.sheet.closeonescape).toBe(true);
    expect(quickBases(s)).toEqual(["CAD", "USD", "BDT"]);
    expect(JSON.stringify(invoke("menu", "BDT"))).toContain("Remove Quick Favorite");
    invoke("favorite", "BDT");
    expect(quickBases(s)).toEqual(["CAD", "USD"]);
    expect(JSON.stringify(invoke("menu", "EUR"))).toContain("Add Quick Favorite");
    const updated = invoke("favorite", "EUR");
    expect(quickBases(s)).toEqual(["CAD", "USD", "EUR"]);
    expect(JSON.stringify(updated)).toContain("★ EUR");
    expect(JSON.stringify(invoke("favorite", "BDT"))).toContain("Remove one quick favorite");
    expect(quickBases(s)).toEqual(["CAD", "USD", "EUR"]);
    const picker = invoke("base-picker", "");
    expect(JSON.stringify(picker)).toContain('"baseFavorite"');
    const blocked = invoke("base-favorite", "BDT");
    expect(blocked.update.ids.baseNotice.text).toContain("Remove one ★");
    expect(blocked.sheet).toBeUndefined();
    const removed = invoke("base-favorite", "EUR", "eur");
    expect(removed.update.ids.baseItems.data.src.map((r: any) => r.uid)).toEqual(["EUR"]);
    expect(removed.update.ids.baseItems.data.src[0]["baseFavorite.text"]).toBe("☆");
    const added = invoke("base-favorite", "EUR", "eur");
    expect(added.update.ids.baseItems.data.src[0]["baseFavorite.text"]).toBe("★");
    expect(added.update.ids.quickBaseButtons.components).toHaveLength(3);
    expect(added.update.ids).not.toHaveProperty("root");
    expect(added.update.ids).not.toHaveProperty("baseSearch");
    expect(added.sheet).toBeUndefined();
    expect(read(s.id).query).toBe("42");
  } finally {
    rmSync(favoriteFile, { force: true });
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

/** Amount, source currency and filter of a query. */
const q = (text: string) => {
  const { amount, filter, from } = parseQuery(text);
  return [amount, from, filter];
};
test("natural language: the amount's currency, then what to show", () => {
  expect(q("100 euros in cad")).toEqual([100, "EUR", "cad"]);
  expect(q("€100 to usd")).toEqual([100, "EUR", "usd"]);
  expect(q("100€")).toEqual([100, "EUR", ""]);
  expect(q("C$ 20 in usd")).toEqual([20, "CAD", "usd"]);
  expect(q("convert 2.5k yen to cad")).toEqual([2500, "JPY", "cad"]);
  expect(q("1,250 pounds")).toEqual([1250, "GBP", ""]);
  expect(q("cad to inr")).toEqual([1, "CAD", "inr"]);
  expect(q("how much is 20 bucks in rupees?")).toEqual([20, "USD", "inr"]);
  expect(q("50 swiss francs to eur")).toEqual([50, "CHF", "eur"]);
  expect(q("100 euros in canadian dollars")).toEqual([100, "EUR", "cad"]);
  // Countries and plain filters behave as before.
  expect(q("100 canada")).toEqual([100, "", "canada"]);
  expect(q("10 in japan")).toEqual([10, "", "japan"]);
});
test("a query's currency converts from it instead of the base", () => {
  const rates = {
    date: "2026-11-24",
    asof: "2026-11-24",
    provider: "test",
    fetched: 0,
    stale: false,
    rates: { EUR: 1, USD: 2, CAD: 3 },
  };
  const s = { base: "CAD", from: "EUR", amount: 100, rates } as unknown as Parameters<typeof converted>[0];
  expect(converted(s, "CAD")).toBe(300);
  expect(converted({ ...s, from: "" }, "USD")).toBeCloseTo(66.6667, 3);
});
