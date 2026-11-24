import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, readJson, str, untildify, writeJson } from "./env.ts";

const SKIP = new Set(["node_modules", "Library", "vendor", "dist", "build", "target", "Pods", "DerivedData"]);
const MAX_DEPTH = 4;
const STALE_MS = 10 * 60_000;

/** Folders to scan for git repos, from the Workflow Configuration (comma separated). */
export const scanRoots = (): string[] =>
  str("scan_dirs")
    .split(",")
    .map((s) => untildify(s.trim()))
    .filter((s) => s && existsSync(s));

/** Breadth-first: a folder with `.git` is a repo (not descended into); hidden and build folders skipped. */
export const findRepos = (roots: string[], maxDepth = MAX_DEPTH): string[] => {
  const repos: string[] = [];
  let level = roots.map((r) => ({ dir: r, depth: 0 }));
  while (level.length) {
    const next: typeof level = [];
    for (const { dir, depth } of level) {
      if (existsSync(join(dir, ".git"))) {
        repos.push(dir);
        continue;
      }
      if (depth >= maxDepth) continue;
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && !SKIP.has(entry.name)) {
            next.push({ dir: join(dir, entry.name), depth: depth + 1 });
          }
        }
      } catch {
        // unreadable folder: skip
      }
    }
    level = next;
  }
  return repos;
};

type Cache = { at: number; roots: string; repos: string[] };
const file = () => join(cacheDir(), "repos.json");

export const cachedRepos = (): string[] => readJson<Cache>(file(), { at: 0, roots: "", repos: [] }).repos;

/** Rescan when the cache is old or the roots changed. Returns true when something changed. */
export const refreshRepos = (): boolean => {
  const roots = scanRoots();
  const cache = readJson<Cache>(file(), { at: 0, roots: "", repos: [] });
  if (cache.roots === roots.join(",") && Date.now() - cache.at < STALE_MS) return false;
  const repos = roots.length ? findRepos(roots) : [];
  writeJson(file(), { at: Date.now(), roots: roots.join(","), repos });
  return repos.join("\n") !== cache.repos.join("\n");
};
