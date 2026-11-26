import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { beginCleanup, runCleanup, busy } from "../src/jobs.ts";
import { create, read, save } from "../src/state.ts";
import type { Cache } from "../src/caches.ts";
const fixture: Cache = {
  id: "example",
  name: "Example Cache",
  path: "/example/cache",
  category: "Package Manager Caches",
  risk: "Safe",
  bytes: 1024,
  device: 0,
  inode: 0,
  kind: "known",
  note: "Fixture",
  error: "",
};
for (const fail of [false, true])
  test(`cleanup shows activity, blocks duplicates and remeasures after ${fail ? "partial failure" : "success"}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "cache-job-test-")),
      prior = process.env.alfred_workflow_cache;
    process.env.alfred_workflow_cache = dir;
    try {
      const s = create("", "");
      s.rows = [fixture];
      s.plan = [fixture];
      s.filter = fixture.category;
      save(s);
      const stale = structuredClone(s),
        job = beginCleanup(s);
      expect(() => beginCleanup(stale)).toThrow();
      expect(read(s.id).plan).toEqual([]);
      const call = () =>
        JSON.parse(
          execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "cleanup-poll", s.id], {
            encoding: "utf8",
            env: process.env,
          }),
        );
      const loading = call();
      expect(loading.update.ids.activity.opacity).toBe(1);
      expect(loading.update.ids.primary.enabled).toBe(false);
      let cleaned = 0,
        scanned = 0;
      await runCleanup(s.id, job, {
        clean: async (_targets, _remove, progress) => {
          cleaned++;
          progress?.(1, 1);
          if (fail) throw new Error("Fixture cleanup failed after a change");
        },
        scan: async () => {
          scanned++;
          expect(read(s.id).job!.phase).toBe("refreshing");
          return { rows: [], limited: false };
        },
      });
      const done = read(s.id);
      expect(busy(done)).toBe(false);
      expect(done.rows).toEqual([]);
      expect(done.job!.phase).toBe(fail ? "error" : "done");
      const result = call();
      expect(result.pulse.interval).toBe(0);
      expect(result.update.ids.activity.opacity).toBe(0);
      expect(result.update.ids.filter.selected).toBe("All");
      expect(result.update.ids.query.placeholder).toContain("0 B total");
      expect(result.update.ids.statusLabel.text).toContain(
        fail ? "Fixture cleanup failed" : "sizes refreshed",
      );
      await runCleanup(s.id, job, {
        clean: async () => {
          cleaned++;
        },
        scan: async () => {
          scanned++;
          return { rows: [], limited: false };
        },
      });
      expect(cleaned).toBe(1);
      expect(scanned).toBe(1);
    } finally {
      if (prior === undefined) delete process.env.alfred_workflow_cache;
      else process.env.alfred_workflow_cache = prior;
      rmSync(dir, { recursive: true, force: true });
    }
  });
