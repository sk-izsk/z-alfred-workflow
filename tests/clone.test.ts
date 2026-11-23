import { expect, test } from "bun:test";
import { parseRepo } from "../src/clone.ts";

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
