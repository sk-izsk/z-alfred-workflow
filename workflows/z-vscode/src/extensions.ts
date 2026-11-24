import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appPath, cliPath, editor } from "./editors.ts";
import { exec } from "./proc.ts";
import { defaultManifest } from "./profiles.ts";

export type Pkg = {
  name?: string;
  displayName?: string;
  publisher?: string;
  icon?: string;
  categories?: string[];
  contributes?: { themes?: { id?: string; label?: string; uiTheme?: string }[] };
};

export type LocalExtension = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  /** Absolute path to the icon PNG, or "". */
  icon: string;
  path: string;
  preRelease: boolean;
  isTheme: boolean;
  pkg: Pkg;
};

type Manifest = {
  identifier: { id: string };
  version: string;
  location: string | { fsPath?: string; path: string };
  relativeLocation?: string;
  metadata?: { publisherDisplayName?: string; preRelease?: boolean };
};

export const readJsonFile = <T>(path: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
};

/** `%displayName%` → the English string from package.nls.json. */
export const nls = (dir: string, raw = ""): string => {
  const key = raw.match(/^%(.+)%$/)?.[1];
  if (!key) return raw;
  const value = readJsonFile<Record<string, string | { message: string }>>(join(dir, "package.nls.json"))?.[
    key
  ];
  return typeof value === "string" ? value : (value?.message ?? raw);
};

export const isThemePkg = (pkg: Pkg): boolean =>
  (pkg.contributes?.themes?.length ?? 0) > 0 || (pkg.categories ?? []).includes("Themes");

/** Installed extensions of a profile (its extensions.json), sorted by name. */
export const localExtensions = (manifestPath = defaultManifest()): LocalExtension[] => {
  if (editor().kind === "zed") return [];
  const root = dirname(defaultManifest());
  const manifest = readJsonFile<Manifest[]>(manifestPath) ?? [];
  return manifest
    .map((m) => {
      const dir =
        typeof m.location === "string"
          ? join(root, m.location)
          : (m.location.fsPath ?? m.location.path ?? join(root, m.relativeLocation ?? ""));
      const pkg = readJsonFile<Pkg>(join(dir, "package.json")) ?? {};
      const icon = pkg.icon ? join(dir, pkg.icon) : "";
      return {
        id: m.identifier.id,
        name: nls(dir, pkg.displayName) || m.identifier.id,
        publisher: m.metadata?.publisherDisplayName ?? pkg.publisher ?? "",
        version: m.version,
        icon: icon && existsSync(icon) ? icon : "",
        path: dir,
        preRelease: !!m.metadata?.preRelease,
        isTheme: isThemePkg(pkg),
        pkg,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

/** Extensions shipped inside the app (the default themes live here). */
export const builtinExtensionDirs = (): string[] => {
  const dir = join(appPath(), "Contents/Resources/app/extensions");
  try {
    return readdirSync(dir).map((name) => join(dir, name));
  } catch {
    return [];
  }
};

/** `--profile <name>` targets a profile; the default profile needs no flag. */
const profileArgs = (profileName?: string) =>
  profileName && profileName !== "Default" ? ["--profile", profileName] : [];

export const installExtension = (id: string, profileName?: string) =>
  exec(cliPath(), [...profileArgs(profileName), "--install-extension", id, "--force"]);
export const uninstallExtension = (id: string, profileName?: string) =>
  exec(cliPath(), [...profileArgs(profileName), "--uninstall-extension", id, "--force"]);

/** `vscode:extension/<id>` opens the extension page inside the editor. */
export const extensionUri = (id: string): string => `${editor().extDir.replace(/-ide$/, "")}:extension/${id}`;
