import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseRepo } from "../src/clone.ts";
import { parseCloneQuery } from "../src/commands/clonefilter.ts";
import { webUrl } from "../src/git.ts";
import { findRepos } from "../src/scan.ts";

test("parses the common git URL shapes", () => {
  expect(parseRepo("https://github.com/raycast/extensions")?.url).toBe(
    "https://github.com/raycast/extensions.git",
  );
  expect(parseRepo("https://github.com/raycast/extensions/tree/main/extensions")?.name).toBe("extensions");
  expect(parseRepo("github.com/owner/repo")?.label).toBe("github.com/owner/repo");
  expect(parseRepo("git@github.com:owner/repo.git")).toEqual({
    url: "git@github.com:owner/repo.git",
    name: "repo",
    label: "github.com/owner/repo",
  });
  expect(parseRepo("https://gitlab.com/group/sub/repo/-/tree/main")?.label).toBe("gitlab.com/group/sub/repo");
});

test("rejects things that aren't repositories", () => {
  for (const text of ["prettier", "https://github.com", "~/Developer", "ftp://host/a/b", ""]) {
    expect(parseRepo(text)).toBeUndefined();
  }
});

test("codec splits a folder (with spaces) from the URL", () => {
  expect(parseCloneQuery("/Volumes/Mac Mini/Projects https://github.com/o/r")).toMatchObject({
    folder: "/Volumes/Mac Mini/Projects",
    repo: { name: "r" },
  });
  expect(parseCloneQuery("projects")).toEqual({ folder: "projects" });
  expect(parseCloneQuery("git@github.com:o/r.git").folder).toBe("");
});

test("remote URLs become web pages", () => {
  expect(webUrl("git@github.com:o/r.git")).toBe("https://github.com/o/r");
  expect(webUrl("https://gitlab.com/g/r.git")).toBe("https://gitlab.com/g/r");
  expect(webUrl("")).toBe("");
});

test("the folder scan finds repos and skips node_modules and hidden folders", () => {
  const root = mkdtempSync(join(tmpdir(), "vsc-scan-"));
  for (const dir of ["a/.git", "b/c/.git", "node_modules/x/.git", ".hidden/y/.git", "a/inner/.git"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  expect(
    findRepos([root])
      .map((p) => p.slice(root.length + 1))
      .toSorted(),
  ).toEqual(["a", "b/c"]);
});
