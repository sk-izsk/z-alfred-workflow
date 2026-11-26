import { test, expect } from "bun:test";
import { launchInput, backVariables } from "../src/navigation.ts";
const id = "6b2e51b0-d9d1-41b8-a405-d24feafba521";
test("direct launches preserve input and do not invent a Swiss parent", () => {
  expect(launchInput("Toronto, Canada")).toEqual({ query: "Toronto, Canada", returnTo: "" });
  expect(backVariables("out", "100 km in miles")).toEqual({ out: "back", swiss_return: "" });
});
test("Swiss launch restores only the validated fixed-launcher session", () => {
  const raw =
    "swiss:v1:" +
    Buffer.from(JSON.stringify({ returnTo: id, query: "100 km in miles" })).toString("base64url");
  expect(launchInput(raw)).toEqual({ returnTo: id, query: "100 km in miles" });
  expect(backVariables("out", raw)).toEqual({ out: "back", swiss_return: id });
  expect(() => launchInput("swiss:v1:bad")).toThrow();
  const unsafe =
    "swiss:v1:" +
    Buffer.from(JSON.stringify({ returnTo: "../../another-app", query: "" })).toString("base64url");
  expect(() => launchInput(unsafe)).toThrow();
});
