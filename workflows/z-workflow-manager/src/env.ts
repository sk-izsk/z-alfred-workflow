import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const BUNDLE_ID = "com.izsk.workflow-manager";

/** The workflow folder: the bundle lives in `<workflow>/bin/wfman.mjs`. */
export const workflowDir = (): string => dirname(dirname(process.argv[1] ?? "."));

const readPlist = (path: string): Record<string, unknown> => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(
      execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8" }),
    );
  } catch {
    return {};
  }
};

let config: Record<string, string> | undefined;

/**
 * Run Script objects get the Workflow Configuration as env vars, Alfred UI scripts don't.
 * So fall back to the defaults in info.plist plus the user's choices in prefs.plist.
 */
const workflowConfig = (): Record<string, string> => {
  if (config) return config;
  const info = readPlist(join(workflowDir(), "info.plist")) as {
    userconfigurationconfig?: { variable: string; config: { default?: unknown } }[];
  };
  const defaults = Object.fromEntries(
    (info.userconfigurationconfig ?? []).map((c) => [c.variable, String(c.config.default ?? "")]),
  );
  const prefs = readPlist(join(workflowDir(), "prefs.plist"));
  const merged = {
    ...defaults,
    ...Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, String(v)])),
  };
  config = Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, v === "true" ? "1" : v === "false" ? "0" : v]),
  );
  return config;
};

export const str = (key: string, fallback = ""): string =>
  process.env[key]?.trim() || workflowConfig()[key]?.trim() || fallback;

export const bool = (key: string, fallback = false): boolean => {
  const value = str(key);
  return value === "" ? fallback : value === "1" || value === "true";
};

const ensureDir = (dir: string): string => (mkdirSync(dir, { recursive: true, mode: 0o700 }), dir);

export const dataDir = (): string =>
  ensureDir(
    str(
      "alfred_workflow_data",
      join(homedir(), "Library/Application Support/Alfred/Workflow Data", BUNDLE_ID),
    ),
  );

export const cacheDir = (): string =>
  ensureDir(
    str(
      "alfred_workflow_cache",
      join(homedir(), "Library/Caches/com.runningwithcrayons.Alfred/Workflow Data", BUNDLE_ID),
    ),
  );

/** Temp file + rename, so a reader never sees a half-written file. */
export const writeJson = (path: string, data: unknown): void => {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
  renameSync(temp, path);
};

export const readJson = <T>(path: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
};
