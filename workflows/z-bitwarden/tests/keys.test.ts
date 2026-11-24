import { expect, test } from "bun:test";
import { typeText } from "../src/keys.ts";

// The ASCII check runs before anything is typed, so no keystrokes reach the system.
test("clipboard-free typing refuses non-ASCII text", async () => {
  await expect(typeText("pässword")).rejects.toThrow(/ASCII/);
});
