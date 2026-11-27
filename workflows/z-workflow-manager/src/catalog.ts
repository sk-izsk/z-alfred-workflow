import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, lstatSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, dirname } from "node:path";
import { cacheDir, readJson, writeJson, str } from "./env.ts";
import { repositoryEntries } from "./repository.ts";
export type Entry = {
  uid: string;
  name: string;
  description: string;
  bundle: string;
  version: string;
  latest: string;
  url: string;
  path: string;
  icon: string;
  source: "gallery" | "repository" | "unknown";
  download?: string;
  development?: boolean;
};
export type Gallery = {
  creators: Record<
    string,
    {
      workflows: Record<string, { name: string; description?: string; bundleIDs: string[]; version: string }>;
    }
  >;
};
const parseVersion = (s: string) =>
  /^v?\d+(?:\.\d+)*$/.test(s) ? s.replace(/^v/, "").split(".").map(Number) : null;
export const newer = (a: string, b: string): boolean => {
  const x = parseVersion(a),
    y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};
export const preferencesRoot = (): string => {
  const configured = str("preferences_path");
  if (configured) return configured;
  try {
    const sync = execFileSync(
      "/usr/bin/defaults",
      ["read", "com.runningwithcrayons.Alfred-Preferences", "syncfolder"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
      .trim()
      .replace(/^~(?=\/)/, homedir());
    if (sync) return join(sync, "Alfred.alfredpreferences/workflows");
  } catch {
    // no custom Alfred preferences folder: use the default
  }
  return join(homedir(), "Library/Application Support/Alfred/Alfred.alfredpreferences/workflows");
};
export const scan = (root = preferencesRoot()): Entry[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((uid) => {
    try {
      const path = join(root, uid),
        p = JSON.parse(
          execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", join(path, "info.plist")], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 1500,
          }),
        );
      return [
        {
          uid,
          name: String(p.name || uid),
          description: String(p.description || ""),
          bundle: String(p.bundleid || ""),
          version: String(p.version || ""),
          latest: "",
          url: "",
          path,
          icon: existsSync(join(path, "icon.png")) ? join(path, "icon.png") : "../icon.png",
          source: "unknown" as const,
          development: lstatSync(path).isSymbolicLink(),
        },
      ];
    } catch {
      return [];
    }
  });
};
export const galleryEntries = (raw: Gallery): Entry[] =>
  Object.entries(raw.creators).flatMap(([creator, v]) =>
    Object.entries(v.workflows).flatMap(([slug, w]) => {
      if (!/^[a-z0-9-]+$/i.test(creator) || !/^[a-z0-9-]+$/i.test(slug) || !Array.isArray(w.bundleIDs))
        return [];
      return w.bundleIDs.map((bundle) => ({
        uid: `gallery:${creator}/${slug}:${bundle}`,
        name: w.name,
        description: w.description || "",
        bundle,
        version: "",
        latest: w.version,
        url: `https://alfred.app/workflows/${creator}/${slug}/`,
        path: "",
        icon: "../icon.png",
        source: "gallery" as const,
      }));
    }),
  );
export const combine = (local: Entry[], remote: Entry[]): Entry[] => {
  const byBundle = new Map(remote.map((e) => [e.bundle, e])),
    found = new Set(local.map((e) => e.bundle));
  const installedURLs = new Set(local.map((e) => byBundle.get(e.bundle)?.url).filter(Boolean));
  const seen = new Set<string>();
  return [
    ...local.map((e) => {
      const r = byBundle.get(e.bundle);
      return r ? { ...e, latest: r.latest, url: r.url, source: r.source, download: r.download } : e;
    }),
    ...remote.filter(
      (e) => !found.has(e.bundle) && !installedURLs.has(e.url) && !seen.has(e.url) && !!seen.add(e.url),
    ),
  ].toSorted((a, b) => a.name.localeCompare(b.name));
};
export const catalog = async (
  fresh = false,
): Promise<{ entries: Entry[]; fetched: number; stale: boolean }> => {
  const path = join(cacheDir(), "catalog.json"),
    old = readJson<{ entries: Entry[]; fetched: number; stale?: boolean } | null>(path, null),
    minutes = Number(str("cache_minutes", "60"));
  if (old && !fresh && Date.now() - old.fetched < Math.max(1, Math.min(10080, minutes || 60)) * 60000)
    return { ...old, stale: !!old.stale };
  try {
    const r = await fetch("https://alfred.app/data/gallery.json", {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Gallery HTTP ${r.status}`);
    const text = await r.text();
    if (text.length > 8e6) throw new Error("Gallery catalog too large.");
    let entries = galleryEntries(JSON.parse(text));
    let stale = false;
    try {
      const response = await fetch(
        "https://api.github.com/repos/sk-izsk/z-alfred-workflow/releases?per_page=100",
        { signal: AbortSignal.timeout(10000), headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok) throw new Error(`Repository HTTP ${response.status}`);
      entries = [...entries, ...repositoryEntries(await response.json())];
    } catch {
      stale = true;
      entries = [...entries, ...(old?.entries.filter((e) => e.source === "repository") || [])];
    }
    if (!entries.length) throw new Error("Empty Gallery catalog.");
    const value = { entries, fetched: Date.now(), stale };
    writeJson(path, value);
    return value;
  } catch (e) {
    if (old) return { ...old, stale: true };
    throw e;
  }
};
export const installer = (entry: Entry): string => {
  if (
    entry.source === "gallery" &&
    /^https:\/\/alfred\.app\/workflows\/[a-z0-9-]+\/[a-z0-9-]+\/$/i.test(entry.url)
  )
    return entry.url.replace("https://alfred.app/workflows/", "alfred://gallery/workflow/");
  if (
    entry.source === "repository" &&
    entry.download &&
    entry.download.startsWith("https://github.com/sk-izsk/z-alfred-workflow/releases/download/")
  )
    return entry.download;
  throw new Error("No verified installer source for this workflow.");
};
export const removalTarget = (entry: Entry, root = preferencesRoot()): string => {
  if (
    !entry.path ||
    dirname(entry.path) !== root ||
    basename(entry.path) !== entry.uid ||
    !entry.uid.startsWith("user.workflow.")
  )
    throw new Error("Workflow location is no longer valid.");
  const current = scan(root).find((e) => e.uid === entry.uid);
  if (!current || current.bundle !== entry.bundle)
    throw new Error("Installed workflow changed; refresh before removing.");
  if (entry.bundle === "com.izsk.workflow-manager")
    throw new Error("Remove Workflow Manager from Alfred Preferences.");
  return entry.path;
};
export const removeInstalled = (entry: Entry): void => {
  const path = removalTarget(entry);
  if (lstatSync(path).isSymbolicLink()) {
    const trash = join(homedir(), ".Trash");
    mkdirSync(trash, { recursive: true });
    renameSync(path, join(trash, `${entry.uid}-${Date.now()}`));
    return;
  }
  // Finder moves a regular installed workflow to Trash. Development links use rename above.
  execFileSync(
    "/usr/bin/osascript",
    ["-e", 'on run argv\ntell application "Finder" to delete POSIX file (item 1 of argv)\nend run', path],
    { timeout: 10000 },
  );
};
