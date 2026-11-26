import { spawn } from "node:child_process";

export type RunResult = { code: number; stdout: string; stderr: string };
export type RunOptions = { cwd?: string; input?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv };

/** Run a command (no shell). Never rejects on a non-zero exit, only when the binary can't start. */
export const run = (cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, timeout: opts.timeoutMs ?? 60_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.stdin.end(opts.input ?? "");
  });

/** Like run, but throws stderr on failure and returns trimmed stdout. */
export const exec = async (cmd: string, args: string[], opts: RunOptions = {}): Promise<string> => {
  const { code, stdout, stderr } = await run(cmd, args, opts);
  if (code !== 0) throw new Error(stderr.trim() || `${cmd} exited with ${code}`);
  return stdout.trim();
};

/** AppleScript; arguments arrive as `argv` so nothing is spliced into the script text. */
export const osascript = (script: string, ...args: string[]): Promise<string> =>
  exec("/usr/bin/osascript", ["-e", `on run argv\n${script}\nend run`, ...args]);
