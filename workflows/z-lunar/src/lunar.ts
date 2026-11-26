import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { str } from "./env.ts";
const exec = promisify(execFile);
export const executable = (): string => {
  const path = [
    str("lunar_path"),
    join(homedir(), ".local/bin/lunar"),
    "/opt/homebrew/bin/lunar",
    "/usr/local/bin/lunar",
    "/Applications/Lunar.app/Contents/Helpers/lunarCLI",
    "/Applications/Paid/Lunar.app/Contents/Helpers/lunarCLI",
  ].find((p) => p && isAbsolute(p) && existsSync(p));
  if (!path) throw new Error("Install Lunar separately or configure the executable path.");
  return path;
};
export const run = async (args: string[]): Promise<string> =>
  (await exec(executable(), args, { timeout: 10000, maxBuffer: 2000000 })).stdout;
export type Display = {
  id: string;
  name: string;
  brightness: number | null;
  contrast: number | null;
  volume: number | null;
  active: boolean;
  hasDDC: boolean;
  controlMethod: string;
  inputs: string[];
  blackout: boolean;
};
const percent = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
export const parseDisplays = (text: string): Display[] => {
  const data = JSON.parse(text);
  if (!Array.isArray(data?.displays))
    throw new Error("This Lunar CLI does not support the expected display JSON. Update Lunar separately.");
  return data.displays
    .filter(
      (d: any) => (typeof d?.id === "number" || typeof d?.id === "string") && typeof d.name === "string",
    )
    .map((d: any) => ({
      id: String(d.id),
      name: d.name,
      brightness: percent(d.brightness),
      contrast: percent(d.contrast),
      volume: percent(d.volume),
      active: d.active === true,
      hasDDC: d.hasDDC === true,
      controlMethod: typeof d.controlMethod === "string" ? d.controlMethod : "Unknown",
      inputs: Array.isArray(d.availableInputs)
        ? d.availableInputs.filter((v: unknown) => typeof v === "string")
        : [],
      blackout: d.blackedOut === true,
    }));
};
export const modes = ["off", "synced", "sun", "system", "ambient", "auto"];
export const setArgs = (display: string, property: string, value: string): string[] => {
  const options: Record<string, string> = { brightness: "-b", contrast: "-c", volume: "-v" };
  if (
    !/^[0-9]+$/.test(display) ||
    !options[property] ||
    !/^([+-]?\d{1,3})$/.test(value) ||
    Math.abs(Number(value)) > 100
  )
    throw new Error("Use a value between 0 and 100, or a relative change such as +5.");
  return ["set", "-d", display, options[property]!, value];
};
export const presetName = (text: string): string => {
  const name = text.trim();
  if (!name || name.length > 80 || [...name].some((c) => c.charCodeAt(0) < 32))
    throw new Error("Use a preset name of 1–80 characters without control characters.");
  return name;
};
export const presetNames = (text: string): string[] => [
  ...new Set(
    [
      ...text.split("\n").flatMap((line) => {
        const match = line.match(/^([^\s].*?): (?:full-state )?preset\b/);
        return match ? [match[1]!] : [];
      }),
      ...str("preset_names").split(";").filter(Boolean),
    ].map(presetName),
  ),
];
export const fetchState = async () => {
  const [displays, adaptive, presets] = await Promise.all([
    run(["displays", "--json"]),
    run(["adaptive", "--json"]).catch(() => "{}"),
    run(["preset", "list"]).catch(() => ""),
  ]);
  const state = JSON.parse(adaptive);
  return {
    displays: parseDisplays(displays),
    adaptive: modes.includes(state.mode) ? state.mode : "off",
    presets: presetNames(presets),
  };
};
