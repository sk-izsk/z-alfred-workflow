import { expect, test } from "bun:test";
import { cpuUsage, networkCounters, vmFields } from "../src/metrics.ts";
import { dashboard } from "../../../shared/dashboard.ts";
test("CPU rates use deltas and initial/reset counters remain unknown", () => {
  expect(cpuUsage({ idle: 50, total: 100 })).toBeNull();
  expect(cpuUsage({ idle: 60, total: 200 }, { idle: 50, total: 100 })).toBe(90);
  expect(cpuUsage({ idle: 0, total: 0 }, { idle: 50, total: 100 })).toBeNull();
});
test("network parser uses byte counters for link rows only", () => {
  const result = networkCounters(
    "en0 1500 <Link#4> ab:cd 12 0 12345 10 0 6789 0\nen0 1500 192.168 192.168.1.2 12 0 12345 10 0 6789 0\nlo0 16384 <Link#1> 3 0 20 3 0 20 0",
  );
  expect(result).toEqual({ en0: { input: 12345, output: 6789 } });
  expect(
    vmFields("Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages active: 10.")["Pages active"],
  ).toBe(163840);
});
test("shared dashboard has visible Hyper Back and does not place Back in actions", () => {
  const ui = dashboard({
    bundle: "example",
    cli: "example",
    title: "Example",
    placeholder: "Search",
    details: true,
  });
  expect(JSON.stringify(ui.components())).toContain("Back  {var:back_label}");
  expect(ui.window.window.size.width).toBe(780);
});
