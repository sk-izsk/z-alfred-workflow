import { expect, test } from "bun:test";
import { formatCode, totpCode, totpRemaining } from "../src/totp.ts";

// RFC 6238 appendix B: ASCII "12345678901234567890" == base32 below.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("RFC 6238 SHA1 vectors (8 digits)", () => {
  const uri = `otpauth://totp/x?secret=${RFC_SECRET}&digits=8`;
  expect(totpCode(uri, 59_000)).toBe("94287082");
  expect(totpCode(uri, 1_111_111_109_000)).toBe("07081804");
  expect(totpCode(uri, 2_000_000_000_000)).toBe("69279037");
});

test("raw base32 key defaults to 6 digits / 30s, spaces ignored", () => {
  expect(totpCode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq", 59_000)).toBe("287082");
  expect(totpRemaining(RFC_SECRET, 59_000)).toBe(1);
});

test("steam keys give 5 Steam characters", () => {
  expect(totpCode(`steam://${RFC_SECRET}`, 59_000)).toMatch(/^[23456789BCDFGHJKMNPQRTVWXY]{5}$/);
});

test("format splits 6-digit codes", () => {
  expect(formatCode("123456")).toBe("123 456");
});

test("an empty or junk key never produces a code", () => {
  expect(() => totpCode("")).toThrow();
  expect(() => totpCode("otpauth://totp/x?secret=")).toThrow();
});
