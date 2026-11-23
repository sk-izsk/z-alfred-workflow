import { expect, test } from "bun:test";
import { EDITORS } from "../src/editors.ts";
import { matches, rootItems } from "../src/commands/root.ts";
import { EDITOR_CHOICES } from "../scripts/plist.ts";

const titles = (q: string) => rootItems(q).map((i) => i.title);

test("query words must start words in the title or keywords", () => {
  expect(matches({ title: "Install Extension", words: "marketplace" }, "inst mark")).toBe(true);
  expect(matches({ title: "Install Extension" }, "stall")).toBe(false);
});

test("the vsc menu routes queries", () => {
  expect(titles("")).toContain("Search Recent Projects");
  expect(titles("install prettier")[0]).toBe("Install Extension");
  expect(rootItems("install prettier")[0]?.arg).toBe("prettier");
  expect(titles("https://github.com/owner/repo")).toEqual(["Clone github.com/owner/repo"]);
  expect(titles("clone git@github.com:o/r.git")).toEqual(["Clone github.com/o/r"]);
  expect(titles("some-project").at(-1)).toBe("Search Recent Projects for “some-project”");
});

test("the Workflow Configuration offers exactly the editors the code knows", () => {
  expect(EDITOR_CHOICES.map(([, id]) => id).toSorted()).toEqual(EDITORS.map((e) => e.id).toSorted());
});
