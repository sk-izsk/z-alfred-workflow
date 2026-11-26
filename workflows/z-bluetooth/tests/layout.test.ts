import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { create, save } from "../src/state.ts";
import { components } from "../ui/window.ts";
import { expect, test } from "bun:test";
const ids = (value: any, result = new Set<string>()): Set<string> => {
  if (value && typeof value === "object") {
    if (value.id) result.add(value.id);
    for (const child of Object.values(value)) ids(child, result);
  }
  return result;
};
test("reference layout preserves native row bindings and accessory data", () => {
  const root = mkdtempSync(join(tmpdir(), "reference-layout-")),
    prior = process.env.alfred_workflow_cache;
  process.env.alfred_workflow_cache = root;
  try {
    const s = create("", "");
    s.rows = [
      {
        id: "AA:BB:CC:DD:EE:FF",
        name: "Example Headphones",
        type: "Headphones",
        connected: true,
        battery: "Left 72% · Right 74%",
        batteries: [
          { part: "left", percent: 72 },
          { part: "right", percent: 74 },
        ],
        raw: {},
      },
    ];
    save(s);
    const action = JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "query", s.id, ""], {
        encoding: "utf8",
        env: process.env,
      }),
    );
    const rows = action.update.ids.items.data.src;
    const known = ids(components());
    for (const row of [...rows, ...(action.update.ids.details?.data.src || [])])
      for (const key of Object.keys(row))
        if (key.includes(".")) expect(known.has(key.split(".")[0]!)).toBe(true);
    expect(rows[0]["batteryText0.text"]).toBe("72%");
    expect(rows[0]["batteryIcon1.image.src"]).toBe("r.circle");
    expect(rows[0]["rowDescription.text"]).not.toContain("72%");
  } finally {
    if (prior === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = prior;
    rmSync(root, { recursive: true, force: true });
  }
});
