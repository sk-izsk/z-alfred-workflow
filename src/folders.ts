import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { untildify } from "./env.ts";
import { run } from "./proc.ts";

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const subdirs = (dir: string, prefix = ""): string[] => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() && !e.name.startsWith(".") && e.name.toLowerCase().startsWith(prefix.toLowerCase()),
      )
      .map((e) => join(dir, e.name))
      .slice(0, 30);
  } catch {
    return [];
  }
};

/**
 * Folder suggestions while typing, like a File Filter:
 * a path (`/…`, `~/…`) completes from disk; a plain word asks Spotlight for folders with that name.
 */
export const suggestFolders = async (text: string): Promise<string[]> => {
  const t = text.trim();
  if (!t) return [];
  if (/^[~/]/.test(t)) {
    const path = untildify(t);
    return t.endsWith("/") && isDir(path) ? subdirs(path) : subdirs(dirname(path), basename(path));
  }
  const safe = t.replace(/["\\*]/g, "");
  const { stdout } = await run(
    "/usr/bin/mdfind",
    [`kMDItemContentType == "public.folder" && kMDItemDisplayName == "*${safe}*"cd`],
    { timeoutMs: 3000 },
  );
  return (
    stdout
      .split("\n")
      .filter((p) => p && !p.includes("/Library/") && !p.includes("/node_modules/") && !/\/\./.test(p))
      // Exact name first, then the shallowest paths: project folders, not folders deep inside dependencies.
      .toSorted(
        (a, b) =>
          Number(basename(b).toLowerCase() === safe.toLowerCase()) -
            Number(basename(a).toLowerCase() === safe.toLowerCase()) ||
          a.split("/").length - b.split("/").length,
      )
      .slice(0, 20)
  );
};

export const existingDir = (text: string): string | undefined => {
  const path = untildify(text.trim()).replace(/\/+$/, "") || "/";
  return text.trim() && existsSync(path) && isDir(path) ? path : undefined;
};
