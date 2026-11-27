// Your macOS Shortcuts and their folders, from Apple's `shortcuts` command (no permission needed),
// plus which ones accept input, from Shortcuts Events (through Alfred's Automation permission).
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const SHORTCUTS = "/usr/bin/shortcuts";

export type Shortcut = { id: string; name: string; folder: string; acceptsInput?: boolean };
export const NO_FOLDER = "No Folder";

/** `Name (UUID)` lines from `shortcuts list --show-identifiers`. */
export const parseList = (text: string): { id: string; name: string }[] =>
  text.split("\n").flatMap((line) => {
    const m = line.match(/^(.*) \(([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\)$/i);
    return m ? [{ name: m[1]!, id: m[2]!.toUpperCase() }] : [];
  });

const cli = async (args: string[]): Promise<string> =>
  (await execFileP(SHORTCUTS, args, { encoding: "utf8", timeout: 10_000, maxBuffer: 8e6 })).stdout;

/** All shortcuts with their folder, sorted by name. About 150 ms for 40 shortcuts in 3 folders. */
export const listShortcuts = async (): Promise<Shortcut[]> => {
  const [all, folders] = await Promise.all([
    cli(["list", "--show-identifiers"]),
    cli(["list", "--folders", "--show-identifiers"]),
  ]);
  const byId = new Map(parseList(all).map((s) => [s.id, { ...s, folder: "" } as Shortcut]));
  await Promise.all(
    parseList(folders).map(async (folder) => {
      for (const s of parseList(await cli(["list", "-f", folder.id, "--show-identifiers"]))) {
        const item = byId.get(s.id);
        if (item) item.folder = folder.name;
      }
    }),
  );
  return [...byId.values()].toSorted((a, b) => a.name.localeCompare(b.name));
};

/**
 * Which shortcuts accept input (`id → true/false`). Shortcuts Events is the only source; macOS asks
 * once whether Alfred may control it. Returns undefined when that is denied or slow, and then every
 * shortcut is offered input.
 */
export const inputSupport = async (): Promise<Map<string, boolean> | undefined> => {
  const script =
    'const s = Application("com.apple.shortcuts.events").shortcuts; JSON.stringify({ ids: s.id(), input: s.acceptsInput() })';
  try {
    const { stdout } = await execFileP("/usr/bin/osascript", ["-l", "JavaScript", "-e", script], {
      encoding: "utf8",
      timeout: 4000,
    });
    const value = JSON.parse(stdout) as { ids: string[]; input: boolean[] };
    return new Map(value.ids.map((id, i) => [String(id).toUpperCase(), value.input[i] === true]));
  } catch {
    // denied, not answered yet, or Shortcuts Events unavailable: input support stays unknown
    return undefined;
  }
};

/** Every word of the query must appear in the name or folder. */
export const matches = (s: Shortcut, query: string): boolean => {
  const text = `${s.name} ${s.folder || NO_FOLDER}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};

export const inFolder = (s: Shortcut, folder: string): boolean =>
  folder === "all" || (folder === "none" ? !s.folder : s.folder === folder);

/** Folders hidden in Configuration (one per line; `No Folder` hides shortcuts outside folders). */
export const ignoredFolders = (setting: string): Set<string> =>
  new Set(
    setting
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
