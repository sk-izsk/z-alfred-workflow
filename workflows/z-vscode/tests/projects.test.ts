import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { branch } from "../src/git.ts";
import { ordered } from "../src/commands/projects.ts";
import { remoteLabel, toProject } from "../src/projects.ts";

test("turns stored entries into projects, dropping ones gone from disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "vsc-"));
  expect(toProject({ folderUri: `file://${dir}` })).toMatchObject({ kind: "folder", path: dir });
  expect(toProject({ folderUri: "file:///nope/gone" })).toBeUndefined();
  expect(
    toProject({
      folderUri: "vscode-remote://ssh-remote+devbox/home/me/api",
      remoteAuthority: "ssh-remote+devbox",
    }),
  ).toMatchObject({ kind: "remote", name: "api", detail: "SSH: devbox", path: "" });
  expect(remoteLabel("wsl+Ubuntu")).toBe("WSL: Ubuntu");
});

test("reads the branch from HEAD, including worktree .git files", () => {
  const repo = mkdtempSync(join(tmpdir(), "vsc-"));
  mkdirSync(join(repo, ".git"));
  writeFileSync(join(repo, ".git", "HEAD"), "ref: refs/heads/feature/x\n");
  expect(branch(repo)).toBe("feature/x");

  const worktree = mkdtempSync(join(tmpdir(), "vsc-"));
  const gitdir = join(repo, ".git", "worktrees", "wt");
  mkdirSync(gitdir, { recursive: true });
  writeFileSync(join(gitdir, "HEAD"), "0123456789abcdef\n");
  writeFileSync(join(worktree, ".git"), `gitdir: ${gitdir}\n`);
  expect(branch(worktree)).toBe("0123456");
  expect(branch(tmpdir())).toBe("");
});

const p = (uri: string) => ({ uri, kind: "folder" as const, name: uri, path: "", detail: "" });

test("pinned projects come first, in pin order", () => {
  const list = [p("a"), p("b"), p("c")];
  expect(ordered(list, ["c", "gone", "a"]).map((x) => x.uri)).toEqual(["c", "a", "b"]);
});
