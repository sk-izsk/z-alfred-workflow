import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { bwAppDataDir, str } from "./env.ts";
import { publicEnv, run } from "./proc.ts";

const home = homedir();

/** Newest nvm node bin folder, since Alfred doesn't load nvm's shell setup. */
const nvmBin = (): string[] => {
  const root = join(home, ".nvm/versions/node");
  if (!existsSync(root)) return [];
  const latest = readdirSync(root)
    .toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  return latest ? [join(root, latest, "bin")] : [];
};

/** Folders where bw (and the node it needs) usually live; Alfred's PATH has only Homebrew + system. */
const searchDirs = (): string[] => [
  dirname(process.execPath),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  join(home, ".bun/bin"),
  join(home, ".volta/bin"),
  join(home, ".local/bin"),
  ...nvmBin(),
];

export const bwPath = (): string =>
  str("bw_path") ||
  searchDirs()
    .map((dir) => join(dir, "bw"))
    .find(existsSync) ||
  "bw";

export class BwError extends Error {
  constructor(
    message: string,
    readonly stderr = "",
  ) {
    super(message);
  }
}

/** Turn bw's noisy stderr into one readable line. */
export const cleanError = (stderr: string): string => {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("at ") && !/^(\(node|Use `node)/.test(l));
  return line ?? "Bitwarden CLI failed";
};

/** `interactive` lets bw read a prompt answer from stdin (e.g. a Send password). */
export type BwOptions = {
  session?: string;
  input?: string;
  env?: Record<string, string>;
  interactive?: boolean;
};

const bwEnv = (opts: BwOptions): NodeJS.ProcessEnv => ({
  ...publicEnv(),
  PATH: [...searchDirs(), process.env.PATH ?? ""].join(":"),
  BITWARDENCLI_APPDATA_DIR: bwAppDataDir(),
  NODE_NO_WARNINGS: "1",
  ...(str("server_cert_path") && { NODE_EXTRA_CA_CERTS: str("server_cert_path") }),
  ...(opts.session && { BW_SESSION: opts.session }),
  ...opts.env,
});

export const bw = async (args: string[], opts: BwOptions = {}): Promise<string> => {
  const env = bwEnv(opts);
  const { code, stdout, stderr } = await run(
    bwPath(),
    opts.interactive ? args : [...args, "--nointeraction"],
    {
      env,
      input: opts.input,
    },
  );
  if (code !== 0) throw new BwError(cleanError(stderr || stdout), stderr);
  // Anything that changes the vault makes the encrypted cache stale.
  if (["create", "edit", "delete", "restore", "move"].includes(args[0] ?? "")) {
    (await import("./vault.ts")).invalidateVault();
  }
  return stdout.trim();
};

export const bwJson = async <T>(args: string[], opts: BwOptions = {}): Promise<T> =>
  JSON.parse(await bw(args, opts)) as T;

/** bw create/edit take base64 JSON, the same as `bw encode`. */
export const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64");

/** Fire-and-forget (e.g. `bw lock`): the calling script can exit right away. */
export const bwDetached = (args: string[], session?: string): void => {
  spawn(bwPath(), [...args, "--nointeraction"], {
    env: bwEnv({ session }),
    detached: true,
    stdio: "ignore",
  }).unref();
};
