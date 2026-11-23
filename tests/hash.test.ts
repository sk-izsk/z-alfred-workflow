import { expect, test } from "bun:test";
import { randomBytes, scryptSync } from "node:crypto";
import { hashSecret, verifySecret } from "../src/session.ts";

test("new hashes carry their cost parameters, use a random salt and verify", () => {
  const a = hashSecret("correct horse");
  const b = hashSecret("correct horse");
  expect(a.startsWith("scrypt$131072$8$1$")).toBe(true); // N = 2^17, the current recommendation
  expect(a).not.toBe(b); // random salt: same password, different hash
  expect(verifySecret("correct horse", a)).toBe(true);
  expect(verifySecret("correct horsf", a)).toBe(false);
  expect(verifySecret("", a)).toBe(false);
});

test("hashes written by older versions still verify", () => {
  const salt = randomBytes(16);
  const legacy = `scrypt:${salt.toString("hex")}:${scryptSync("old secret", salt, 32).toString("hex")}`;
  expect(verifySecret("old secret", legacy)).toBe(true);
  expect(verifySecret("other", legacy)).toBe(false);
});

test("malformed or tampered hashes fail closed without throwing", () => {
  for (const bad of [
    "",
    "scrypt",
    "scrypt$x$y",
    "scrypt:zz:zz",
    "scrypt:abcd:ab",
    "scrypt$131072$8$1$aa$bb",
    "nope",
  ])
    expect(verifySecret("x", bad)).toBe(false);
});

test("a tampered hash cannot demand absurd work or memory", () => {
  const started = performance.now();
  expect(verifySecret("x", "scrypt$1073741824$8$1$00112233445566778899aabbccddeeff$00")).toBe(false); // N = 2^30
  expect(verifySecret("x", "scrypt$100000$8$1$00112233445566778899aabbccddeeff$00")).toBe(false); // not a power of two
  expect(verifySecret("x", "scrypt$131072$64$64$00112233445566778899aabbccddeeff$00")).toBe(false); // r and p too big
  expect(performance.now() - started).toBeLessThan(500); // rejected before any scrypt runs
});
