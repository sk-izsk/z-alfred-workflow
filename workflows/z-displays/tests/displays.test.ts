import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  describeDisplay,
  describeMode,
  matchesMode,
  sortDisplays,
  sortModes,
  type Display,
  type Mode,
} from "../src/displays.ts";

const mode = (id: number, width: number, height: number, hz: number, scale = 1, native = false): Mode => ({
  id,
  width,
  height,
  pixelWidth: width * scale,
  pixelHeight: height * scale,
  hz,
  native,
});
const desk = mode(27, 2560, 1440, 60, 1, true);
const display = (id: number, name: string, extra: Partial<Display> = {}): Display => ({
  id,
  name,
  main: false,
  builtin: false,
  mirrorOf: 0,
  current: desk,
  modes: [],
  ...extra,
});

test("display rows: main first, then by name; second line shows mode and mirroring", () => {
  const a = display(1, "Studio Display"),
    b = display(2, "Desk Monitor", { main: true }),
    c = display(3, "Projector", { mirrorOf: 2, current: mode(4, 1920, 1080, 59.94) });
  expect(sortDisplays([a, b, c]).map((d) => d.name)).toEqual(["Desk Monitor", "Projector", "Studio Display"]);
  expect(describeDisplay(b, [a, b, c])).toBe("Main · 2560 × 1440 · 60 Hz");
  expect(describeDisplay(c, [a, b, c])).toBe("Mirrors Desk Monitor · 1920 × 1080 · 59.94 Hz");
});

test("modes: largest first, HiDPI before the same size, then fastest; search by size and tags", () => {
  const list = [
    mode(1, 1920, 1080, 60),
    mode(2, 1920, 1080, 60, 2),
    mode(3, 2560, 1440, 60),
    mode(4, 1920, 1080, 120),
  ];
  expect(sortModes(list).map((m) => m.id)).toEqual([3, 2, 4, 1]);
  expect(describeMode(mode(2, 1920, 1080, 60, 2), null)).toBe("60 Hz · HiDPI");
  expect(describeMode(desk, desk)).toBe("60 Hz · Native · Current");
  expect(list.filter((m) => matchesMode(m, null, "1080 120")).map((m) => m.id)).toEqual([4]);
  expect(list.filter((m) => matchesMode(m, null, "hidpi")).map((m) => m.id)).toEqual([2]);
});

test("the CoreGraphics helper never redeclares JXA globals or imports BridgeSupport struct calls", () => {
  const source = readFileSync(new URL("../workflow/bin/display.js", import.meta.url), "utf8");
  for (const name of [
    "\\$",
    "Path",
    "delay",
    "Application",
    "Library",
    "ObjC",
    "Ref",
    "Progress",
    "Automation",
  ])
    expect(source).not.toMatch(new RegExp(`(?:const|let|var|function)\\s+${name}\\b`));
  expect(source).not.toContain('ObjC.import("CoreGraphics")');
});
