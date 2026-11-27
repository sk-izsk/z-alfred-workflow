// What starts at login or runs in the background: login items (System Events), launch agents
// (yours and all users') and launch daemons, with their state from launchctl.
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const run = async (file: string, args: string[], timeout = 10_000): Promise<string> =>
  (await execFileP(file, args, { encoding: "utf8", timeout, maxBuffer: 16e6 })).stdout;

export type Group = "login" | "user-agent" | "agent" | "daemon";
export type Item = {
  /** Unique row id: `login:<name>` or `<group>:<label>`. */
  id: string;
  group: Group;
  name: string;
  /** The app or vendor it belongs to. */
  owner: string;
  label?: string;
  plist?: string;
  /** The program it runs, or the login item's app. */
  program?: string;
  loaded: boolean;
  running: boolean;
  pid?: number;
  disabled: boolean;
  /** The program no longer exists: a leftover from an uninstalled app. */
  missing: boolean;
};

export const DIRS: Record<Exclude<Group, "login">, string> = {
  "user-agent": join(homedir(), "Library/LaunchAgents"),
  agent: "/Library/LaunchAgents",
  daemon: "/Library/LaunchDaemons",
};
const uid = () => process.getuid?.() ?? 501;
const domain = (group: Group) => (group === "daemon" ? "system" : `gui/${uid()}`);

