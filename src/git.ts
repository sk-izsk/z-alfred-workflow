import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { run } from "./proc.ts";

/** `.git` is a folder, or (worktrees, submodules) a file pointing at one. */
const gitDir = (dir: string): string | undefined => {
  const dotGit = join(dir, ".git");
  if (!existsSync(dotGit)) return undefined;
  if (statSync(dotGit).isDirectory()) return dotGit;
  const target = readFileSync(dotGit, "utf8")
    .match(/^gitdir:\s*(.+)$/m)?.[1]
    ?.trim();
  return target && (isAbsolute(target) ? target : join(dir, target));
};

/**
 * Current branch by reading HEAD directly: no `git` process per row, so a 200-project list stays instant.
 * Detached HEAD shows the short commit. Anything unreadable → "".
 */
export const branch = (path: string): string => {
  try {
    const dir = statSync(path).isDirectory() ? path : dirname(path);
    const git = gitDir(dir);
    if (!git) return "";
    const head = readFileSync(join(git, "HEAD"), "utf8").trim();
    return head.startsWith("ref: refs/heads/") ? head.slice(16) : head.slice(0, 7);
  } catch {
    return "";
  }
};

export type GitStatus = { dirty: boolean; ahead: number; behind: number };

/** One `git status` call: uncommitted changes + ahead/behind its upstream. */
export const gitStatus = async (path: string): Promise<GitStatus | undefined> => {
  const { code, stdout } = await run("/usr/bin/git", ["-C", path, "status", "--porcelain=v2", "--branch"], {
    timeoutMs: 5000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, // never take the index lock from a running editor
  });
  if (code !== 0) return undefined;
  const ab = stdout.match(/^# branch\.ab \+(\d+) -(\d+)$/m);
  return {
    dirty: stdout.split("\n").some((l) => l && !l.startsWith("#")),
    ahead: Number(ab?.[1] ?? 0),
    behind: Number(ab?.[2] ?? 0),
  };
};

/** `origin`'s URL from .git/config, or "". */
export const remoteUrl = (path: string): string => {
  try {
    const dir = statSync(path).isDirectory() ? path : dirname(path);
    const git = gitDir(dir);
    if (!git) return "";
    // Worktrees keep config in the common dir.
    const common = existsSync(join(git, "commondir"))
      ? join(git, readFileSync(join(git, "commondir"), "utf8").trim())
      : git;
    const config = readFileSync(join(common, "config"), "utf8");
    return config.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/)?.[1] ?? "";
  } catch {
    return "";
  }
};

/** git@github.com:o/r.git / ssh://… / https://…git → https://github.com/o/r */
export const webUrl = (remote: string): string => {
  const scp = remote.match(/^[\w.-]+@([\w.-]+):(.+?)(?:\.git)?$/);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  try {
    const url = new URL(remote);
    return `https://${url.hostname}${url.pathname.replace(/\.git$/, "")}`;
  } catch {
    return "";
  }
};
