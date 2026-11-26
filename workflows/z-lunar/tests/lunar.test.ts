import { expect, test } from "bun:test";
import { parseDisplays, setArgs, presetNames, presetName } from "../src/lunar.ts";
test("display parsing handles unavailable values and does not retain serials", () => {
  const [d] = parseDisplays(
    JSON.stringify({
      displays: [
        {
          id: 2,
          name: "Example",
          brightness: 50,
          contrast: null,
          volume: 999,
          serial: "private",
          availableInputs: ["HDMI 1", 3],
          active: true,
        },
      ],
    }),
  );
  expect(d?.brightness).toBe(50);
  expect(d?.contrast).toBeNull();
  expect(d?.volume).toBeNull();
  expect(d?.inputs).toEqual(["HDMI 1"]);
  expect(d).not.toHaveProperty("serial");
});
test("controls validate percentages and command arguments never enter a shell", () => {
  expect(setArgs("2", "brightness", "+5")).toEqual(["set", "-d", "2", "-b", "+5"]);
  expect(() => setArgs("all;bad", "brightness", "20")).toThrow();
  expect(() => setArgs("2", "brightness", "101")).toThrow();
  expect(() => setArgs("2", "input", "20")).toThrow();
  expect(() => presetName("bad\nname")).toThrow();
  expect(
    presetNames("Work: full-state preset [light]\n\tExample: nested detail\nMovie: preset [light]"),
  ).toEqual(["Work", "Movie"]);
});

import { sliderChange, sliderHTML, selectorChange } from "../src/sliders.ts";
import { components } from "../ui/window.ts";
test("slider bridge validates local events and includes keyboard-accessible ranges", () => {
  expect(sliderChange("https://remote.example/#display=2&property=brightness&value=50")).toBeNull();
  expect(sliderChange("about:blank#display=2&property=brightness&value=101")).toBeNull();
  expect(sliderChange("about:blank#display=2&property=brightness&value=50")).toEqual({
    display: "2",
    property: "brightness",
    value: "50",
  });
  expect(sliderHTML()).toContain('type="range"');
  expect(sliderHTML()).toContain('aria-label="Brightness"');
});
test("clicking a display selects its controls instead of opening the Lunar app", () => {
  const values = components();
  const list = values[1]!.components[0];
  expect(list.events.find((e: any) => e.triggers === "actioned").action.args[0]).toBe("select");
});

test("styled selectors route only local, supported actions and escape names", () => {
  expect(selectorChange("about:blank#action=adaptive&display=2&value=synced")).toEqual({
    action: "adaptive",
    display: "2",
    value: "synced",
  });
  expect(selectorChange("https://example.org/#action=adaptive&display=2&value=synced")).toBeNull();
  expect(selectorChange("about:blank#action=execute&display=2&value=anything")).toBeNull();
  const html = sliderHTML(undefined, "⌘[", "⌘K", { adaptive: "off", presets: ["<script>unsafe</script>"] });
  expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
  expect(html).not.toContain("<script>unsafe");
  expect(html).toContain("border-radius:13px");
});
