import { lstat, readdir, readFile, realpath, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, relative, basename, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { dataDir, readJson, str, writeJson } from "./env.ts";
import { apple, command, git } from "./proc.ts";
import { hostname } from "./api.ts";
import type { Row } from "./model.ts";
const expand = (p: string) => (p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
export const scanRoots = (): string[] =>
  str("repo_paths", "~/Developer\n~/Projects")
    .split(/[\n;]/)
    .map((p) => expand(p.trim()))
    .filter((p) => isAbsolute(p) && existsSync(p));
export type LocalPrefs = { favorites: string[]; usage: Record<string, number> };
export const localPrefs = (): LocalPrefs =>
  readJson(join(dataDir(), "local.json"), { favorites: [], usage: {} });
export const favorite = (path: string): void => {
  const p = localPrefs();
  p.favorites = p.favorites.includes(path) ? p.favorites.filter((v) => v !== path) : [...p.favorites, path];
  writeJson(join(dataDir(), "local.json"), p);
};
export const recordUse = (path: string): void => {
  const p = localPrefs();
  p.usage[path] = Date.now();
  writeJson(join(dataDir(), "local.json"), p);
};
export const remoteURL = (input: string): string => {
  if (/\s|::/.test(input)) throw new Error("Unsupported Git remote.");
  const scp = input.match(/^([^@\s]+@)?([^/:\s]+):(.+)$/);
  let value = input;
  if (scp && !input.includes("://")) value = `https://${scp[2]}/${scp[3]}`;
  const u = new URL(value);
  if (!["https:", "http:", "ssh:", "git:"].includes(u.protocol)) throw new Error("Unsupported Git remote.");
  if (u.protocol !== "https:" && u.protocol !== "http:") u.protocol = "https:";
  // Rebuild because URL refuses changing between special and non-special protocols.
  return `https://${u.host}/${u.pathname
    .replace(/^\//, "")
    .replace(/\.git\/?$/, "")
    .replace(/\/$/, "")}`;
};
export const scan = async (): Promise<Row[]> => {
  const roots = scanRoots();
  if (!roots.length) throw new Error("Set local repository scan folders in Workflow’s Configuration.");
  const depth = Math.min(20, Math.max(1, Number(str("scan_depth", "5")) || 5));
  const pending = roots.map((path) => ({ path, depth: 0 })),
    seen = new Set<string>(),
    rows: Row[] = [];
  let visited = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++visited > 100_000)
      throw new Error("Scan exceeded 100,000 folders. Narrow the scan folders or depth.");
    let canonical: string;
    try {
      canonical = await realpath(item.path);
    } catch {
      continue;
    }
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    let entries;
    try {
      entries = await readdir(canonical, { withFileTypes: true });
    } catch {
      continue;
    }
    const dotgit = entries.find((e) => e.name === ".git");
    if (dotgit) {
      let type = "repo",
        remote = "",
        remotes: Record<string, string> = {};
      if (dotgit.isFile()) {
        try {
          const content = await readFile(join(canonical, ".git"), "utf8");
          type = content.includes("/worktrees/") ? "worktree" : "submodule";
        } catch {
          continue;
        }
      }
      if (type !== "submodule" || str("include_submodules", "1") === "1") {
        try {
          const names = (await git(["remote"], canonical)).split("\n").filter(Boolean);
          for (const name of names) {
            try {
              remotes[name] = remoteURL(await git(["remote", "get-url", name], canonical));
            } catch {
              /* Local or unsupported transport has no browser URL. */
            }
          }
          remote = remotes.origin || Object.values(remotes)[0] || "";
        } catch {
          /* A repository can have no remote. */
        }
        const prefs = localPrefs();
        rows.push({
          id: canonical,
          title: basename(canonical),
          subtitle: canonical.replace(homedir(), "~"),
          accessory: `${prefs.favorites.includes(canonical) ? "★ · " : ""}${type}`,
          kind: "local",
          path: canonical,
          url: remote,
          icon: `git-repos/git-${type === "repo" ? "icon" : type + "-icon"}.png`,
          raw: { type, remotes, favorite: prefs.favorites.includes(canonical) },
        });
      }
    }
    if (item.depth >= depth) continue;
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        [".git", "node_modules", ".Trash", ".cache", "Library", "dist", "build", "vendor", ".venv"].includes(
          entry.name,
        )
      )
        continue;
      pending.push({ path: join(canonical, entry.name), depth: item.depth + 1 });
    }
  }
  const prefs = localPrefs();
  return rows.toSorted(
    (a, b) =>
      Number(prefs.favorites.includes(b.id)) - Number(prefs.favorites.includes(a.id)) ||
      (prefs.usage[b.id] || 0) - (prefs.usage[a.id] || 0) ||
      a.title.localeCompare(b.title),
  );
};
export const localPath = async (path: string): Promise<string> => {
  const canonical = await realpath(path);
  if (canonical === homedir() || canonical === "/")
    throw new Error("This folder cannot be used as a repository.");
  if (!existsSync(join(canonical, ".git")))
    throw new Error("This repository no longer exists. Refresh the list.");
  const allowed = await Promise.all(
    scanRoots().map(async (p) => {
      const root = await realpath(p);
      const rel = relative(root, canonical);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    }),
  );
  if (!allowed.some(Boolean)) throw new Error("Repository is outside the configured scan folders.");
  return canonical;
};
export const removalCheck = async (path: string): Promise<void> => {
  const canonical = await localPath(path);
  const dotgit = await lstat(join(canonical, ".git"));
  if (!dotgit.isDirectory())
    throw new Error("Remove linked worktrees or submodules with Git, not Remove Repository.");
  if (await git(["status", "--porcelain", "--untracked-files=all"], canonical))
    throw new Error(
      "Repository has uncommitted or untracked files. Use Force Remove only if you intend to discard them.",
    );
  const unpushed = await git(["rev-list", "--branches", "--not", "--remotes", "--count"], canonical);
  if (Number(unpushed) > 0)
    throw new Error(
      "Repository has commits that are not present in its known remote-tracking refs. Fetch and push first, or explicitly Force Remove.",
    );
};
export const trash = async (path: string, force = false): Promise<void> => {
  const canonical = await localPath(path);
  if (!(await lstat(join(canonical, ".git"))).isDirectory())
    throw new Error("Linked worktrees and submodules cannot be trashed here.");
  if (!force) await removalCheck(canonical);
  await apple('tell application "Finder" to delete (POSIX file (item 1 of argv))', [canonical]);
};
export const clone = async (url: string, parent: string, name = ""): Promise<string> => {
  if (!/^(https:\/\/[^\s]+|ssh:\/\/[^\s]+|[^\s@]+@[^\s:]+:[^\s]+)$/.test(url))
    throw new Error("Use an HTTPS or SSH Git URL.");
  const dir = await realpath(expand(parent));
  await access(dir);
  const defaultName = basename(url.replace(/\/$/, "")).replace(/\.git$/, "");
  const folder = name || defaultName;
  if (!/^[^/\\\0]+$/.test(folder) || [".", ".."].includes(folder))
    throw new Error("Invalid repository folder name.");
  const target = resolve(dir, folder);
  if (existsSync(target)) throw new Error("Destination already exists. Choose another folder.");
  await command("/usr/bin/git", ["clone", "--", url, target], "", dir, 180_000);
  return target;
};
export const openLocal = async (path: string, application: string): Promise<void> => {
  const canonical = await localPath(path);
  let target = canonical;
  if (
    /^(Safari|Google Chrome|Firefox|Arc|Brave Browser|Microsoft Edge|Vivaldi|Opera)(\.app)?$/i.test(
      application,
    )
  ) {
    try {
      target = remoteURL(await git(["remote", "get-url", "origin"], canonical));
    } catch {
      /* A local-only repo has no browser destination. */
    }
  }
  await command("/usr/bin/open", ["-a", application, target]);
  recordUse(canonical);
};
export const openWithApps = (): string[] =>
  str("open_apps", "Visual Studio Code\nXcode\nFork\niTerm\nFinder")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
export const quicklink = (row: Row): string =>
  `alfred://runtrigger/com.izsk.github/open-local/?argument=${encodeURIComponent(row.path || "")}`;
export const githubRepo = (row: Row): string => {
  const remotes = Object.values((row.raw.remotes as Record<string, string>) || {});
  for (const value of [row.url || "", ...remotes]) {
    try {
      const u = new URL(value);
      if (u.hostname === hostname()) return u.pathname.replace(/^\//, "");
    } catch {
      /* Try the next remote. */
    }
  }
  throw new Error("This repository has no remote on the configured GitHub server.");
};
