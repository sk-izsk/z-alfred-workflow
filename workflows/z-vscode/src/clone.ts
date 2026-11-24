import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { str, untildify } from "./env.ts";
import { run } from "./proc.ts";

export type Repo = { url: string; name: string; label: string };

/**
 * A clonable git URL: https://host/owner/repo(.git), git@host:owner/repo(.git), ssh://…, git://….
 * Also bare `github.com/owner/repo`. Browser URLs like `…/tree/main/src` are trimmed to the repo.
 */
export const parseRepo = (input: string): Repo | undefined => {
  const text = input.trim();
  const scp = text.match(/^([\w.-]+@[\w.-]+):([\w.-]+(?:\/[\w.-]+)+?)(?:\.git)?\/?$/);
  if (scp) return repo(text, scp[2]!, scp[1]!.split("@")[1]!);
  const withScheme = /^[a-z+]+:\/\//i.test(text)
    ? text
    : /^[\w-]+(\.[\w-]+)+\/[\w.-]+\/[\w.-]+/.test(text)
      ? `https://${text}`
      : "";
  if (!withScheme) return undefined;
  try {
    const url = new URL(withScheme);
    if (!["https:", "http:", "ssh:", "git:", "git+ssh:"].includes(url.protocol)) return undefined;
    const parts = url.pathname
      .replace(/\.git\/?$/, "")
      .split("/")
      .filter(Boolean);
    if (parts.length < 2) return undefined;
    // GitHub/GitLab browser URLs: keep owner/repo (GitLab subgroups go before a `-` segment).
    const dash = parts.indexOf("-");
    const keep =
      dash > 1
        ? parts.slice(0, dash)
        : /github\.com|bitbucket\.org/.test(url.host)
          ? parts.slice(0, 2)
          : parts;
    const path = keep.join("/");
    const clean = url.protocol.startsWith("http") ? `${url.protocol}//${url.host}/${path}.git` : text;
    return repo(clean, path, url.host);
  } catch {
    return undefined;
  }
};

const repo = (url: string, path: string, host: string): Repo => ({
  url,
  name: basename(path).replace(/\.git$/, ""),
  label: `${host}/${path.replace(/\.git$/, "")}`,
});

export const defaultCloneDir = (): string => untildify(str("clone_dir", "~/Developer"));

export const targetPath = (parent: string, name: string): string => join(untildify(parent.trim()), name);

/** Clone into `dest`. An existing folder isn't touched: it's simply opened. */
export const cloneRepo = async (url: string, dest: string): Promise<"cloned" | "exists"> => {
  if (existsSync(dest)) return "exists";
  const { code, stderr } = await run("/usr/bin/git", ["clone", "--", url, dest], {
    timeoutMs: 15 * 60_000,
    // No TTY to answer a password prompt: fail fast instead of hanging (SSH keys and the Keychain still work).
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (code !== 0) throw new Error(stderr.trim().split("\n").pop() || "git clone failed");
  return "cloned";
};
