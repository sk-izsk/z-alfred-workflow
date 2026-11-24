import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, workflowDir } from "./env.ts";
import { type NewEvent, type Snapshot, parseSnapshot } from "./model.ts";
import { exec } from "./proc.ts";

export class CalendarAccessError extends Error {}

export const bridge = async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
  let output: string;
  try {
    output = await exec(
      "/usr/bin/osascript",
      ["-l", "JavaScript", join(workflowDir(), "bin", "eventkit.js")],
      { input: JSON.stringify(input), timeoutMs: input.command === "authorize" ? 25000 : 20000 },
    );
  } catch {
    throw new Error("The macOS Calendar bridge did not respond. Check calendar access, then refresh.");
  }
  const result = JSON.parse(output) as Record<string, unknown>;
  if (result.ok !== true) {
    const message = typeof result.error === "string" ? result.error : "Calendar request failed.";
    if (result.code === "permission") throw new CalendarAccessError(message);
    throw new Error(message);
  }
  return result;
};

const statePath = (): string => {
  const directory = join(cacheDir(), "private");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  return join(directory, "agenda.json");
};

export const clearSnapshot = (): void => {
  try {
    unlinkSync(statePath());
  } catch {
    /* No cached agenda yet. */
  }
};

export const saveSnapshot = (snapshot: Snapshot): void => {
  const file = statePath(),
    temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify({ at: Date.now(), snapshot }), { mode: 0o600 });
  renameSync(temp, file);
};

export const cachedSnapshot = (): Snapshot => {
  try {
    const result = JSON.parse(readFileSync(statePath(), "utf8")) as { at: number; snapshot: Snapshot };
    if (Date.now() - result.at > 15 * 60000) {
      clearSnapshot();
      throw new Error("expired");
    }
    return result.snapshot;
  } catch {
    throw new Error("Refresh the calendar list (⌘R) to load current events.");
  }
};

export const loadSnapshot = async (start: string, end: string): Promise<Snapshot> => {
  try {
    const result = parseSnapshot(await bridge({ command: "snapshot", start, end }));
    saveSnapshot(result);
    return result;
  } catch (error) {
    clearSnapshot();
    throw error;
  }
};

export const createEvent = async (event: NewEvent): Promise<void> => {
  await bridge({ command: "create", event });
  clearSnapshot();
};
