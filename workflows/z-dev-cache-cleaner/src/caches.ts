import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { existsSync, lstatSync, realpathSync, readdirSync } from "node:fs";
import { str } from "./env.ts";
const execute = promisify(execFile);
export type Cache = {
  id: string;
  name: string;
  path: string;
  category: string;
  risk: "Safe" | "Review";
  bytes: number;
  device: number;
  inode: number;
  kind: "known" | "artifact";
  note: string;
  error: string;
};
const definitions: [string, string, string, "Safe" | "Review", string][] = [
  [
    "npm",
    ".npm/_cacache",
    "Package Managers",
    "Safe",
    "Downloaded npm package cache; downloads again when needed.",
  ],
  [
    "Yarn",
    "Library/Caches/Yarn",
    "Package Managers",
    "Safe",
    "Downloaded Yarn packages; installs may take longer after cleaning.",
  ],
  [
    "Homebrew",
    "Library/Caches/Homebrew",
    "Package Managers",
    "Safe",
    "Downloaded Homebrew archives; future installs may download again.",
  ],
  ["pip", "Library/Caches/pip", "Package Managers", "Safe", "Downloaded Python packages and built wheels."],
  ["CocoaPods", "Library/Caches/CocoaPods", "Package Managers", "Safe", "Downloaded CocoaPods archives."],
  ["Composer", "Library/Caches/composer", "Package Managers", "Safe", "Downloaded Composer packages."],
  [
    "pnpm store",
    "Library/pnpm/store",
    "Package Managers",
    "Review",
    "Shared pnpm package store; prefer pnpm store prune when actively developing.",
  ],
  [
    "Xcode DerivedData",
    "Library/Developer/Xcode/DerivedData",
    "Xcode",
    "Review",
    "Build products/indexes; quit active builds before removing.",
  ],
  [
    "Xcode Archives",
    "Library/Developer/Xcode/Archives",
    "Xcode",
    "Review",
    "Signed build archives may be irreplaceable. Inspect and back up before removing.",
  ],
  [
    "Swift Package Manager",
    "Library/Caches/org.swift.swiftpm",
    "Languages",
    "Safe",
    "Swift package cache; dependency fetching will run again.",
  ],
  [
    "Gradle",
    ".gradle/caches",
    "Languages",
    "Review",
    "Gradle build/dependency caches; stop active Gradle builds first.",
  ],
  [
    "Cargo registry cache",
    ".cargo/registry/cache",
    "Languages",
    "Safe",
    "Downloaded Rust crate archives; downloaded again on demand.",
  ],
  [
    "Go build cache",
    "Library/Caches/go-build",
    "Languages",
    "Safe",
    "Go compiled build cache; recompiles automatically.",
  ],
];
const artifacts = new Set([
  "node_modules",
  ".next",
  ".nuxt",
  ".turbo",
  ".parcel-cache",
  ".svelte-kit",
  ".angular",
  ".expo",
  "__pycache__",
  ".venv",
  ".build",
]);
export const roots = (): string[] =>
  str("project_roots", "~/Projects")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => resolve(x.replace(/^~(?=\/|$)/, homedir())))
    .filter((x) => x !== "/" && x !== homedir());
const age = (): number => Math.max(1, Math.min(365, Number(str("artifact_days", "30")) || 30)) * 86400000;
export const bytes = (n: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < 4) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
const entry = (
  path: string,
  name: string,
  category: string,
  risk: "Safe" | "Review",
  kind: "known" | "artifact",
  note: string,
): Cache | null => {
  try {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) return null;
    return {
      id: path,
      name,
      path,
      category,
      risk,
      kind,
      note,
      bytes: 0,
      device: stat.dev,
      inode: stat.ino,
      error: "",
    };
  } catch {
    return null;
  }
};
export const scan = async (): Promise<{ rows: Cache[]; limited: boolean }> => {
  const rows: Cache[] = [];
  for (const [name, relative, category, risk, note] of definitions) {
    const e = entry(join(homedir(), relative), name, category, risk, "known", note);
    if (e) rows.push(e);
  }
  let visited = 0,
    limited = false;
  const walk = (folder: string, depth: number): void => {
    if (depth > 6 || visited >= 2000 || rows.length >= 100) {
      limited = true;
      return;
    }
    visited++;
    try {
      for (const d of readdirSync(folder, { withFileTypes: true })) {
        if (rows.length >= 100 || visited >= 2000) {
          limited = true;
          break;
        }
        if (!d.isDirectory() || d.isSymbolicLink() || d.name === ".git") continue;
        const path = join(folder, d.name);
        if (artifacts.has(d.name)) {
          if (Date.now() - lstatSync(path).mtimeMs >= age()) {
            const e = entry(
              path,
              `${d.name} · ${basename(folder)}`,
              "Project Artifacts",
              "Review",
              "artifact",
              "Old build/dependency folder. Inspect the project and stop builds before permanent removal.",
            );
            if (e) rows.push(e);
          }
          continue;
        }
        if (!d.name.startsWith(".")) walk(path, depth + 1);
      }
    } catch {}
  };
  for (const root of roots()) if (existsSync(root) && realpathSync(root) === root) walk(root, 0);
  for (let i = 0; i < rows.length; i += 4)
    await Promise.all(
      rows.slice(i, i + 4).map(async (e) => {
        try {
          const { stdout } = await execute("/usr/bin/du", ["-skx", e.path], {
            encoding: "utf8",
            timeout: 15000,
            maxBuffer: 1e6,
          });
          e.bytes = (Number(stdout.match(/^\d+/)?.[0]) || 0) * 1024;
        } catch {
          e.error = "Size unavailable or timed out; inspect permissions.";
        }
      }),
    );
  return {
    rows: rows.toSorted((a, b) => a.category.localeCompare(b.category) || b.bytes - a.bytes),
    limited,
  };
};
export const validate = (target: Cache): void => {
  const s = lstatSync(target.path);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    realpathSync(target.path) !== target.path ||
    s.dev !== target.device ||
    s.ino !== target.inode
  )
    throw new Error("Cache path changed. Scan and review again.");
  const known = definitions.some(
    ([name, path, , risk]) =>
      target.kind === "known" &&
      target.name === name &&
      target.path === join(homedir(), path) &&
      target.risk === risk,
  );
  const artifact =
    target.kind === "artifact" &&
    target.risk === "Review" &&
    artifacts.has(basename(target.path)) &&
    roots().some((root) => target.path.startsWith(root + sep)) &&
    Date.now() - s.mtimeMs >= age();
  if (!known && !artifact) throw new Error("Cleanup target is outside the configured cache scope.");
};
export const clean = async (
  targets: Cache[],
  remove: (path: string) => Promise<void> = async (path) => {
    await execute("/bin/rm", ["-rf", "--", path], { timeout: 60000, maxBuffer: 65536 });
  },
): Promise<void> => {
  if (!targets.length) throw new Error("No caches selected.");
  for (const t of targets) validate(t);
  for (const t of targets) {
    validate(t);
    await remove(t.path);
  }
};
