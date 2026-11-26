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
export const run = async (mode: Mode, path = "", progress?: (line: string) => void): Promise<string> => {
  const pending = exec(executable(), commandArgs(mode, path), {
    timeout: 90000,
    maxBuffer: 8000000,
    env: {
      ...process.env,
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
      TERM: "dumb",
      NO_COLOR: "1",
    },
  });
  if (progress && (mode === "clean" || mode === "optimize")) {
    let buffer = "";
    pending.child.stdout?.on("data", (chunk: string | Buffer) => {
      buffer = (buffer + String(chunk)).slice(-16000);
      const line = cleanOutput(buffer).at(-1);
      if (line) progress(line.slice(0, 220));
    });
  }
  pending.child.stdin?.end();
  return (await pending).stdout;
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
  group?: string;
  badge?: string;
  tone?: string;
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
