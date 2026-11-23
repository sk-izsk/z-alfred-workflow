import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

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
