import { expect, test } from "bun:test";
import { isLegacyPlainCache, openCache, sealCache } from "../src/cachecrypt.ts";

const key = Buffer.alloc(32, 7);
const other = Buffer.alloc(32, 9);
const json = JSON.stringify({ syncedAt: 1, items: [{ name: "Github", uris: ["https://github.com"] }] });

test("sealed cache round-trips and hides its content", () => {
  const blob = sealCache(json, key);
  expect(openCache(blob, key)).toBe(json);
  expect(blob.toString("utf8")).not.toContain("Github");
  expect(blob.toString("utf8")).not.toContain("github.com");
});

test("each seal uses a fresh nonce", () => {
  expect(sealCache(json, key).equals(sealCache(json, key))).toBe(false);
});

test("wrong key, tampering, truncation and garbage all fail closed", () => {
  const blob = sealCache(json, key);
  expect(openCache(blob, other)).toBeUndefined();
  const tampered = Buffer.from(blob);
  tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1;
  expect(openCache(tampered, key)).toBeUndefined();
  expect(openCache(blob.subarray(0, 10), key)).toBeUndefined();
  expect(openCache(Buffer.from("not a cache"), key)).toBeUndefined();
  expect(openCache(Buffer.alloc(0), key)).toBeUndefined();
});

test("an old plaintext cache file is recognised so it can be thrown away", () => {
  expect(isLegacyPlainCache(Buffer.from(json))).toBe(true);
  expect(isLegacyPlainCache(sealCache(json, key))).toBe(false);
});
