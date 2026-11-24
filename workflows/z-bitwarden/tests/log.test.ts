import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logError, logPath, redact } from "../src/log.ts";

const TOKEN = "dGhpcy1pcy1hLWZha2Utc2Vzc2lvbi10b2tlbi0xMjM0NTY3ODkwQUJDREVGR0g=";

test("redact masks long tokens and email addresses but leaves ordinary text alone", () => {
  const text = `bw failed for me@example.com with session ${TOKEN} (Vault is locked)`;
  const out = redact(text);
  expect(out).not.toContain(TOKEN);
  expect(out).not.toContain("me@example.com");
  expect(out).toContain("Vault is locked");
  expect(redact("Invalid master password")).toBe("Invalid master password");
  // paths in a stack trace are not tokens
  const path = "at /Volumes/Mac Mini/Projects/Misc/z-bitwarden/src/commands/search.ts:42";
  expect(redact(path)).toBe(path);
});

const withLog = (debug: string, run: () => void): string => {
  const saved = { ...process.env };
  const dir = mkdtempSync(join(tmpdir(), "bwa-log-"));
  try {
    process.env.alfred_workflow_data = dir;
    process.env.debug = debug;
    run();
    return readFileSync(logPath(), "utf8");
  } finally {
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  }
};

test("with Debug off an error is recorded without its message or stack", () => {
  const text = withLog("0", () =>
    logError("search-refresh", new Error(`secret-bearing text ${TOKEN} me@example.com`)),
  );
  expect(text).toContain("ERROR search-refresh");
  expect(text).not.toContain("secret-bearing");
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain("me@example.com");
});

test("with Debug on the message is recorded, with tokens and emails masked", () => {
  const text = withLog("1", () =>
    logError("search-refresh", new Error(`bw said no for me@example.com: ${TOKEN}`)),
  );
  expect(text).toContain("bw said no");
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain("me@example.com");
});
