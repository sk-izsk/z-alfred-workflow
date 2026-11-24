import { expect, test } from "bun:test";
import { EDITORS } from "../src/editors.ts";
import { matches, rootItems } from "../src/commands/root.ts";
import { EDITOR_CHOICES } from "../scripts/plist.ts";

process.env.clone_clipboard = "0"; // keep the real clipboard out of the tests

const titles = async (q: string) => (await rootItems(q)).map((i) => i.title);

test("query words must start words in the title or keywords", () => {
  expect(matches({ title: "Install Extension", words: "marketplace" }, "inst mark")).toBe(true);
  expect(matches({ title: "Install Extension" }, "stall")).toBe(false);
});

test("the vsc menu routes queries", async () => {
  expect(await titles("")).toContain("Search Recent Projects");
  expect((await titles("install prettier"))[0]).toBe("Install Extension");
  expect((await rootItems("install prettier"))[0]).toMatchObject({ arg: "prettier" });
  expect(await titles("https://github.com/owner/repo")).toEqual(["Clone github.com/owner/repo"]);
  expect(await titles("clone git@github.com:o/r.git")).toEqual(["Clone github.com/o/r"]);
  expect((await titles("> Toggle Zen Mode"))[0]).toBe("Run “Toggle Zen Mode”");
  expect(await titles("sync now")).toEqual(["Sync Now"]);
  expect((await titles("some-project")).at(-1)).toBe("Search Recent Projects for “some-project”");
});

test("the Workflow Configuration offers exactly the editors the code knows", () => {
  expect(EDITOR_CHOICES.map(([, id]) => id).toSorted()).toEqual(EDITORS.map((e) => e.id).toSorted());
});
