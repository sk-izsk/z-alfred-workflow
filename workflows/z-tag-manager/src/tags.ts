import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readdir } from "node:fs/promises";
import { isAbsolute, basename, join } from "node:path";
import { homedir } from "node:os";
import { str, bool, readJson, writeJson, cacheDir, dataDir } from "./env.ts";
const exec = promisify(execFile);
const attribute = "com.apple.metadata:_kMDItemUserTags";
export type Entry = { path: string; name: string; tags: string[] };
export const tagName = (raw: string): string => raw.replace(/\n[0-7]$/, "");
export const validTag = (raw: unknown): string => {
  if (
    typeof raw !== "string" ||
    !raw.trim() ||
    raw.trim().length > 200 ||
    [...raw].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new Error("Use a non-empty tag of up to 200 characters without control characters.");
  return raw.trim();
};
export const filePath = (raw: string): string => {
  const path = raw.replace(/^~(?=\/|$)/, homedir());
  if (!isAbsolute(path) || path.includes("\0")) throw new Error("Enter an absolute file or folder path.");
  return path;
};
const checked = async (path: string): Promise<void> => {
  const info = await lstat(filePath(path));
  if (info.isSymbolicLink()) throw new Error("Choose the original file instead of a symbolic link.");
};
export const readRaw = async (path: string): Promise<string[]> => {
  path = filePath(path);
  await checked(path);
  let data: Buffer;
  try {
    data = (
      await exec("/usr/bin/xattr", ["-px", attribute, path], {
        encoding: "buffer",
        timeout: 3000,
        maxBuffer: 100000,
      })
    ).stdout;
  } catch (error) {
    const message = String((error as { stderr?: Buffer }).stderr || "");
    if (/No such xattr/i.test(message)) return [];
    throw new Error("Cannot read Finder tags for this item.", { cause: error });
  }
  // plutil needs stdin; execFile's callback API does not expose an input option.
  const result = await convert(Buffer.from(data.toString().replace(/\s/g, ""), "hex"), "json");
  const values: unknown = JSON.parse(result.toString());
  if (!Array.isArray(values) || values.some((v) => typeof v !== "string"))
    throw new Error("Invalid Finder tag metadata.");
  return values;
};
import { spawn } from "node:child_process";
const convert = (input: Buffer, format: "json" | "binary1"): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/plutil", ["-convert", format, "-o", "-", "--", "-"], { timeout: 3000 });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.resume();
    child.on("error", reject);
    child.stdin.on("error", () => {});
    child.on("close", (code) =>
      code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error("Cannot convert Finder tag metadata.")),
    );
    child.stdin.end(input);
  });
export const readEntry = async (rawPath: string): Promise<Entry> => {
  const path = filePath(rawPath);
  return { path, name: basename(path), tags: (await readRaw(path)).map(tagName) };
};
export const mergeTags = (raw: string[], add: string[], remove: string[] = []): string[] => {
  const removed = new Set(remove.map(validTag));
  const next = raw.filter((value) => !removed.has(tagName(value)));
  for (const value of add.map(validTag))
    if (!next.some((old) => tagName(old) === value)) next.push(`${value}\n0`);
  if (next.length > 100) throw new Error("An item may have at most 100 tags in this workflow.");
  return next;
};
export const changeTags = async (path: string, add: string[], remove: string[] = []): Promise<Entry> => {
  path = filePath(path);
  const raw = await readRaw(path),
    next = mergeTags(raw, add, remove);
  const data = await convert(Buffer.from(JSON.stringify(next)), "binary1");
  await checked(path);
  await exec("/usr/bin/xattr", ["-w", "-x", attribute, data.toString("hex"), path], { timeout: 4000 });
  const known = readJson<string[]>(join(dataDir(), "managed.json"), []);
  writeJson(join(dataDir(), "managed.json"), [...new Set([...known, path])].slice(-1000));
  const entry = await readEntry(path);
  const cached = readJson<Index | null>(join(cacheDir(), "index.json"), null);
  if (cached) {
    cached.entries = cached.entries.filter((old) => old.path !== path);
    if (entry.tags.length) cached.entries.push(entry);
    writeJson(join(cacheDir(), "index.json"), cached);
  }
  return entry;
};
export const parseImport = (text: string): Entry[] => {
  if (Buffer.byteLength(text) > 2e6) throw new Error("Import is limited to 2 MB.");
  const data = JSON.parse(text);
  if (
    data?.version !== 1 ||
    !Array.isArray(data.entries) ||
    !data.entries.length ||
    data.entries.length > 500
  )
    throw new Error("Choose a Tag Manager v1 export containing 1–500 entries.");
  const paths = new Set<string>();
  return data.entries.map((entry: any) => {
    if (typeof entry?.path !== "string" || !Array.isArray(entry.tags) || entry.tags.length > 100)
      throw new Error("Invalid imported item.");
    const path = filePath(entry.path);
    if (paths.has(path)) throw new Error("Import contains duplicate paths.");
    paths.add(path);
    return { path, name: basename(path), tags: [...new Set<string>(entry.tags.map(validTag))] };
  });
};
/** Escapes a value for an mdfind predicate string. */
const quote = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\*/g, "\\*").replace(/\?/g, "\\?");
export const tagPredicate = (query = ""): string => {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 20);
  if (query.length > 1000) throw new Error("Keep searches below 1000 characters.");
  return [
    'kMDItemUserTags == "*"',
    ...words.map(
      (word) =>
        `(kMDItemUserTags == "*${quote(word)}*"cd || kMDItemFSName == "*${quote(word)}*"cd || kMDItemPath == "*${quote(word)}*"cd)`,
    ),
  ].join(" && ");
};
export const discoveryArgs = (query = "", root?: string): string[] => [
  "-0",
  ...(root ? ["-onlyin", root] : []),
  tagPredicate(query),
];
const searchRoots = (): string[] => [
  ...new Set(str("search_roots", "~;/Volumes;/Applications").split(/[;\n]/).filter(Boolean).map(filePath)),
];
export const scanSignature = (query = ""): string =>
  JSON.stringify({
    version: 2,
    all: bool("search_all", true),
    roots: searchRoots(),
    query: query.trim().toLowerCase(),
  });
