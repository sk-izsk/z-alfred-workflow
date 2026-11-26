import { expect, test } from "bun:test";
import { tools, envelope, available } from "../src/tools.ts";
test("Dev contains only the five requested tools and uses a separate parent protocol", () => {
  expect(tools.map((x) => x.id)).toEqual([
    "dev-servers",
    "bluetooth",
    "wifi",
    "dev-cache-cleaner",
    "dev-utils",
  ]);
  const id = "12345678-1234-1234-1234-123456789abc";
  const value = envelope(id, "test");
  expect(value.startsWith("dev:v1:")).toBe(true);
  expect(JSON.parse(Buffer.from(value.slice(7), "base64url").toString())).toEqual({
    returnTo: id,
    query: "test",
  });
  expect(available(tools[0]!, [])).toBe(false);
  expect(available(tools[0]!, [{ bundle: tools[0]!.bundle, version: "0.1.0" }])).toBe(true);
});
