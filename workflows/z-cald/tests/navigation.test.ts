import { expect, test } from "bun:test";
import { back, contextFor, decodeContext, forward, restoreContext } from "../src/navigation.ts";
import { quick } from "../src/commands/quick.ts";
import { sheet } from "../src/ui.ts";

test("Calendar returns through create, agenda and quick calendar with its date and filters", async () => {
  const before = { ...process.env };
  try {
    Object.assign(process.env, {
      cal_navigation: "[]",
      cal_query: "2027-02-18",
      cal_month: "2027-02-01",
      cal_selected: "2027-02-18",
    });
    const toAgenda = forward("quick", "agenda", "2027-02-18").finish as any;
    Object.assign(process.env, toAgenda.variables);
    Object.assign(process.env, restoreContext(contextFor("agenda", "2027-02-18")), {
      cal_filter: "calendar-demo",
      cal_view: "all",
      cal_search: "sync",
      cal_item: "event-demo",
    });
    const toCreate = forward("agenda", "create", "2027-02-18").finish as any;
    Object.assign(process.env, toCreate.variables);
    Object.assign(process.env, restoreContext(contextFor("create", "2027-02-18")));
    const toPrevious = back().finish as any;
    expect(toPrevious.variables.cal_out).toBe("return");
    const agenda = decodeContext(toPrevious.variables.cal_return)!;
    expect(agenda.screen.type).toBe("agenda");
    expect(agenda.screen.values).toMatchObject({
      cal_day: "2027-02-18",
      cal_filter: "calendar-demo",
      cal_view: "all",
      cal_search: "sync",
      cal_item: "event-demo",
    });
    Object.assign(process.env, restoreContext(toPrevious.variables.cal_return));
    const toQuick = back().finish as any;
    const calendar = decodeContext(toQuick.variables.cal_return)!;
    expect(calendar.screen.type).toBe("quick");
    Object.assign(process.env, restoreContext(toQuick.variables.cal_return));
    const restored = await quick(["init", process.env.cal_query!]);
    expect(restored.variables).toMatchObject({ cal_month: "2027-02-01", cal_selected: "2027-02-18" });
    expect((back().finish as any).variables.cal_out).toBe("back");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
test("sheets close to their parent and navigation never accepts arbitrary triggers", () => {
  const result = JSON.stringify(sheet("detail", { type: "label", text: "Details" }));
  expect(result).toContain('"close":"detail"');
  expect(result).not.toContain('"finish"');
  expect(() =>
    decodeContext('{"calendarNavigation":1,"screen":{"type":"delete","values":{}},"history":[]}'),
  ).toThrow();
  expect(decodeContext("Team sync")).toBeUndefined();
});
