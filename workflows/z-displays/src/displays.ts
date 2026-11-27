// Displays from CoreGraphics (through bin/display.js) and the rules for listing them and their modes.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
/** bin/display.js sits next to the bundled bin/displays.mjs. */
const HELPER = fileURLToPath(new URL("./display.js", import.meta.url));

export type Mode = {
  id: number;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  hz: number;
  native: boolean;
};
export type Display = {
  id: number;
  name: string;
  main: boolean;
  builtin: boolean;
  /** The display this one mirrors, or 0. */
  mirrorOf: number;
  current: Mode | null;
  modes: Mode[];
};
export type Snapshot = { dark: boolean; displays: Display[] };

const helper = async (args: string[]): Promise<any> => {
  const { stdout } = await execFileP("/usr/bin/osascript", ["-l", "JavaScript", HELPER, ...args], {
    encoding: "utf8",
    timeout: 10_000,
  });
  const value = JSON.parse(stdout);
  if (value?.error) throw new Error(value.error);
  return value;
};
/** Every display with its modes, plus Dark Mode (~150 ms). */
export const readDisplays = (): Promise<Snapshot> => helper(["list"]);
export const setMode = (display: number, mode: number): Promise<unknown> =>
  helper(["mode", String(display), String(mode)]);
export const setMain = (display: number): Promise<unknown> => helper(["main", String(display)]);
export const setMirror = (display: number, on: boolean): Promise<unknown> =>
  helper(["mirror", String(display), on ? "on" : "off"]);
export const setDark = (value: "on" | "off" | "toggle"): Promise<{ dark: boolean }> =>
  helper(["dark", value]);

export const hiDpi = (m: Mode): boolean => m.pixelWidth > m.width;
const hz = (value: number) => (value ? `${Number.isInteger(value) ? value : value.toFixed(2)} Hz` : "");
export const resolution = (m: Mode): string => `${m.width} × ${m.height}`;
export const sameMode = (a: Mode | null, b: Mode): boolean => a?.id === b.id;

/** Second line of a display row: Main · 2560 × 1440 · 60 Hz, or what it mirrors. */
export const describeDisplay = (d: Display, all: Display[]): string => {
  const mirrored = d.mirrorOf ? all.find((x) => x.id === d.mirrorOf) : undefined;
  return [
    d.main && "Main",
    d.builtin && "Built-in",
    d.mirrorOf ? `Mirrors ${mirrored?.name ?? "another display"}` : "",
    d.current && resolution(d.current),
    d.current && hz(d.current.hz),
    d.current && hiDpi(d.current) && "HiDPI",
  ]
    .filter(Boolean)
    .join(" · ");
};
/** Second line of a mode row: 60 Hz · HiDPI · Native · Current. */
export const describeMode = (m: Mode, current: Mode | null): string =>
  [hz(m.hz), hiDpi(m) && "HiDPI", m.native && "Native", sameMode(current, m) && "Current"]
    .filter(Boolean)
    .join(" · ");

/** Every word of the query must appear in the text (`1080 60`, `hidpi`, `native`). */
const matchesText = (text: string, query: string): boolean =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.toLowerCase().includes(word));
export const matchesDisplay = (d: Display, all: Display[], query: string): boolean =>
  matchesText(`${d.name} ${describeDisplay(d, all)}`, query);
export const matchesMode = (m: Mode, current: Mode | null, query: string): boolean =>
  matchesText(`${m.width}x${m.height} ${resolution(m)} ${describeMode(m, current)}`, query);

/** Main display first, then by name. */
export const sortDisplays = (list: Display[]): Display[] =>
  list.toSorted((a, b) => Number(b.main) - Number(a.main) || a.name.localeCompare(b.name));
/** Largest first, HiDPI before the same size without it, then the fastest refresh rate. */
export const sortModes = (list: Mode[]): Mode[] =>
  list.toSorted(
    (a, b) => b.width - a.width || b.height - a.height || Number(hiDpi(b)) - Number(hiDpi(a)) || b.hz - a.hz,
  );
