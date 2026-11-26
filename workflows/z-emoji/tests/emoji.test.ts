import { expect, test, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { emojis, search, variants, favorite, preferences, record } from "../src/emoji.ts";
import { create, read, save } from "../src/state.ts";
const root = mkdtempSync(join(tmpdir(), "emoji-test-")),
  before = { ...process.env };
process.env.alfred_workflow_data = join(root, "data");
process.env.alfred_workflow_cache = join(root, "cache");
afterAll(() => {
  for (const k of ["alfred_workflow_data", "alfred_workflow_cache"]) {
    if (before[k] === undefined) delete process.env[k];
    else process.env[k] = before[k];
  }
  rmSync(root, { recursive: true, force: true });
});
test("offline catalog includes flags, joined sequences and tone variants", () => {
  expect(emojis.length).toBeGreaterThan(3900);
  expect(search("Bangladesh", "All")[0]?.emoji).toBe("🇧🇩");
  const thumb = emojis.find((e) => e.emoji === "👍")!;
  expect(variants(thumb).map((e) => e.emoji)).toContain("👍🏽");
  expect(search(":grinning_face:", "All").length).toBeGreaterThan(0);
});
test("favorite and recent IDs persist and duplicate use moves an item to the front", () => {
  const one = emojis[0]!.id,
    two = emojis[1]!.id;
  favorite(one);
  expect(search("", "Favorites")[0]?.id).toBe(one);
  record(one);
  record(two);
  record(one);
  expect(preferences().recent).toEqual([one, two]);
  favorite(one);
  expect(preferences().favorites).toEqual([]);
});
test("variants Back restores the exact category, query and selection", () => {
  const entry = emojis.find((e) => e.emoji === "👍")!,
    s = create("thumb", "");
  s.category = "All";
  s.selected = entry.id;
  save(s);
  const invoke = (cmd: string, ...args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, s.id, ...args], {
        encoding: "utf8",
        env: process.env,
      }),
    );
  invoke("variants", entry.id);
  expect(read(s.id).parent).toBe(entry.id);
  invoke("back");
  expect(read(s.id).query).toBe("thumb");
  expect(read(s.id).selected).toBe(entry.id);
  const menu = JSON.stringify(invoke("menu", entry.id));
  expect(menu).toContain("Paste Emoji");
  expect(menu).not.toContain('"Back');
});
