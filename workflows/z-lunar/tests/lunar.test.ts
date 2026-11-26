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
