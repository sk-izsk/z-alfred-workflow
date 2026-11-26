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
        id: "123:3000",
        pid: 123,
        started: "Wed Nov 25 11:22:33 2026",
        command: "node next",
        cwd: "/tmp/example",
        project: "Example",
        framework: "next",
        port: 3000,
        url: "http://localhost:3000",
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
    expect(rows[0]["serverHeader.text"]).toBe("Example   1 server");
    expect(rows[1]["serverTitle.text"]).toBe("localhost:3000");
    expect(rows[1]["serverNote.text"]).not.toBe("");
  } finally {
    if (prior === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = prior;
    rmSync(root, { recursive: true, force: true });
  }
});
