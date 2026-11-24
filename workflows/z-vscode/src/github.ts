import { existsSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { run } from "./proc.ts";

export type GhRepo = { name: string; description: string; url: string; private: boolean };

const GH = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"].find(existsSync);
const STALE_MS = 10 * 60_000;

export const ghInstalled = (): boolean => !!GH;

const gh = async (args: string[]): Promise<unknown> => {
  if (!GH) throw new Error("GitHub CLI (gh) not found: brew install gh");
  const { code, stdout, stderr } = await run(GH, args, { timeoutMs: 15_000 });
  if (code !== 0) throw new Error(stderr.trim().split("\n")[0] || "gh failed (try `gh auth login`)");
  return JSON.parse(stdout);
};

type Cache = { at: number; repos: GhRepo[] };
const file = () => join(cacheDir(), "gh-repos.json");

/** Your repos (incl. private), cached for 10 minutes. */
export const myRepos = async (): Promise<GhRepo[]> => {
  const cache = readJson<Cache>(file(), { at: 0, repos: [] });
  if (Date.now() - cache.at < STALE_MS && cache.repos.length) return cache.repos;
  const list = (await gh([
    "repo",
    "list",
    "--limit",
    "300",
    "--json",
    "nameWithOwner,description,url,isPrivate",
  ])) as {
    nameWithOwner: string;
    description: string | null;
    url: string;
    isPrivate: boolean;
  }[];
  const repos = list.map((r) => ({
    name: r.nameWithOwner,
    description: r.description ?? "",
    url: r.url,
    private: r.isPrivate,
  }));
  writeJson(file(), { at: Date.now(), repos });
  return repos;
};

/** Public search across GitHub. */
export const searchRepos = async (query: string): Promise<GhRepo[]> => {
  const list = (await gh([
    "search",
    "repos",
    query,
    "--limit",
    "15",
    "--json",
    "fullName,description,url,isPrivate",
  ])) as {
    fullName: string;
    description: string | null;
    url: string;
    isPrivate: boolean;
  }[];
  return list.map((r) => ({
    name: r.fullName,
    description: r.description ?? "",
    url: r.url,
    private: r.isPrivate,
  }));
};
