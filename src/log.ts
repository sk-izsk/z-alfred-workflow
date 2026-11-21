import { appendFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bool, dataDir } from "./env.ts";

/**
 * Debug log at `<workflow data>/debug.log`. Errors are always written; step timings only when
 * "Debug log" is on. Never pass secrets in here: only command names, durations and messages.
 */
const MAX_BYTES = 1_000_000;

export const logPath = (): string => join(dataDir(), "debug.log");
export const debugOn = (): boolean => bool("debug");

const write = (line: string): void => {
  try {
    const path = logPath();
    if (existsSync(path) && statSync(path).size > MAX_BYTES) writeFileSync(path, "");
    appendFileSync(path, `${new Date().toISOString()} [${process.pid}] ${line}\n`, { mode: 0o600 });
  } catch {
    // logging must never break the workflow
  }
};

/** Timing / step line; only when debugging is on. */
export const log = (line: string): void => {
  if (debugOn()) write(line);
};

/** Always recorded, so "it failed" can be traced even without debug mode. */
export const logError = (where: string, error: unknown): void => {
  const detail =
    error instanceof Error
      ? `${error.message}${debugOn() && error.stack ? `\n${error.stack}` : ""}`
      : String(error);
  write(`ERROR ${where}: ${detail}`);
};

/** Measure an async step: `await timed("bw list items", () => …)`. */
export const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    log(`${label} ${Math.round(performance.now() - start)}ms`);
  }
};

export const clearLog = (): void => writeFileSync(logPath(), "");
