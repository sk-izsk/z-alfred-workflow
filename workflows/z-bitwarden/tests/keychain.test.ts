import { expect, test } from "bun:test";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeSecret, encodeSecret, openSecret, sealSecret, wrapKey } from "../src/keychain.ts";

test("secrets are stored as plain ASCII, so security -w never answers in hex", () => {
  for (const secret of [
    "simple",
    "café ✓ naïve",
    "line one\nline two",
    'quote " backslash \\ tab\t',
    " padded ",
    "",
  ]) {
    const stored = encodeSecret(secret);
    expect(stored).toMatch(/^b64:[A-Za-z0-9+/=]*$/); // printable ASCII only, no newline
    expect(decodeSecret(stored)).toBe(secret);
  }
});

test("values saved by older versions (no prefix) are returned unchanged", () => {
  expect(decodeSecret("legacy-session-token==")).toBe("legacy-session-token==");
});

test("Keychain values are sealed: unreadable without the separate key file", () => {
  const key = Buffer.alloc(32, 7);
  const stored = sealSecret("session-token", key);
  expect(stored).toMatch(/^s1:[A-Za-z0-9+/=]+$/);
  expect(stored).not.toContain("session-token");
  expect(openSecret(stored, key)).toBe("session-token");
  expect(openSecret(stored, Buffer.alloc(32, 8))).toBeUndefined(); // wrong key
  expect(openSecret(stored, undefined)).toBeUndefined(); // key file gone
  expect(openSecret(`${stored.slice(0, -4)}AAAA`, key)).toBeUndefined(); // tampered
});

test("the wrapping key is created once, private, and never invented on a read", () => {
  const path = join(mkdtempSync(join(tmpdir(), "bwk-")), "keychain.key");
  expect(wrapKey(false, path)).toBeUndefined();
  const key = wrapKey(true, path);
  expect(key?.length).toBe(32);
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(wrapKey(false, path)?.equals(key!)).toBe(true);
  expect(wrapKey(true, path)?.equals(key!)).toBe(true);
});
