import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { create, read, save } from "../src/state.ts";
import { components } from "../ui/window.ts";
import { referenceData } from "../../../shared/reference-rows.ts";
import type { State } from "../src/state.ts";
import { statusItems, previewItems } from "../src/presentation.ts";
import { expect, test } from "bun:test";
import { commandArgs, parseAnalysis, cleanOutput, shellQuote, execution } from "../src/mole.ts";
test("previews always use dry-run and command selection is closed", () => {
  expect(commandArgs("clean")).toEqual(["clean", "--dry-run"]);
  expect(commandArgs("optimize")).toEqual(["optimize", "--dry-run"]);
  expect(commandArgs("analyze", "/Volumes/My SSD")).toEqual(["analyze", "--json", "/Volumes/My SSD"]);
  expect(() => commandArgs("analyze", "relative")).toThrow();
  expect(() => execution("remove")).toThrow();
  expect(shellQuote("a'b")).toBe("'a'\\''b'");
});
test("status handles nullable sections and analysis validates native entry types", () => {
  const status = statusItems(
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

test("grouped previews preserve real summary sizes/counts without claiming changes ran", () => {
  const clean = previewItems(
    "➤ User essentials\n ○ User app cache · 2 items, 522.4MB dry\n ◎ Trash · skipped, grant access\n➤ Browsers\n ○ Browser cache · 20KB dry\nPotential space: 1.11GB · 110 items",
    "clean",
  );
  expect(clean[0]!.badge).toBe("1.11GB");
  expect(clean[0]!.description).toBe("110 items");
  expect(clean[1]!.group).toBe("User essentials");
  expect(clean[1]!.badge).toBe("522.4MB");
  expect(clean[2]!.badge).toBe("Skipped");
  const opt = previewItems(
    "➤ Finder Cache Refresh\n ○ QuickLook thumbnails refreshed\nWould apply 2 optimizations",
    "optimize",
  );
  expect(opt[0]!.badge).toBe("2 optimizations");
  expect(opt[1]!.details[1]![1]).toContain("not executed");
  expect(() => previewItems("unsupported output", "clean")).toThrow("Unsupported");
});
test("native layouts keep reference grouping/badges and contain no web view", () => {
  const s = {
    mode: "clean",
    query: "",
    path: "",
    items: [],
    status: "Loading…",
    selected: "",
  } as unknown as State;
  const items = previewItems(
    "➤ User essentials\n ○ Cache · 10MB dry\nPotential space: 10MB · 2 items",
    "clean",
  );
  const rows = referenceData(items, "mole");
  expect(rows[0]!.header).toBe(true);
  expect(rows.some((row) => row["moleBadgeLabel.text"] === "10MB")).toBe(true);
  expect(JSON.stringify(components(s))).not.toContain("webkitview");
  expect(JSON.stringify(components({ ...s, mode: "status" }))).toContain('"id":"details"');
  expect(JSON.stringify(components(s))).not.toContain('"id":"details"');
});

test("folder Back restores the prior path/query/selection/scroll and previews cannot execute while loading", () => {
  const dir = mkdtempSync(join(tmpdir(), "mole-nav-test-")),
    prior = process.env.alfred_workflow_cache;
  process.env.alfred_workflow_cache = dir;
  try {
    const s = create("", "");
    s.mode = "analyze";
    s.path = "/tmp/Example";
    s.query = "Docs";
    s.selected = "/tmp/Example/Docs";
    s.scroll = 80;
    s.ready = true;
    s.items = [
      {
        id: s.selected,
        name: "Docs",
        description: "1 MB",
        icon: "folder",
        path: s.selected,
        directory: true,
        details: [["Bytes", "1048576"]],
      },
    ];
    save(s);
    const call = (command: string, ...args: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), command, s.id, ...args], {
          encoding: "utf8",
          env: process.env,
        }),
      );
    const opened = call("open", s.selected);
    expect(JSON.stringify(opened)).toContain("dataview");
    expect(JSON.stringify(opened)).not.toContain("webkitview");
    expect(read(s.id).path).toBe("/tmp/Example/Docs");
    call("back");
    const restored = read(s.id);
    expect([restored.path, restored.query, restored.selected, restored.scroll]).toEqual([
      s.path,
      s.query,
      s.selected,
      80,
    ]);
    restored.mode = "clean";
    restored.ready = false;
    save(restored);
    expect(call("open").sheet).toBeUndefined();
  } finally {
    if (prior === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});