/** `PID Status Label` lines from `launchctl list` → label → pid (0 when loaded but not running). */
export const parseList = (text: string): Map<string, number> => {
  const map = new Map<string, number>();
  for (const line of text.split("\n").slice(1)) {
    const [pid, , label] = line.split("\t");
    if (label) map.set(label, pid && pid !== "-" ? Number(pid) : 0);
  }
  return map;
};
/** `"label" => enabled|disabled` lines from `launchctl print-disabled`. */
export const parseDisabled = (text: string): Set<string> =>
  new Set([...text.matchAll(/"([^"]+)" => disabled/g)].map((m) => m[1]!));
/** `launchctl print system/<label>`: pid when running. */
export const parsePrint = (text: string): { running: boolean; pid?: number } => {
  const pid = text.match(/^\s*pid = (\d+)/m)?.[1];
  return { running: /^\s*state = running/m.test(text), pid: pid ? Number(pid) : undefined };
};

const VENDORS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  zoom: "Zoom",
  box: "Box",
  adobe: "Adobe",
  dropbox: "Dropbox",
  brew: "Homebrew",
  homebrew: "Homebrew",
};
/** The app a program belongs to (`/Applications/Foo.app/…` → Foo), else a vendor from the label. */
export const ownerOf = (program: string | undefined, label: string): string => {
  const app = program?.match(/([^/]+)\.app\//)?.[1];
  if (app) return app;
  if (program?.startsWith("/opt/homebrew/") || program?.startsWith("/usr/local/Cellar/")) return "Homebrew";
  const parts = label.toLowerCase().split(".");
  for (const part of parts) if (VENDORS[part]) return VENDORS[part];
  return parts.length > 2 ? parts[1]!.replace(/^\w/, (c) => c.toUpperCase()) : label;
};

type LaunchPlist = { Label?: string; Program?: string; ProgramArguments?: string[] };
const readPlist = async (file: string): Promise<LaunchPlist | undefined> => {
  try {
    return JSON.parse(await run("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], 3000));
  } catch {
    // unreadable or not a plist: skipped
    return undefined;
  }
};

const launchItems = async (
  group: Exclude<Group, "login">,
  loaded: Map<string, number>,
  disabled: Set<string>,
): Promise<Item[]> => {
  let files: string[] = [];
  try {
    files = readdirSync(DIRS[group]).filter((f) => f.endsWith(".plist"));
  } catch {
    // the folder doesn't exist
    return [];
  }
  const items = await Promise.all(
    files.map(async (f): Promise<Item | undefined> => {
      const plist = join(DIRS[group], f);
      const data = await readPlist(plist);
      if (!data) return undefined;
      const label = data.Label || f.replace(/\.plist$/, "");
      const program = data.Program || data.ProgramArguments?.[0];
      let state: { running: boolean; pid?: number; loaded: boolean } = { running: false, loaded: false };
      if (group === "daemon") {
        // Daemons aren't in the user's `launchctl list`; ask for each one (no admin needed).
        const text = await run("/bin/launchctl", ["print", `system/${label}`], 3000).catch(() => "");
        state = { ...parsePrint(text), loaded: Boolean(text) };
      } else if (loaded.has(label)) {
        const pid = loaded.get(label)!;
        state = { running: pid > 0, pid: pid || undefined, loaded: true };
      }
      return {
        id: `${group}:${label}`,
        group,
        name: program?.includes(".app/") ? ownerOf(program, label) : label,
        owner: ownerOf(program, label),
        label,
        plist,
        program,
        ...state,
        disabled: disabled.has(label),
        missing: Boolean(program?.startsWith("/") && !existsSync(program)),
      };
    }),
  );
  return items.filter((x): x is Item => Boolean(x));
};

/** Login items from System Events (macOS asks once to let Alfred control it). */
const loginItems = async (processes: string): Promise<Item[] | undefined> => {
  const script =
    'const s = Application("System Events").loginItems; JSON.stringify({ names: s.name(), paths: s.path() })';
  try {
    const out = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", script], 5000);
    const { names, paths } = JSON.parse(out) as { names: string[]; paths: (string | null)[] };
    return names.map((name, i) => {
      const path = paths[i] || undefined;
      return {
        id: `login:${name}`,
        group: "login" as const,
        name,
        owner: path ? basename(path, ".app") : name,
        program: path,
        loaded: true,
        running: Boolean(path && processes.includes(`${path}/Contents/MacOS/`)),
        disabled: false,
        missing: Boolean(path && !existsSync(path)),
      };
    });
  } catch {
    // Automation permission denied or not answered yet
    return undefined;
  }
};

export type Snapshot = { items: Item[]; loginDenied: boolean };
/** Everything at once (~0.6 s, most of it System Events). */
export const readItems = async (): Promise<Snapshot> => {
  const [list, userDisabled, systemDisabled, processes] = await Promise.all([
    run("/bin/launchctl", ["list"]),
    run("/bin/launchctl", ["print-disabled", `gui/${uid()}`]).catch(() => ""),
    run("/bin/launchctl", ["print-disabled", "system"]).catch(() => ""),
    run("/bin/ps", ["-axo", "comm="]).catch(() => ""),
  ]);
  const loaded = parseList(list);
  const [login, mine, all, daemons] = await Promise.all([
    loginItems(processes),
    launchItems("user-agent", loaded, parseDisabled(userDisabled)),
    launchItems("agent", loaded, parseDisabled(userDisabled)),
    launchItems("daemon", loaded, parseDisabled(systemDisabled)),
  ]);
  return { items: [...(login ?? []), ...mine, ...all, ...daemons], loginDenied: !login };
};

export const GROUP_LABEL: Record<Group, string> = {
  login: "Login Item",
  "user-agent": "Your Agent",
  agent: "Agent",
  daemon: "Daemon",
};
const stateText = (x: Item): string =>
  x.missing
    ? "Program missing"
    : x.running
      ? `Running${x.pid ? ` (PID ${x.pid})` : ""}`
      : x.loaded && x.group !== "login"
        ? "Loaded"
        : "Not running";
/** Second line: Running (PID 824) · Harper · Your Agent · Disabled · com.example.agent */
export const describe = (x: Item): string =>
  [
    stateText(x),
    x.owner !== x.name && x.owner,
    GROUP_LABEL[x.group],
    x.disabled && "Disabled",
    // Apps often install several agents; the label tells them apart.
    x.label && x.label !== x.name && x.label,
  ]
    .filter(Boolean)
    .join(" · ");
export const symbol = (x: Item): string =>
  x.missing
    ? "exclamationmark.triangle"
    : x.group === "login"
      ? "person.crop.circle.badge.checkmark"
      : x.group === "daemon"
        ? "gearshape.2"
        : "gearshape";

/** Every word of the query must appear in the name, owner, label, group or state. */
export const matches = (x: Item, query: string): boolean => {
  const text = `${x.name} ${x.label ?? ""} ${describe(x)}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};
export type Filter = "all" | "login" | "agents" | "daemons" | "leftovers";
export const inFilter = (x: Item, filter: Filter): boolean =>
  filter === "all" ||
  (filter === "login" && x.group === "login") ||
  (filter === "agents" && (x.group === "user-agent" || x.group === "agent")) ||
  (filter === "daemons" && x.group === "daemon") ||
  (filter === "leftovers" && x.missing);
const ORDER: Record<Group, number> = { login: 0, "user-agent": 1, agent: 2, daemon: 3 };
/** Leftovers first (they need attention), then by group and name. */
export const sortItems = (list: Item[]): Item[] =>
  list.toSorted(
    (a, b) =>
      Number(b.missing) - Number(a.missing) ||
      ORDER[a.group] - ORDER[b.group] ||
      a.name.localeCompare(b.name),
  );

// --- Actions ---------------------------------------------------------------------------------

const SAFE_LABEL = /^[\w.@-]+$/;
const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;
/** The shell command an administrator runs for daemons (labels are checked against SAFE_LABEL). */
export const adminShell = (commands: string[][]): string =>
  commands.map((c) => ["/bin/launchctl", ...c].map(quote).join(" ")).join("; ");
/** Runs launchctl; daemons go through macOS's own administrator password dialog. */
const launchctl = async (group: Group, commands: string[][]): Promise<void> => {
  if (group === "daemon") {
    const apple = `do shell script ${JSON.stringify(adminShell(commands))} with administrator privileges`;
    await run("/usr/bin/osascript", ["-e", apple], 120_000);
    return;
  }
  for (const c of commands) await run("/bin/launchctl", c);
};
const checked = (x: Item): { label: string; plist: string } => {
  if (x.group === "login" || !x.label || !x.plist)
    throw new Error("Only launch agents and daemons can do that.");
  if (!SAFE_LABEL.test(x.label)) throw new Error(`Unusual label “${x.label}”: change it in Terminal.`);
  return { label: x.label, plist: x.plist };
};
/** launchctl prints errors on stdout or stderr; show its message, not "Command failed". */
const launchError = (error: unknown, what: string): Error => {
  const e = error as { stderr?: string; stdout?: string; message?: string };
  const text = `${e.stderr ?? ""}${e.stdout ?? ""}`.trim() || e.message || "";
  if (/User canceled|-128/.test(text)) return new Error(`${what} cancelled.`, { cause: error });
  return new Error(`${what} failed${text ? `: ${text.split("\n").at(-1)}` : "."}`, { cause: error });
};

export const stop = async (x: Item): Promise<void> => {
  const { label } = checked(x);
  await launchctl(x.group, [["bootout", `${domain(x.group)}/${label}`]]).catch((error) => {
    throw launchError(error, `Stopping ${x.name}`);
  });
};
export const start = async (x: Item): Promise<void> => {
  const { label, plist } = checked(x);
  const commands = x.loaded
    ? [["kickstart", `${domain(x.group)}/${label}`]]
    : [["bootstrap", domain(x.group), plist]];
  await launchctl(x.group, commands).catch((error) => {
    throw launchError(error, `Starting ${x.name}`);
  });
};
/** Disabling also stops it, and keeps it from loading at the next login or restart. */
export const setDisabled = async (x: Item, disabled: boolean): Promise<void> => {
  const { label, plist } = checked(x);
  const target = `${domain(x.group)}/${label}`;
  const commands = disabled
    ? [["disable", target], ...(x.loaded ? [["bootout", target]] : [])]
    : [["enable", target], ...(x.loaded ? [] : [["bootstrap", domain(x.group), plist]])];
  await launchctl(x.group, commands).catch((error) => {
    throw launchError(error, `${disabled ? "Disabling" : "Enabling"} ${x.name}`);
  });
};
/** Moves one of your own agents to the Trash after stopping it (recoverable from the Trash). */
export const trash = async (x: Item): Promise<void> => {
  if (x.group !== "user-agent" || !x.plist)
    throw new Error("Only your own agents can be moved to the Trash here.");
  if (x.loaded) await stop(x).catch(() => {});
  await run("/usr/bin/osascript", [
    "-e",
    `tell application "Finder" to delete (POSIX file ${JSON.stringify(x.plist)})`,
  ]);
};
/** Removes a login item (the app stays installed). */
export const removeLoginItem = async (x: Item): Promise<void> => {
  if (x.group !== "login") throw new Error("That isn't a login item.");
  await run("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    `Application("System Events").loginItems.byName(${JSON.stringify(x.name)}).delete()`,
  ]);
};
