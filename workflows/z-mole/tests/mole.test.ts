import { expect, test } from "bun:test";
import { commandArgs, parseAnalysis, parseStatus, cleanOutput, shellQuote, execution } from "../src/mole.ts";
test("previews always use dry-run and command selection is closed", () => {
  expect(commandArgs("clean")).toEqual(["clean", "--dry-run"]);
  expect(commandArgs("optimize")).toEqual(["optimize", "--dry-run"]);
  expect(commandArgs("analyze", "/Volumes/My SSD")).toEqual(["analyze", "--json", "/Volumes/My SSD"]);
  expect(() => commandArgs("analyze", "relative")).toThrow();
  expect(() => execution("remove")).toThrow();
  expect(shellQuote("a'b")).toBe("'a'\\''b'");
});
test("status handles nullable sections and analysis validates native entry types", () => {
  const status = parseStatus(
    JSON.stringify({ hardware: { model: "Example" }, health_score: 92, batteries: null }),
  );
  expect(status.find((e) => e.id === "batteries")?.details[0]?.[1]).toBe("Unavailable");
  const analysis = parseAnalysis(
    JSON.stringify({
      entries: [
        { name: "Demo", path: "/tmp/Demo", size: 123, is_dir: true },
        { path: "relative", name: "Bad", size: 1, is_dir: false },
      ],
    }),
  );
  expect(analysis).toHaveLength(1);
  expect(analysis[0]!.directory).toBe(true);
  expect(cleanOutput("\x1b[32mPreview\x1b[0m\rDone")).toEqual(["Preview", "Done"]);
});
