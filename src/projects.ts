import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type Editor, editor, product } from "./editors.ts";
import { tildify } from "./env.ts";
import { run } from "./proc.ts";

export type Kind = "folder" | "file" | "workspace" | "remote";

export type Project = {
  /** The VS Code URI (also our stable id). Local Zed entries use a file:// URI too. */
  uri: string;
  kind: Kind;
  name: string;
  /** Local path, or "" for remote entries. */
  path: string;
  /** Dim text beside the name: parent folder or remote host. */
  detail: string;
  /** VS Code's remote authority, e.g. `ssh-remote+devbox`. */
  remote?: string;
  /** Has a `.git` folder (local only). */
  git?: boolean;
  /** Found by the folder scan, never opened in the editor. */
  discovered?: boolean;
};

type Entry = {
  folderUri?: string;
  fileUri?: string;
  workspace?: { configPath: string };
  remoteAuthority?: string;
  label?: string;
};

const SQLITE = "/usr/bin/sqlite3";

const query = async (db: string, sql: string): Promise<string> => {
  if (!existsSync(db)) return "";
  // No `-readonly`: with the editor running the DB is in WAL mode, and a read-only connection can't
  // attach its shared-memory file ("unable to open database file"). We only ever SELECT.
  const { code, stdout } = await run(SQLITE, [db, sql]);
  return code === 0 ? stdout : "";
};

/** `ssh-remote+devbox` → `SSH: devbox`, like VS Code's own label. */
export const remoteLabel = (authority: string): string => {
  const [type = "", host = ""] = authority.split("+");
  const kind: Record<string, string> = {
    "ssh-remote": "SSH",
    wsl: "WSL",
    "dev-container": "Dev Container",
    "attached-container": "Container",
    tunnel: "Tunnel",
    codespaces: "Codespaces",
  };
  return host ? `${kind[type] ?? type}: ${decodeURIComponent(host)}` : authority;
};

const localPath = (uri: string): string => {
  try {
    return fileURLToPath(uri);
  } catch {
    return "";
  }
};

/** One stored VS Code entry → a Project, or undefined when it's gone from disk. */
export const toProject = (entry: Entry): Project | undefined => {
  const uri = entry.folderUri ?? entry.fileUri ?? entry.workspace?.configPath;
  if (!uri) return undefined;
  if (entry.remoteAuthority) {
    const tail = decodeURIComponent(new URL(uri).pathname);
    return {
      uri,
      kind: "remote",
      name: entry.label?.split(" [")[0] || basename(tail).replace(/\.code-workspace$/, "") || tail,
      path: "",
      detail: remoteLabel(entry.remoteAuthority),
      remote: entry.remoteAuthority,
    };
  }
  const path = localPath(uri);
  if (!path || !existsSync(path)) return undefined;
  const kind: Kind = entry.workspace ? "workspace" : entry.folderUri ? "folder" : "file";
  return {
    uri,
    kind,
    git: kind === "folder" && existsSync(join(path, ".git")),
    name: kind === "workspace" ? basename(path).replace(/\.code-workspace$/, "") : basename(path),
    path,
    detail: tildify(dirname(path)),
  };
};

/** Newer builds keep state in `~/.<shared>/sharedStorage`; older ones in the app's globalStorage. */
const stateDb = (e: Editor): string => {
  const shared = product(e).sharedDataFolderName;
  const sharedDb = shared && join(homedir(), shared, "sharedStorage", "state.vscdb");
  return sharedDb && existsSync(sharedDb)
    ? sharedDb
    : join(homedir(), "Library/Application Support", e.dataDir, "User/globalStorage/state.vscdb");
};

const vscodeRecents = async (e: Editor): Promise<Project[]> => {
  const raw = await query(
    stateDb(e),
    `SELECT value FROM ItemTable WHERE key IN ('recently.opened','history.recentlyOpenedPathsList')
     ORDER BY key = 'recently.opened' DESC LIMIT 1`,
  );
  if (!raw.trim()) return [];
  try {
    const { entries = [] } = JSON.parse(raw) as { entries?: Entry[] };
    return entries.map(toProject).filter((p): p is Project => !!p);
  } catch {
    return [];
  }
};

/** Zed keeps workspaces in SQLite; `paths` holds one path per line (multi-root workspaces). */
const zedRecents = async (e: Editor): Promise<Project[]> => {
  const channel = e.id === "Zed Preview" ? "0-preview" : "0-stable";
  const db = join(homedir(), "Library/Application Support/Zed/db", channel, "db.sqlite");
  // ponytail: assumes the 2025+ schema (`paths` text column); older Zed builds just show nothing.
  const raw = await query(
    db,
    "SELECT paths FROM workspaces WHERE paths IS NOT NULL AND paths != '' ORDER BY timestamp DESC",
  );
  const seen = new Set<string>();
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((path) => path && existsSync(path) && !seen.has(path) && seen.add(path))
    .map((path) => {
      const dir = statSync(path).isDirectory();
      return {
        uri: `file://${encodeURI(path)}`,
        kind: dir ? "folder" : "file",
        name: basename(path),
        path,
        detail: tildify(dirname(path)),
      } satisfies Project;
    });
};

export const recents = (e: Editor = editor()): Promise<Project[]> =>
  e.kind === "zed" ? zedRecents(e) : vscodeRecents(e);

export const KIND_FILTERS = [
  { text: "All Types", value: "all" },
  { text: "Folders", value: "folder" },
  { text: "Files", value: "file" },
  { text: "Workspaces", value: "workspace" },
  { text: "Remote", value: "remote" },
  { text: "Git Repos", value: "git" },
] as const;

export const byKind = (filter: string) => (p: Project) =>
  filter === "all" || (filter === "git" ? !!p.git : p.kind === filter);

/** Repos found by the folder scan that aren't already in the recents. */
export const discovered = (repos: string[], known: Project[]): Project[] => {
  const seen = new Set(known.map((p) => p.path));
  return repos
    .filter((path) => !seen.has(path) && existsSync(path))
    .map((path) => ({
      uri: pathToFileURL(path).href,
      kind: "folder" as const,
      name: basename(path),
      path,
      detail: tildify(dirname(path)),
      git: true,
      discovered: true,
    }));
};

/** Remove one entry from the editor's recent list (what VS Code's "Remove from Recently Opened" does). */
export const removeRecent = async (uri: string, e: Editor = editor()): Promise<void> => {
  if (e.kind === "zed") throw new Error("Removing recents isn't supported for Zed");
  const db = stateDb(e);
  for (const key of ["recently.opened", "history.recentlyOpenedPathsList"]) {
    const raw = await query(db, `SELECT value FROM ItemTable WHERE key = '${key}'`);
    if (!raw.trim()) continue;
    const data = JSON.parse(raw) as { entries?: Entry[] };
    const entries = (data.entries ?? []).filter(
      (x) => (x.folderUri ?? x.fileUri ?? x.workspace?.configPath) !== uri,
    );
    const json = JSON.stringify({ ...data, entries }).replaceAll("'", "''");
    const { code, stderr } = await run(SQLITE, [
      db,
      `UPDATE ItemTable SET value = '${json}' WHERE key = '${key}'`,
    ]);
    if (code !== 0) throw new Error(stderr.trim() || "Couldn't update the recent list");
  }
};
