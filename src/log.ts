import { appendFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bool, dataDir } from "./env.ts";

/**
 * Debug log at `<workflow data>/debug.log`. Step timings and error messages are written only when
 * "Debug log" is on, and even then tokens and email addresses are masked. With Debug off an error is
 * recorded as its command and type only. Never pass secrets in here: only command names, durations
 * and messages. (`bw` error text is outside our control, hence the masking.)
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

/** Token-like: long, with upper and lower case letters and a digit. File paths and words don't qualify. */
const looksLikeToken = (run: string): boolean => /\d/.test(run) && /[a-z]/.test(run) && /[A-Z]/.test(run);

/** Mask what a bug report should never carry: token-like strings and email addresses. */
export const redact = (text: string): string =>
  text
    .replace(/[A-Za-z0-9+/_-]{30,}={0,2}/g, (run) => (looksLikeToken(run) ? "[redacted]" : run))
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");

/** Always noted so "it failed" can be traced, but the message and stack only when Debug is on. */
export const logError = (where: string, error: unknown): void => {
  if (!debugOn()) {
    write(`ERROR ${where} (${error instanceof Error ? error.name : "unknown"})`);
    return;
  }
  const detail =
    error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
  write(`ERROR ${where}: ${redact(detail)}`);
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
