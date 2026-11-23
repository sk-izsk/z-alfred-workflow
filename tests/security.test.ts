import { expect, test } from "bun:test";
import { join } from "node:path";

// The fixture unlocks about 16 times, and each unlock hashes with scrypt at 128 MiB (about 0.2 s here,
// slower on CI), so it needs more than bun's default 5 seconds.
const FIXTURE_TIMEOUT_MS = 60_000;

test(
  "security boundaries fail closed without touching user credentials",
  async () => {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, "fixtures/security-check.ts")], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toContain("Passed isolated security regressions");
  },
  FIXTURE_TIMEOUT_MS,
);
