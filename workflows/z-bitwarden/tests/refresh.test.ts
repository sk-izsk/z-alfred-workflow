import { expect, test } from "bun:test";
import { refreshState } from "../src/commands/search.ts";

const THIRTY = "JBSWY3DPEHPK3PXP";
const FIFTEEN = "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&period=15";

test("30-second seeds keep the existing refresh boundaries and countdown", () => {
  const seeds = { a: THIRTY };
  expect(refreshState(seeds, 24_000)).toEqual({ token: "0:false", left: 6 });
  expect(refreshState(seeds, 25_000)).toEqual({ token: "0:true", left: 5 }); // final 5 seconds
  expect(refreshState(seeds, 30_000)).toEqual({ token: "1:false", left: 30 }); // rotated
});

test("a seed with its own period refreshes at its own boundary", () => {
  const seeds = { a: THIRTY, b: FIFTEEN };
  // The 15 s code rotates at second 15, which the old 30 s-only token missed.
  expect(refreshState(seeds, 14_000).token).not.toBe(refreshState(seeds, 15_000).token);
  expect(refreshState(seeds, 15_000).token).not.toBe(refreshState(seeds, 29_000).token); // 15 s urgency: last 5 s
  // The footer counts down to the soonest expiry across seeds.
  expect(refreshState(seeds, 14_000).left).toBe(1);
  expect(refreshState(seeds, 16_000).left).toBe(14);
});

test("unparseable seeds are ignored, and with none the default 30 s applies", () => {
  expect(refreshState({ a: "not a key !!!" }, 25_000)).toEqual({ token: "0:true", left: 5 });
  expect(refreshState({}, 24_000)).toEqual({ token: "0:false", left: 6 });
});
