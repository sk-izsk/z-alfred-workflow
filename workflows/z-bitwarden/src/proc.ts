import { basename } from "node:path";
import { timed } from "./log.ts";
import { spawn } from "node:child_process";

export type RunOptions = { input?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number };
export type RunResult = { code: number; stdout: string; stderr: string };

/**
 * What a child process may inherit. An allow-list, not a deny-list: a secret-bearing variable we
 * did not think of (UI-held vault data, someone's API token, a debugger hook) is dropped by default.
 * Keeps the basics every tool needs, locale, proxy and certificate settings, and Alfred's own
 * non-secret `alfred_*` variables. Anything else a child needs is passed explicitly.
 */
const ALLOWED_ENV =
  /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TERM|LANG|LC_[A-Z_]+|__CF_USER_TEXT_ENCODING|(https?|all|no)_proxy|SSL_CERT_(FILE|DIR)|alfred_[a-z_]+)$/i;

export const publicEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => ALLOWED_ENV.test(key)));

/** What a subprocess is, for the debug log, without any argument that could hold a secret. */
const label = (cmd: string, args: string[]): string => {
  const name = basename(cmd);
  if (name === "bw") return `bw ${args.slice(0, 2).join(" ")}`;
  if (name === "security") return `security ${args[0] ?? ""}`;
  return name;
};

/** Run a command; secrets go through `input` (stdin) or `env`, never argv. */
export const run = (cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> =>
  timed(label(cmd, args), () => spawnRun(cmd, args, opts));

const spawnRun = (cmd: string, args: string[], opts: RunOptions): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: opts.env ?? publicEnv(), timeout: opts.timeoutMs ?? 60_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8"); // decode whole characters, not chunk by chunk
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(opts.input ?? "");
  });

/** Run JXA (JavaScript for Automation). Data goes in through stdin. */
export const jxa = async (script: string, input = "", timeoutMs?: number): Promise<string> => {
  const { code, stdout, stderr } = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", script], {
    input,
    timeoutMs,
  });
  if (code !== 0) throw new Error(stderr.trim() || "osascript failed");
  return stdout.trim();
};

/** JXA prelude: `stdin()` returns everything piped in as a string. */
export const JXA_STDIN = `ObjC.import("Foundation");
const stdin = () => $.NSString.alloc.initWithDataEncoding($.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile, $.NSUTF8StringEncoding).js;`;
