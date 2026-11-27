import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "sw-test-"));
process.env.alfred_workflow_cache = join(dir, "cache");
process.env.alfred_workflow_data = join(dir, "data");

const api = await import("../src/api.ts");
const { parseWhen, ago, money, fieldDate } = await import("../src/format.ts");
const screens = await import("../src/screens.ts");
const fixtures = await import("./fixtures.ts");

describe("split rules", () => {
  test("friend expense: you pay, half each, cents exact", () => {
    expect(api.friendSplit("10.01", 1, 2)).toMatchObject({
      users__0__paid_share: "10.01",
      users__0__owed_share: "5.01",
      users__1__owed_share: "5.00",
    });
  });
  test("equal split adds up to the cost exactly", () => {
    const params = api.equalSplit("10.00", 1, [1, 2, 3]);
    const owed = [0, 1, 2].map((i) => Number(params[`users__${i}__owed_share`]));
    expect(owed.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 5);
    expect(params.users__0__owed_share).toBe("3.34");
    expect(params.users__0__paid_share).toBe("10.00");
  });
  test("payer who doesn't owe", () => {
    expect(api.equalSplit("9.00", 1, [2, 3])).toMatchObject({
      users__0__owed_share: "0.00",
      users__1__owed_share: "4.50",
      users__2__owed_share: "4.50",
    });
  });
  test("only single-payer equal splits are editable", () => {
    expect(api.isEditable(fixtures.expenses[0]!)).toBe(true);
    expect(api.isEditable(fixtures.unequal)).toBe(false);
    expect(api.validCost("10.5")).toBe(true);
    expect(api.validCost("10.555")).toBe(false);
    expect(api.validCost("abc")).toBe(false);
  });
  test("validation errors arrive as text", () => {
    expect(api.errorText({ base: ["Total cost must equal shares"] })).toBe("Total cost must equal shares");
    expect(api.errorText({ cost: "is invalid" })).toBe("cost: is invalid");
    expect(api.errorText({})).toBeUndefined();
  });
});

describe("requests (mocked network)", () => {
  test("create_expense posts JSON with the bearer key and reports errors", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    api.setFetcher(async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ expenses: [], errors: { base: ["Invalid cost"] } }));
    });
    await expect(api.createExpense("k", { cost: "1.00" })).rejects.toThrow("Invalid cost");
    expect(seen?.url).toBe("https://secure.splitwise.com/api/v3.0/create_expense");
    const headers = (seen?.init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
    expect(seen?.init.method).toBe("POST");
  });
  test("401 means a rejected key", async () => {
    api.setFetcher(async () => new Response("{}", { status: 401 }));
    await expect(api.currentUser("bad")).rejects.toBeInstanceOf(api.AuthError);
  });
});

describe("formatting", () => {
  const now = new Date(2026, 0, 4, 15, 0);
  test("typed dates", () => {
    expect(fieldDate(parseWhen("2026-01-04 12:00", now)!)).toBe("2026-01-04 12:00");
    expect(fieldDate(parseWhen("yesterday 18:30", now)!)).toBe("2026-01-03 18:30");
    expect(fieldDate(parseWhen("tomorrow", now)!)).toBe("2026-01-05 12:00");
    expect(fieldDate(parseWhen("-1w", now)!)).toBe("2025-12-28 12:00");
    expect(fieldDate(parseWhen("6pm", now)!)).toBe("2026-01-04 18:00");
    expect(parseWhen("2026-02-30", now)).toBeUndefined();
    expect(parseWhen("soon", now)).toBeUndefined();
  });
  test("money and ages", () => {
    expect(money("10", "EUR")).toBe("10.00 €");
    expect(money("3.5", "SEK")).toBe("3.50 SEK");
    expect(ago("2026-01-04T10:00:00Z", Date.parse("2026-01-04T10:38:00Z"))).toBe("38m");
    expect(ago("2026-01-01T10:00:00Z", Date.parse("2026-01-04T10:00:00Z"))).toBe("3d");
  });
});

describe("screens", () => {
  test("Recent holds the three latest, then friends and groups without repeats", () => {
    const rows = screens.peopleRows(fixtures.friends, fixtures.groups);
    const uids = rows.map((r) => r.uid);
    expect(uids[0]).toBe("h-Recent");
    expect(uids.slice(1, 4)).toEqual(["f-2", "g-10", "f-3"]);
    expect(uids).toContain("h-Friends");
    expect(new Set(uids).size).toBe(uids.length);
    expect(rows.find((r) => r.uid === "f-2")?.["pBal.text"]).toBe("15.00 €");
  });
  test("categories offer subcategories", () => {
    expect(screens.categoryItems(fixtures.categories)).toEqual([
      { text: "Food and drink › Dining out", value: "13" },
      { text: "General", value: "18" },
    ]);
  });
  test("detail pane: paid by and owed by", () => {
    const view = JSON.stringify(screens.detailView(fixtures.expenses[0], 1, fixtures.groups));
    expect(view).toContain("Alex paid 10.00 € and owes 5.00 €");
    expect(view).toContain("Robin owes 5.00 €");
    expect(view).toContain("Open 'Funkytown'");
  });
});
