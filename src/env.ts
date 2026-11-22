import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const BUNDLE_ID = "com.izsk.bitwarden";

/** The workflow folder: this bundle lives in `<workflow>/bin/bwa.mjs`. */
export const workflowDir = (): string => dirname(dirname(process.argv[1] ?? "."));

const readPlist = (path: string): Record<string, unknown> => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(
      execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], {
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin" }, // plutil needs nothing from the workflow environment
      }),
    );
  } catch {
    return {};
  }
};

let config: Record<string, string> | undefined;

/**
 * Run Script objects get the Workflow Configuration as env vars, but Alfred UI scripts don't.
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

export const num = (key: string, fallback: number): number => {
  const value = Number(str(key));
  return Number.isFinite(value) && str(key) !== "" ? value : fallback;
};

const ensureDir = (dir: string): string => (mkdirSync(dir, { recursive: true }), dir);

const alfredDir = (kind: "Data" | "Cache") =>
  kind === "Data"
    ? join(homedir(), "Library/Application Support/Alfred/Workflow Data", BUNDLE_ID)
    : join(homedir(), "Library/Caches/com.runningwithcrayons.Alfred/Workflow Data", BUNDLE_ID);

/** Alfred doesn't create these folders, so create them on first use. */
export const dataDir = (): string => ensureDir(str("alfred_workflow_data", alfredDir("Data")));
export const cacheDir = (): string => ensureDir(str("alfred_workflow_cache", alfredDir("Cache")));

// --- accounts (several logins, one active at a time) ---

export type Account = { id: string; email: string; server: string };
export type Accounts = { active: string; list: Account[] };

/** The first account keeps the original un-suffixed paths, so nothing needs migrating. */
export const DEFAULT_ACCOUNT = "default";

const accountsPath = () => join(dataDir(), "accounts.json");

export const readAccounts = (): Accounts => {
  try {
    return JSON.parse(readFileSync(accountsPath(), "utf8")) as Accounts;
  } catch {
    return { active: DEFAULT_ACCOUNT, list: [] };
  }
};

export const writeAccounts = (accounts: Accounts): void =>
  writeFileSync(accountsPath(), JSON.stringify(accounts), { mode: 0o600 });

export const accountId = (): string => readAccounts().active || DEFAULT_ACCOUNT;

/** `name` for the default account, `name-<id>` for the others (files, Keychain entries). */
export const perAccount = (name: string): string =>
  accountId() === DEFAULT_ACCOUNT ? name : `${name}-${accountId()}`;

/** A private bw config folder per account, so the workflow never touches your own `bw` login. */
export const bwAppDataDir = (): string =>
  ensureDir(accountId() === DEFAULT_ACCOUNT ? join(dataDir(), "bw") : join(dataDir(), "bw", accountId()));
