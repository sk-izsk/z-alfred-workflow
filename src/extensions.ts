import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cliPath, editor } from "./editors.ts";
import { exec } from "./proc.ts";

export type LocalExtension = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  /** Absolute path to the icon PNG, or "". */
  icon: string;
  path: string;
  preRelease: boolean;
};

type Manifest = {
  identifier: { id: string };
  version: string;
  location: string | { fsPath?: string; path: string };
  relativeLocation?: string;
  metadata?: { publisherDisplayName?: string; preRelease?: boolean };
};

const readJsonFile = <T>(path: string): T | undefined => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
};

/** `%displayName%` → the English string from package.nls.json. */
const displayName = (dir: string, raw = ""): string => {
  const key = raw.match(/^%(.+)%$/)?.[1];
  if (!key) return raw;
  return readJsonFile<Record<string, string>>(join(dir, "package.nls.json"))?.[key] ?? raw;
};

export const extensionsRoot = (): string => join(homedir(), `.${editor().extDir}`, "extensions");

export const localExtensions = (): LocalExtension[] => {
  if (editor().kind === "zed") return [];
  const root = extensionsRoot();
  const manifest = readJsonFile<Manifest[]>(join(root, "extensions.json")) ?? [];
  return manifest
    .map((m) => {
      const dir =
        typeof m.location === "string"
          ? join(root, m.location)
          : (m.location.fsPath ?? m.location.path ?? join(root, m.relativeLocation ?? ""));
      const pkg =
        readJsonFile<{ displayName?: string; publisher?: string; icon?: string }>(
          join(dir, "package.json"),
        ) ?? {};
      const icon = pkg.icon ? join(dir, pkg.icon) : "";
      return {
        id: m.identifier.id,
        name: displayName(dir, pkg.displayName) || m.identifier.id,
        publisher: m.metadata?.publisherDisplayName ?? pkg.publisher ?? "",
        version: m.version,
        icon: icon && existsSync(icon) ? icon : "",
        path: dir,
        preRelease: !!m.metadata?.preRelease,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

export const installExtension = (id: string) => exec(cliPath(), ["--install-extension", id, "--force"]);
export const uninstallExtension = (id: string) => exec(cliPath(), ["--uninstall-extension", id, "--force"]);

/** `vscode:extension/<id>` opens the extension page inside the editor. */
export const extensionUri = (id: string): string => `${editor().extDir.replace(/-ide$/, "")}:extension/${id}`;
