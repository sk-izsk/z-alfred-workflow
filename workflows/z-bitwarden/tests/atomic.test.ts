import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileAtomic } from "../src/env.ts";

test("an atomic write replaces the file whole, keeps mode 0600 and leaves no temp files", () => {
  const dir = mkdtempSync(join(tmpdir(), "bwa-atomic-"));
  try {
    const file = join(dir, "state.json");
    writeFileSync(file, "old content that is much longer than the new one");
    writeFileAtomic(file, '{"a":1}');
    expect(readFileSync(file, "utf8")).toBe('{"a":1}');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual(["state.json"]); // the temp file was renamed away
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
