import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { promisify, stripVTControlCharacters } from "node:util";
import { isAbsolute, resolve } from "node:path";
import { homedir } from "node:os";
import { str } from "./env.ts";
const exec = promisify(execFile);
export const executable = (): string => {
  const path = [str("mole_path"), "/opt/homebrew/bin/mole", "/usr/local/bin/mole"].find(
    (p) => p && isAbsolute(p) && existsSync(p) && statSync(p).isFile(),
  );
  if (!path)
    throw new Error("Mole is not installed. Install it separately or configure its executable path.");
  return path;
};
export const folder = (path: string): string => {
  const value = path.replace(/^~(?=\/|$)/, homedir());
  if (!isAbsolute(value) || value.includes("\0")) throw new Error("Enter an absolute folder path.");
  return resolve(value);
};
export type Mode = "menu" | "status" | "analyze" | "clean" | "optimize";
export const commandArgs = (mode: Mode, path = ""): string[] => {
  if (mode === "status") return ["status", "--json"];
  if (mode === "analyze") return ["analyze", "--json", folder(path)];
  if (mode === "clean" || mode === "optimize") return [mode, "--dry-run"];
  throw new Error("Choose a Mole command.");
};
export const run = async (mode: Mode, path = ""): Promise<string> => {
  const result = await exec(executable(), commandArgs(mode, path), {
    timeout: 90000,
    maxBuffer: 8000000,
    env: {
      ...process.env,
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      TERM: "dumb",
      NO_COLOR: "1",
    },
  });
  return result.stdout;
};
export const cleanOutput = (text: string): string[] =>
  stripVTControlCharacters(text)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-600);
export type Item = {
  id: string;
  name: string;
  description: string;
  icon: string;
  path?: string;
  directory?: boolean;
  details: [string, string][];
};
const scalar = (v: unknown): string =>
  v === null || v === undefined ? "Unavailable" : typeof v === "object" ? JSON.stringify(v) : String(v);
export const flatten = (value: unknown, prefix = ""): [string, string][] => {
  if (!value || typeof value !== "object") return [[prefix, scalar(value)]];
  return Object.entries(value)
    .flatMap(([key, v]) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? flatten(v, prefix ? `${prefix} · ${key}` : key)
        : [[prefix ? `${prefix} · ${key}` : key, scalar(v)] as [string, string]],
    )
    .slice(0, 150);
};
export const parseStatus = (text: string): Item[] => {
  const data = JSON.parse(text);
  if (!data || typeof data.hardware !== "object" || typeof data.health_score !== "number")
    throw new Error("Unsupported Mole status response.");
  return ["health_score", "hardware", "cpu", "memory", "disks", "batteries", "network", "thermal"].map(
    (key) => ({
      id: key,
      name: key.replace(/_/g, " "),
      description:
        key === "health_score" ? `${data.health_score}/100 · ${data.health_score_msg || ""}` : "Mole status",
      icon: key === "health_score" ? "heart" : "gauge",
      details: flatten(data[key], key),
    }),
  );
};
export const parseAnalysis = (text: string): Item[] => {
  const data = JSON.parse(text);
  if (!Array.isArray(data?.entries)) throw new Error("Unsupported Mole analysis response.");
  return data.entries
    .filter(
      (v: any) =>
        typeof v?.path === "string" &&
        isAbsolute(v.path) &&
        typeof v.name === "string" &&
        typeof v.size === "number" &&
        Number.isFinite(v.size) &&
        typeof v.is_dir === "boolean",
    )
    .slice(0, 500)
    .map((v: any) => ({
      id: v.path,
      name: v.name,
      description: `${(v.size / 1048576).toFixed(1)} MB`,
      icon: v.is_dir ? "folder" : "doc",
      path: v.path,
      directory: v.is_dir,
      details: [
        ["Path", v.path],
        ["Bytes", String(v.size)],
        ["Scan", v.scan_status || data.scan_status || "Unknown"],
      ],
    }));
};
export const shellQuote = (text: string): string => "'" + text.replace(/'/g, "'\\''") + "'";
export const execution = (mode: string): string => {
  if (mode !== "clean" && mode !== "optimize") throw new Error("Unsupported system change.");
  return [executable(), mode].map(shellQuote).join(" ");
};
