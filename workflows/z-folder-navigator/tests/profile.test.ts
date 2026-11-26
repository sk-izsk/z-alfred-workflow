import { expect, test } from "bun:test";
import { backBinding, shortcutLabel, fittedWidth, hyperConfiguration } from "../../../shared/ui-profile.ts";
const settings = (values: Record<string, string>) => ({
  str: (key: string, fallback = "") => values[key] ?? fallback,
  bool: (key: string, fallback = false) => (key in values ? values[key] === "1" : fallback),
});
test("Hyper binding and footer agree for defaults, partial modifiers and custom shortcuts", () => {
  expect(backBinding(settings({}))).toEqual({ shortcut: "⌃⌥⇧⌘B", label: "Hyper+B" });
  expect(backBinding(settings({ hyper_shift: "0", hyper_option: "0", back_key: "j" }))).toEqual({
    shortcut: "⌃⌘J",
    label: "⌃⌘J",
  });
  expect(backBinding(settings({ hyper_enabled: "0", back_shortcut: "⌘[" }))).toEqual({
    shortcut: "⌘[",
    label: "⌘[",
  });
  expect(
    backBinding(settings({ hyper_control: "0", hyper_option: "0", hyper_shift: "0", hyper_command: "0" }))
      .shortcut,
  ).toBe("⌃⌥⇧⌘B");
  expect(shortcutLabel("⇧⌘⌥⌃K")).toBe("Hyper+K");
  expect(new Set(hyperConfiguration().map((c) => c.variable)).size).toBe(7);
});
test("standard width fits smaller displays without expanding on larger ones", () => {
  expect(fittedWidth(2560)).toBe(780);
  expect(fittedWidth(720)).toBe(680);
  expect(fittedWidth(NaN)).toBe(780);
});
