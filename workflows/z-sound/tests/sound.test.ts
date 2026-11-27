import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { describe, devicesFor, hiddenNames, symbol, type Device, type Snapshot } from "../src/devices.ts";

const device = (id: number, name: string, transport: string, outputs: number, inputs: number): Device => ({
  id,
  uid: `UID-${id}`,
  name,
  transport,
  outputs,
  inputs,
  // HDMI outputs have no volume control of their own.
  outputVolume: outputs && transport !== "hdmi" ? 0.5 : null,
  inputVolume: inputs ? 0.8 : null,
  muted: false,
});
const snapshot: Snapshot = {
  output: 2,
  input: 3,
  alert: 1,
  devices: [
    device(1, "Studio Speakers", "built-in", 1, 0),
    device(2, "Desk Monitor", "hdmi", 1, 0),
    device(3, "Podcast Mic", "usb", 0, 1),
    device(4, "Wireless Headphones", "bluetooth", 1, 1),
    device(5, "Meeting Loopback", "virtual", 1, 1),
  ],
};
const names = (list: Device[]) => list.map((d) => d.name);

test("lists one direction, current device first, then by name", () => {
  expect(names(devicesFor(snapshot, "output", "", new Set()))).toEqual([
    "Desk Monitor",
    "Meeting Loopback",
    "Studio Speakers",
    "Wireless Headphones",
  ]);
  expect(names(devicesFor(snapshot, "input", "", new Set()))).toEqual([
    "Podcast Mic",
    "Meeting Loopback",
    "Wireless Headphones",
  ]);
});

test("search matches every word in the name or transport; hidden devices stay visible while current", () => {
  expect(names(devicesFor(snapshot, "output", "blue head", new Set()))).toEqual(["Wireless Headphones"]);
  const hidden = hiddenNames(" meeting loopback \n\nDesk Monitor\n");
  expect(names(devicesFor(snapshot, "output", "", hidden))).toEqual([
    "Desk Monitor",
    "Studio Speakers",
    "Wireless Headphones",
  ]);
});

test("row text and symbols describe the device", () => {
  const [speakers, monitor, mic, headphones, loopback] = snapshot.devices as [
    Device,
    Device,
    Device,
    Device,
    Device,
  ];
  expect(describe(snapshot, monitor, "output")).toBe("Current · HDMI");
  expect(describe(snapshot, speakers, "output")).toBe("Alerts · Built-in · 50%");
  expect(describe(snapshot, mic, "input")).toBe("Current · USB · 80%");
  expect(symbol(headphones, "output")).toBe("headphones");
  expect(symbol(monitor, "output")).toBe("tv");
  expect(symbol(mic, "input")).toBe("mic");
  expect(symbol(loopback, "input")).toBe("waveform");
  expect(symbol(speakers, "output")).toBe("hifispeaker");
});

test("the CoreAudio helper never redeclares JXA globals and binds functions with plain pointers", () => {
  const source = readFileSync(new URL("../workflow/bin/audio.js", import.meta.url), "utf8");
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
  // BridgeSupport's struct-pointer signatures crash osascript; the helper must not import CoreAudio.
  expect(source).not.toContain('ObjC.import("CoreAudio")');
});
