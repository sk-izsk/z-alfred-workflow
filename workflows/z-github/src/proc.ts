import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";
import { str } from "./env.ts";
export const executable = (name: string, setting: string): string => {
  const configured = str(setting);
  for (const path of configured
    ? [configured]
    : [
        `/opt/homebrew/bin/${name}`,
        `/usr/local/bin/${name}`,
        join(homedir(), ".local/bin", name),
        `/usr/bin/${name}`,
      ]) {
    if (!isAbsolute(path)) continue;
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      /* Try the next known location. */
    }
  }
  throw new Error(`${name} not found. Install it yourself and set its path in Workflow’s Configuration.`);
};
export const command = (
  exe: string,
  args: string[],
  input = "",
  cwd?: string,
  timeout = 60_000,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      failed = false;
    const timer = setTimeout(() => {
      failed = true;
      child.kill("SIGKILL");
      reject(new Error("Command timed out. Please try again."));
    }, timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 20_000_000) {
        failed = true;
        child.kill("SIGKILL");
        reject(new Error("Response is too large; narrow your search."));
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failed) return;
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `${exe} exited with ${code}`));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
export const gh = (args: string[], input = "", cwd?: string) =>
  command(executable("gh", "gh_path"), args, input, cwd);
export const git = (args: string[], cwd?: string) => command("/usr/bin/git", args, "", cwd);
export const apple = (script: string, args: string[]) =>
  command("/usr/bin/osascript", ["-e", `on run argv\n${script}\nend run`, ...args]);
export const downloadAPI = (endpoint: string, target: string, hostname: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const fsImport = import("node:fs");
    void fsImport
      .then(({ createWriteStream, rmSync, openSync }) => {
        const exe = executable("gh", "gh_path");
        const fd = openSync(target, "wx", 0o600);
        const out = createWriteStream(target, { fd, autoClose: true });
        const child = spawn(exe, ["api", "--hostname", hostname, endpoint], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let bytes = 0,
          stderr = "",
          done = false,
          streamFinished = false,
          processClosed = false,
          fileCreated = true;
        const fail = (e: Error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          out.destroy();
          if (fileCreated) rmSync(target, { force: true });
          reject(e);
        };
        const timer = setTimeout(() => fail(new Error("Archive download timed out")), 180_000);
        child.stdout.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 500_000_000) fail(new Error("Archive exceeds 500 MB."));
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr = (stderr + chunk.toString()).slice(-4000);
        });
        out.on("open", () => {
          fileCreated = true;
        });
        const complete = () => {
          if (done || !streamFinished || !processClosed) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        child.on("error", fail);
        out.on("error", fail);
        child.stdout.pipe(out);
        child.on("close", (code) => {
          processClosed = true;
          if (code !== 0) fail(new Error(stderr || "Archive download failed"));
          else complete();
        });
        out.on("finish", () => {
          streamFinished = true;
          complete();
        });
      })
      .catch(reject);
  });
