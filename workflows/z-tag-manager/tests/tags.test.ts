import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { changeTags, readEntry, readRaw, mergeTags, parseImport, validTag, matches } from "../src/tags.ts";
import { create, read, save } from "../src/state.ts";
import { components } from "../ui/window.ts";
const root = mkdtempSync(join(tmpdir(), "finder-tags-test-")),
  path = join(root, "Example.txt");
const previous = { ...process.env };
process.env.alfred_workflow_data = join(root, "data");
process.env.alfred_workflow_cache = join(root, "cache");
writeFileSync(path, "Test");
afterAll(() => {
  for (const k of ["alfred_workflow_data", "alfred_workflow_cache"]) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
  rmSync(root, { recursive: true, force: true });
});
const invoke = (cmd: string, id: string, level: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, id, level, ...args], {
      encoding: "utf8",
      env: process.env,
    }),
  );
test("Finder tag edits round-trip without changing other xattrs or existing colour suffixes", async () => {
  expect((await readEntry(path)).tags).toEqual([]);
  const raw = Buffer.from(JSON.stringify(["Work\n6"]));
  const binary = execFileSync("/usr/bin/plutil", ["-convert", "binary1", "-o", "-", "--", "-"], {
    input: raw,
  });
  execFileSync("/usr/bin/xattr", [
    "-wx",
    "com.apple.metadata:_kMDItemUserTags",
    binary.toString("hex"),
    path,
  ]);
  execFileSync("/usr/bin/xattr", ["-w", "test.example", "preserve", path]);
  expect((await changeTags(path, ["Project", "日本語"])).tags).toEqual(["Work", "Project", "日本語"]);
  expect(await readRaw(path)).toContain("Work\n6");
  await changeTags(path, [], ["Project"]);
  expect((await readEntry(path)).tags).toEqual(["Work", "日本語"]);
  expect(execFileSync("/usr/bin/xattr", ["-p", "test.example", path], { encoding: "utf8" }).trim()).toBe(
    "preserve",
  );
  const link = join(root, "Link");
  symlinkSync(path, link);
  await expect(changeTags(link, ["No"])).rejects.toThrow("symbolic link");
});
test("import validates every path/tag and merging preserves metadata", () => {
  expect(mergeTags(["Work\n6"], ["Work", "New"])).toEqual(["Work\n6", "New\n0"]);
  expect(() => validTag("Bad\nTag")).toThrow();
  expect(() =>
    parseImport(JSON.stringify({ version: 1, entries: [{ path: "relative", tags: ["Test"] }] })),
  ).toThrow("absolute");
  expect(() => parseImport(JSON.stringify({ version: 1, entries: [{ path, tags: [42] }] }))).toThrow();
  expect(() =>
    parseImport(
      JSON.stringify({
        version: 1,
        entries: [
          { path, tags: [] },
          { path, tags: [] },
        ],
      }),
    ),
  ).toThrow("duplicate");
  expect(
    parseImport(JSON.stringify({ version: 1, entries: [{ path, tags: ["Test", "Test"] }] }))[0]!.tags,
  ).toEqual(["Test"]);
  expect(matches({ path, name: "Example", tags: ["Research"] }, "example research")).toBe(true);
});
test("editor Back restores the parent search and selection, stale view events are rejected", () => {
  const s = create("Work");
  s.index.entries = [{ path, name: "Example.txt", tags: ["Work"] }];
  save(s);
  invoke("enter", s.id, s.level, path);
  let current = read(s.id);
  expect(current.mode).toBe("edit");
  invoke("query", s.id, current.level, "New");
  invoke("back", s.id, current.level);
  current = read(s.id);
  expect(current.query).toBe("Work");
  expect(current.selected).toBe(path);
  expect(invoke("query", s.id, s.level, "stale")).toEqual({});
  const menu = JSON.stringify(invoke("menu", s.id, current.level, path));
  expect(menu).toContain("Import Tags");
  expect(menu).toContain("All Alfred File Actions");
  expect(menu).not.toContain('"Back');
  const ui = JSON.stringify(components(current));
  expect(ui).toContain("Back  {var:back_label}");
});

test("changing tags updates the cached index immediately", async () => {
  const { writeJson, cacheDir } = await import("../src/env.ts");
  const { scan, scanSignature } = await import("../src/tags.ts");
  writeJson(join(cacheDir(), "index.json"), {
    entries: [await readEntry(path)],
    signature: scanSignature(),
    fetched: Date.now(),
    limited: false,
    unavailable: 0,
  });
  await changeTags(path, ["Fresh"]);
  expect((await scan()).entries.find((entry) => entry.path === path)?.tags).toContain("Fresh");
});

import { discoveryArgs, tagPredicate } from "../src/tags.ts";
test("default discovery searches the entire indexed system and filters at source before the result limit", () => {
  expect(discoveryArgs("Paid")).not.toContain("-onlyin");
  expect(discoveryArgs("Paid", "/Volumes/SSD")).toContain("/Volumes/SSD");
  expect(tagPredicate("Paid")).toContain('kMDItemUserTags == "*Paid*"cd');
  expect(tagPredicate('x" || bad')).toContain('x\\"');
});

test("file rows show native tag pills and keep full names in tooltips", () => {
  const s = create("");
  s.index.entries = [
    { path, name: "Example.txt", tags: ["Paid", "Development", "Reference", "Fourth", "Fifth"] },
  ];
  save(s);
  const action = invoke("query", s.id, s.level, "");
  const row = action.update.ids.items.data.src[0];
  expect(row["tagText0.text"]).toBe("Paid");
  expect(row["tagText3.text"]).toBe("+2");
  expect(row["tagText3.tooltip"]).toBe("Fourth, Fifth");
  expect(JSON.stringify(components(s))).toContain('"id":"tagPill0"');
});
