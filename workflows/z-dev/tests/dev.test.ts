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

test("a tool reads Dev's launch envelope back, and rejects tampered or foreign launches", async () => {
  const { launcherNavigation } = await import("../../../shared/launcher.ts");
  const dev = launcherNavigation("dev"),
    swiss = launcherNavigation("swiss");
  const id = "12345678-1234-1234-1234-123456789abc";
  expect(dev.launchInput(envelope(id, "wifi"))).toEqual({ query: "wifi", returnTo: id });
  expect(dev.backVariables("wifi_out", envelope(id))).toEqual({ wifi_out: "back", dev_return: id });
  // Plain text is a search query, not a launch.
  expect(dev.launchInput("hello")).toEqual({ query: "hello", returnTo: "" });
  // A Swiss tool doesn't accept Dev's envelope as a launch.
  expect(swiss.launchInput(envelope(id)).returnTo).toBe("");
  const tampered =
    "dev:v1:" + Buffer.from(JSON.stringify({ returnTo: "../../x", query: "" })).toString("base64url");
  expect(() => dev.launchInput(tampered)).toThrow("Reopen the tool from Dev");
  expect(() => dev.launchInput("dev:v1:" + "A".repeat(3000))).toThrow();
  expect(() => envelope("not-a-session")).toThrow();
  expect(available(tools[0]!, [{ bundle: tools[0]!.bundle, version: "0.0.9" }])).toBe(false);
});
