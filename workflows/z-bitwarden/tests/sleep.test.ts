import { expect, test } from "bun:test";
import { parseSysctlTime, wokeSince } from "../src/sleep.ts";

test("parses the seconds out of a sysctl time value", () => {
  expect(parseSysctlTime("{ sec = 1795460204, usec = 958343 } Mon Nov 23 11:37:33 2026")).toBe(1795460204);
  expect(parseSysctlTime("{ sec = 0, usec = 0 } Wed Dec 31 19:00:00 1969")).toBe(0);
  expect(parseSysctlTime("garbage")).toBeUndefined();
});

test("the Mac slept or restarted since the last use only if a wake or boot came after it", () => {
  const lastUsedMs = 1_000_000 * 1000;
  // woke up after the last use: it slept in between
  expect(wokeSince(lastUsedMs, { wake: 1_000_100, boot: 900_000 })).toBe(true);
  // woke before the last use: the sleep was earlier, nothing to lock
  expect(wokeSince(lastUsedMs, { wake: 999_000, boot: 900_000 })).toBe(false);
  // never slept since boot (wake = 0) and booted long ago
  expect(wokeSince(lastUsedMs, { wake: 0, boot: 900_000 })).toBe(false);
  // restarted after the last use
  expect(wokeSince(lastUsedMs, { wake: 0, boot: 1_000_050 })).toBe(true);
  // readings unavailable: never lock on a guess
  expect(wokeSince(lastUsedMs, { wake: undefined, boot: undefined })).toBe(false);
});
