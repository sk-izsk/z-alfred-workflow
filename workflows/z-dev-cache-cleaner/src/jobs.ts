import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { cacheDir } from "./env.ts";
import { read, save, type State } from "./state.ts";
import { clean, scan } from "./caches.ts";
export const busy = (s: State): boolean => s.job?.phase === "cleaning" || s.job?.phase === "refreshing";
const lock = (id: string): string => join(cacheDir(), `cleanup-${id}.lock`);
export const beginCleanup = (s: State): string => {
  if (busy(s) || !s.plan.length) throw new Error("No pending cleanup, or cleanup is already running.");
  writeFileSync(lock(s.id), "running", { flag: "wx", mode: 0o600 });
  const id = randomUUID();
  s.job = {
    id,
    phase: "cleaning",
    targets: s.plan,
    completed: 0,
    total: s.plan.length,
    message: "Cleaning…",
  };
  s.plan = [];
  save(s);
  return id;
};
/** Always remeasure after cleanup, including partial failures; never report an estimated amount as reclaimed. */
export const runCleanup = async (id: string, jobID: string, deps = { clean, scan }): Promise<void> => {
  const s = read(id);
  if (s.job?.id !== jobID || s.job.phase !== "cleaning") return;
  let failure = "";
  const patch = (fields: Partial<NonNullable<State["job"]>>) => {
    const current = read(id);
    if (current.job?.id !== jobID) throw new Error("Cleanup session changed.");
    Object.assign(current.job, fields);
    save(current);
  };
  try {
    try {
      await deps.clean(s.job.targets, undefined, (completed, total) =>
        patch({ completed, message: `Cleaning… ${completed}/${total}` }),
      );
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    patch({ phase: "refreshing", message: "Refreshing cache sizes…" });
    try {
      const measured = await deps.scan(),
        current = read(id);
      Object.assign(current, measured);
      save(current);
    } catch (error) {
      failure += `${failure ? " " : ""}Refresh failed; displayed sizes may be outdated. ${error instanceof Error ? error.message : String(error)}`;
    }
    patch({
      phase: failure ? "error" : "done",
      targets: [],
      message: failure || "Cleanup complete · sizes refreshed",
    });
  } finally {
    try {
      unlinkSync(lock(id));
    } catch {
      // the lock is already gone
    }
  }
};