const appFallback = async (refresh: boolean): Promise<Entry[]> => {
  const file = join(cacheDir(), "app-fallback.json"),
    cached = readJson<{ at: number; entries: Entry[] } | null>(file, null);
  if (!refresh && cached && Date.now() - cached.at < 300000) return cached.entries;
  const paths: string[] = [],
    queue = [
      { path: "/Applications", depth: 0 },
      { path: "/System/Applications", depth: 0 },
      { path: join(homedir(), "Applications"), depth: 0 },
    ];
  while (queue.length && paths.length < 2000) {
    const current = queue.shift()!;
    try {
      for (const child of await readdir(current.path, { withFileTypes: true })) {
        if (!child.isDirectory() || child.isSymbolicLink() || child.name.startsWith(".")) continue;
        const path = join(current.path, child.name);
        if (child.name.toLowerCase().endsWith(".app")) paths.push(path);
        else if (current.depth < 5) queue.push({ path, depth: current.depth + 1 });
      }
    } catch {
      // unreadable folder: skip it
    }
  }
  const entries: Entry[] = [];
  const deadline = Date.now() + 10000;
  for (let i = 0; i < paths.length && Date.now() < deadline; i += 16) {
    const values = await Promise.allSettled(paths.slice(i, i + 16).map(readEntry));
    for (const value of values)
      if (value.status === "fulfilled" && value.value.tags.length) entries.push(value.value);
  }
  writeJson(file, { at: Date.now(), entries });
  return entries;
};
export type Index = {
  signature?: string;
  entries: Entry[];
  fetched: number;
  limited: boolean;
  unavailable: number;
  stale?: boolean;
};
export const scan = async (refresh = false, query = ""): Promise<Index> => {
  const file = join(cacheDir(), "index.json"),
    previous = readJson<Index | null>(file, null);
  const minutes = Math.max(1, Math.min(60, Number(str("scan_minutes", "5")) || 5));
  const signature = scanSignature(query),
    allSystem = bool("search_all", true);
  if (!refresh && previous?.signature === signature && Date.now() - previous.fetched < minutes * 60000)
    return previous;
  const roots: (string | undefined)[] = allSystem ? [undefined] : searchRoots();
  const managed = readJson<string[]>(join(dataDir(), "managed.json"), []);
  const paths = new Set(query.trim() ? [] : managed);
  let unavailable = 0,
    limited = false;
  for (const root of roots) {
    try {
      const result = await exec("/usr/bin/mdfind", discoveryArgs(query, root), {
        timeout: 5000,
        maxBuffer: 2000000,
      });
      result.stdout
        .split("\0")
        .filter((p) => p.startsWith("/"))
        .forEach((p) => paths.add(p));
    } catch {
      unavailable++;
    }
  }
  if (query.trim()) managed.forEach((path) => paths.add(path));
  if (unavailable === roots.length && previous?.signature === signature)
    return { ...previous, stale: true, unavailable };
  limited = paths.size > 500;
  const entries: Entry[] =
    allSystem && (paths.size === 0 || unavailable > 0)
      ? (await appFallback(refresh)).filter((entry) => matches(entry, query))
      : [];
  const known = new Set(entries.map((entry) => entry.path));
  const all = [...paths].filter((path) => !known.has(path)).slice(0, 500);
  const deadline = Date.now() + 10000;
  for (let i = 0; i < all.length; i += 8) {
    if (Date.now() > deadline) {
      limited = true;
      break;
    }
    const results = await Promise.allSettled(all.slice(i, i + 8).map(readEntry));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.tags.length) entries.push(result.value);
      else if (result.status === "rejected") unavailable++;
    }
  }
  const index = {
    signature,
    entries: entries.toSorted((a, b) => a.name.localeCompare(b.name)),
    fetched: Date.now(),
    limited,
    unavailable,
  };
  writeJson(file, index);
  return index;
};
export const matches = (entry: Entry, query: string): boolean =>
  query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => `${entry.name} ${entry.path} ${entry.tags.join(" ")}`.toLowerCase().includes(word));
