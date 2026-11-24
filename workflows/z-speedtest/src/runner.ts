import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { cacheDir, readJson, str, writeJson } from "./env.ts";
import { applyEvent, describeFailure, emptyState, lineReader, type State } from "./model.ts";

export const sessionDir = (session: string): string => {
  if (!/^[a-f0-9-]{36}$/.test(session)) throw new Error("Invalid test session");
  return join(cacheDir(), "sessions", session);
};
export const snapshot = (session: string): State =>
  readJson(join(sessionDir(session), "state.json"), emptyState());
export const cancel = (session: string): void => {
  if (!session) return;
  const dir = sessionDir(session);
  if (existsSync(dir)) writeFileSync(join(dir, "cancel"), "", { mode: 0o600 });
};
export const findCLI = (): string => {
  const configured = str("speedtest_path");
  for (const path of configured
    ? [configured]
    : ["/opt/homebrew/bin/speedtest", "/usr/local/bin/speedtest"]) {
    if (!isAbsolute(path)) continue;
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      /* Try the next standard location. */
    }
  }
  throw new Error(
    "Ookla Speedtest CLI not found. Install it from speedtest.net/apps/cli, then set its path in Workflow’s Configuration. speedtest-cli (Python) is not supported.",
  );
};
export const worker = async (session: string): Promise<void> => {
  const dir = sessionDir(session),
    path = join(dir, "state.json"),
    state = emptyState();
  const lock = join(cacheDir(), "running");
  let ownsLock = false;
  const save = () => writeJson(path, state);
  const fail = (message: string) => {
    state.phase = "error";
    state.errorMessage = message;
    save();
  };
  const cancelled = () => existsSync(join(dir, "cancel"));
  try {
    // A restart waits briefly for the previous worker to release its CLI process.
    for (let attempt = 0; attempt < 30 && !cancelled(); attempt++) {
      try {
        mkdirSync(lock, { mode: 0o700 });
        ownsLock = true;
        writeFileSync(join(lock, "owner"), String(process.pid));
        break;
      } catch {
        let alive = true;
        try {
          const pid = Number(readFileSync(join(lock, "owner"), "utf8"));
          if (!Number.isInteger(pid) || pid <= 0) break;
          process.kill(pid, 0);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false;
        }
        if (!alive) rmSync(lock, { recursive: true, force: true });
        await delay(100);
      }
    }
    if (cancelled()) return;
    if (!ownsLock)
      throw new Error("A speed test is already running. Close the other Speed Test window and try again.");
    const cli = findCLI();
    const version = await new Promise<string>((resolve, reject) => {
      const check = spawn(cli, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      check.stdout.on("data", (data: Buffer) => {
        text = (text + data.toString()).slice(0, 8192);
      });
      check.stderr.on("data", (data: Buffer) => {
        text = (text + data.toString()).slice(0, 8192);
      });
      const timeout = setTimeout(() => {
        check.kill("SIGKILL");
        reject(new Error("Speedtest CLI version check timed out"));
      }, 5000);
      check.on("error", reject);
      check.on("close", () => {
        clearTimeout(timeout);
        resolve(text);
      });
    });
    if (cancelled()) return;
    if (!/Ookla/i.test(version))
      throw new Error(
        "The executable is not Ookla’s official Speedtest CLI. Python speedtest-cli is not supported.",
      );
    await new Promise<void>((resolve) => {
      const cliArgs = ["--format", "json", "--progress", "--accept-license", "--accept-gdpr"];
      const child = spawn(cli, cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "",
        parseError = "",
        finished = false;
      const reader = lineReader((event) => {
        applyEvent(state, event);
        save();
      });
      const timeout = setTimeout(() => {
        parseError = "Speedtest timed out after two minutes. Please try again.";
        child.kill("SIGKILL");
      }, 120_000);
      const watchdog = setInterval(() => {
        if (cancelled()) child.kill("SIGKILL");
      }, 100);
      child.stdout.on("data", (data: Buffer) => {
        if (parseError) return;
        try {
          reader.push(data.toString());
        } catch (error) {
          parseError = error instanceof Error ? error.message : String(error);
          child.kill("SIGKILL");
        }
      });
      child.stderr.on("data", (data: Buffer) => {
        stderr = (stderr + data.toString()).slice(-8192);
      });
      child.on("error", (error) => {
        parseError = error.message;
      });
      child.on("close", (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        clearInterval(watchdog);
        if (!cancelled()) {
          try {
            reader.end();
          } catch (error) {
            parseError = String(error);
          }
          if (parseError || code !== 0 || state.phase !== "done")
            fail(parseError || describeFailure(stderr, code));
        }
        resolve();
      });
    });
  } catch (error) {
    if (!cancelled()) fail(error instanceof Error ? error.message : String(error));
  } finally {
    if (ownsLock) rmSync(lock, { recursive: true, force: true });
  }
};
