// Installed apps, their icons (PNG files the web grid can show) and App Store categories.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

/** The folders the original Launchpad workflow scans. */
export const APP_DIRS = [
  "/Applications",
  "/System/Applications",
  "/System/Volumes/Preboot/Cryptexes/App/System/Applications",
];

export type App = { path: string; name: string; category: string };

export const appName = (path: string): string => basename(path).replace(/\.app$/i, "");

/** Short, stable id for an app path (used by the web page and its URLs). */
export const appId = (path: string): string =>
  `a${createHash("sha1").update(path).digest("hex").slice(0, 10)}`;

const isDir = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    // broken link
    return false;
  }
};

/** `.app` bundles under the folders, without looking inside bundles (like the original). */
export const scanApps = (dirs: string[] = APP_DIRS, maxDepth = 3): string[] => {
  const found = new Set<string>();
  const walk = (dir: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // unreadable folder: skip it
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const path = join(dir, e.name);
      if (e.name.toLowerCase().endsWith(".app")) found.add(path);
      else if (depth < maxDepth && (e.isDirectory() || (e.isSymbolicLink() && isDir(path))))
        walk(path, depth + 1);
    }
  };
  for (const dir of dirs) walk(dir, 0);
  return [...found];
};

/** `public.app-category.developer-tools` → `Developer Tools`. */
export const categoryName = (uti: string): string =>
  uti
    .replace(/^public\.app-category\./, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");

// One JXA process for every app: write a 128 px PNG icon and report the App Store category.
const EXTRACT = `
function run(argv) {
  ObjC.import("AppKit");
  const out = argv[0], result = {};
  for (const line of argv.slice(1)) {
    const [path, file] = line.split("\\t");
    const bundle = $.NSBundle.bundleWithPath(path);
    const info = bundle.isNil() ? null : bundle.infoDictionary;
    const cat = info && !info.isNil() ? info.objectForKey("LSApplicationCategoryType") : null;
    result[path] = cat && !cat.isNil() ? cat.js : "";
    if (!file) continue;
    // Draw into a 128 px image first: converting the full icon (up to 1024 px) takes ~0.8 s each.
    const icon = $.NSWorkspace.sharedWorkspace.iconForFile(path);
    const small = $.NSImage.alloc.initWithSize($.NSMakeSize(128, 128));
    small.lockFocus;
    icon.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, 128, 128), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1);
    small.unlockFocus;
    const rep = $.NSBitmapImageRep.alloc.initWithData(small.TIFFRepresentation);
    rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $()).writeToFileAtomically(out + "/" + file, true);
  }
  return JSON.stringify(result);
}`;

export const iconFile = (path: string): string => `${appId(path)}.png`;

/**
 * Exports missing icons into `iconDir` and returns every app's category. Icons are kept by path,
 * so this is slow only the first time (about 2 s for 200 apps).
 */
export const prepareApps = async (paths: string[], iconDir: string, known: Record<string, string> = {}) => {
  mkdirSync(iconDir, { recursive: true });
  const todo = paths.filter((p) => !existsSync(join(iconDir, iconFile(p))) || !(p in known));
  const categories = { ...known };
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    const lines = batch.map((p) => `${p}\t${existsSync(join(iconDir, iconFile(p))) ? "" : iconFile(p)}`);
    const { stdout } = await execFileP(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", EXTRACT, iconDir, ...lines],
      {
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 8e6,
      },
    );
    Object.assign(categories, JSON.parse(stdout));
  }
  return categories;
};
