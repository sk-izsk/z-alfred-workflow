import { expect, test } from "bun:test";
import { decodeSecret, encodeSecret } from "../src/keychain.ts";

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
