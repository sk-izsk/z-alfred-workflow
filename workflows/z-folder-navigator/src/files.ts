import { spawn } from "node:child_process";
import { stat, readdir, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, basename, dirname, isAbsolute } from "node:path";
import { str, bool } from "./env.ts";
export type Item = {
  uid: string;
  name: string;
  kind: "folder" | "file" | "package" | "link";
  directory: boolean;
  link: boolean;
};
export const pathInput = (raw: string): string => {
  const value = raw.trim().replace(/^~(?=\/|$)/, homedir());
  if (!isAbsolute(value) || value.includes("\0"))
    throw new Error("Enter an absolute folder path or a path beginning with ~/.");
  return resolve(value);
};
export const packagePath = (path: string): boolean =>
  /\.(?:app|bundle|framework|photoslibrary|photolibrary|band|pages|numbers|key|rtfd|xcodeproj|xcworkspace|playground)$/i.test(
    path,
  );
export const item = async (path: string): Promise<Item> => {
  const link = (await lstat(path)).isSymbolicLink();
  let directory = false;
  try {
    directory = (await stat(path)).isDirectory();
  } catch {
    if (!link) throw new Error("Item no longer exists.");
  }
  return {
    uid: path,
    name: basename(path) || path,
    directory,
    link,
    kind: directory ? (packagePath(path) ? "package" : "folder") : link ? "link" : "file",
  };
};
export const fold = (text: string): string => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export const matches = (entry: Item, query: string): boolean =>
  fold(query)
    .split(/\s+/)
    .every((word) => fold(entry.name).includes(word));
export const roots = (): string[] => [
  ...new Set(str("search_roots", "~;/Volumes").split(/[;\n]/).filter(Boolean).map(pathInput)),
];
export const mountedDrives = async (root = "/Volumes"): Promise<string[]> => {
  try {
    const parent = await stat(root),
      entries = await readdir(root, { withFileTypes: true });
    const values = await Promise.allSettled(
      entries
        .filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith("."))
        .map(async (e) => {
          const path = resolve(root, e.name),
            info = await stat(path);
          return info.dev !== parent.dev ? path : "";
        }),
    );
    return values.flatMap((v) => (v.status === "fulfilled" && v.value ? [v.value] : [])).toSorted();
  } catch {
    return [];
  }
};
export const favorites = async (): Promise<string[]> => [
  ...new Set([
    ...(bool("show_volumes", true) ? await mountedDrives() : []),
    ...str("favorite_folders", "~;~/Desktop;~/Documents;~/Downloads;/Applications;/Volumes")
      .split(/[;\n]/)
      .filter(Boolean)
      .map(pathInput),
  ]),
];
export const children = async (
  path: string,
  hidden = false,
  query = "",
): Promise<{ items: Item[]; limited: boolean }> => {
  const entries = await readdir(path, { withFileTypes: true }),
    visible = entries.filter(
      (e) =>
        (hidden || !e.name.startsWith(".")) &&
        fold(query)
          .split(/\s+/)
          .every((word) => fold(e.name).includes(word)),
    ),
    limited = visible.length > 2000;
  const found: Item[] = [];
  for (let i = 0; i < Math.min(visible.length, 2000); i += 32) {
    const batch = await Promise.allSettled(visible.slice(i, i + 32).map((e) => item(resolve(path, e.name))));
    for (const result of batch) if (result.status === "fulfilled") found.push(result.value);
  }
  return {
    items: found.toSorted(
      (a, b) =>
        (a.kind !== "folder" ? 1 : 0) - (b.kind !== "folder" ? 1 : 0) ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
    ),
    limited,
  };
};
const quote = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\*/g, "\\*").replace(/\?/g, "\\?");
export const predicate = (query: string): string => {
  if (query.length > 300) throw new Error("Keep folder searches below 300 characters.");
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length > 20) throw new Error("Use up to 20 search words.");
  return [
    'kMDItemContentTypeTree == "public.folder"',

    ...words.map(
      (word) => `(kMDItemFSName == "*${quote(word)}*"cd || kMDItemDisplayName == "*${quote(word)}*"cd)`,
    ),
  ].join(" && ");
};
export const spotlight = (root: string, query: string): Promise<{ paths: string[]; limited: boolean }> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("/usr/bin/mdfind", ["-0", "-onlyin", root, predicate(query)]),
      limit = 300;
    let output = "",
      settled = false,
      limited = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else
        resolvePromise({
          paths: output
            .split("\0")
            .filter((p) => p.startsWith("/"))
            .slice(0, limit),
          limited,
        });
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("Spotlight timed out. Try a narrower search or enter a folder path."));
    }, 4000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (text: string) => {
      output += text;
      if (output.length > 2e6 || output.split("\0").length > limit) {
        limited = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.resume();
    child.on("error", (error) => finish(error));
    child.on("close", (code) =>
      finish(code !== 0 && !limited ? new Error("Spotlight could not search this location.") : undefined),
    );
  });
export const search = async (
  query: string,
  scope: string,
  hidden = false,
): Promise<{ items: Item[]; limited: boolean; warning: string }> => {
  if (query.trim().startsWith("/") || query.trim().startsWith("~")) {
    const direct = await item(pathInput(query));
    return { items: direct.directory ? [direct] : [], limited: false, warning: "" };
  }
  if (!query.trim()) {
    const values = await Promise.allSettled((await favorites()).map(item));
    return {
      items: values.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
      limited: false,
      warning: "",
    };
  }
  const locations = scope ? [scope] : roots(),
    paths = new Set<string>();
  let limited = false;
  const failures: string[] = [];
  for (let i = 0; i < locations.length; i += 2) {
    const batch = await Promise.allSettled(locations.slice(i, i + 2).map((root) => spotlight(root, query)));
    batch.forEach((result, index) => {
      if (result.status === "fulfilled") {
        result.value.paths.forEach((p) => paths.add(p));
        limited ||= result.value.limited;
      } else failures.push(locations[i + index]!);
    });
  }
  const shortcuts = await Promise.allSettled((scope ? [] : await favorites()).map(item));
  const found: Item[] = shortcuts.flatMap((r) =>
    r.status === "fulfilled" && r.value.directory && matches(r.value, query) ? [r.value] : [],
  );
  const known = new Set(found.map((e) => e.uid));
  const list = [...paths].slice(0, 600);
  for (let i = 0; i < list.length; i += 32) {
    const batch = await Promise.allSettled(list.slice(i, i + 32).map(item));
    for (const r of batch)
      if (
        r.status === "fulfilled" &&
        !known.has(r.value.uid) &&
        r.value.directory &&
        (hidden || !r.value.uid.split("/").some((p) => p.startsWith(".")))
      ) {
        known.add(r.value.uid);
        found.push(r.value);
      }
  }
  return {
    items: found
      .toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, 300),
    limited: limited || found.length > 300 || paths.size > 600,
    warning: failures.length ? `${failures.length} search location(s) unavailable` : "",
  };
};
export const containingFolder = (entry: Item): string => (entry.directory ? entry.uid : dirname(entry.uid));
