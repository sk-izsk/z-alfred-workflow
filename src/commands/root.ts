import { existsSync } from "node:fs";
import { cloneRepo, defaultCloneDir, parseRepo, targetPath } from "../clone.ts";
import { editor, shortName } from "../editors.ts";
import { str, tildify, untildify } from "../env.ts";
import { finderSelection } from "../finder.ts";
import { ghInstalled, myRepos, searchRepos } from "../github.ts";
import {
  agentsWindow,
  alfredSearch,
  newWindow,
  openPath,
  openWithProfile,
  runPaletteCommand,
} from "../launch.ts";
import { profiles } from "../profiles.ts";
import { clipboardRepo, cloneFilterItems, cloneItem } from "./clonefilter.ts";

/**
 * The `code` Script Filter: one menu for everything, like `bw`.
 * `code` → commands; `code install prettier` → Install Extension searching "prettier";
 * `code <git url>` → Clone; `code gh name` → your GitHub repos; `code > cmd` → Command Palette;
 * `code profile`, `code sync`; anything else → Search Recent Projects for it.
 */
type Entry = {
  title: string;
  subtitle: string;
  icon: string;
  target?: "projects" | "extensions" | "install" | "clone" | "themes";
  action?: string;
  words?: string;
  autocomplete?: string;
  vscodeOnly?: boolean;
};

const commands = (): Entry[] => {
  const name = shortName();
  return [
    {
      title: "Search Recent Projects",
      subtitle: `Search and open recent projects from ${editor().title}`,
      icon: "icons/projects.png",
      target: "projects",
      words: "recent open folder workspace project",
    },
    {
      title: "Find Files and Folders",
      subtitle: `Find anything on your Mac and open it in ${name}`,
      icon: "icons/find.png",
      action: "find",
      words: "search spotlight locate project",
    },
    {
      title: `Open with ${editor().title}`,
      subtitle: `Open the selected Finder item (or a typed path) in ${name}`,
      icon: "icons/finder.png",
      action: "finder",
      words: "finder selection path code",
    },
    {
      title: "Clone Repository",
      subtitle: "Type a folder for suggestions, then paste a git URL",
      icon: "icons/clone.png",
      autocomplete: "clone ",
      words: "git github gitlab repo",
    },
    {
      title: "GitHub Repositories",
      subtitle: "Search your GitHub repos and clone one",
      icon: "icons/github.png",
      autocomplete: "gh ",
      words: "github gh repo repositories",
    },
    {
      title: "Change Theme",
      subtitle: "Pick a color theme for a profile",
      icon: "icons/themes.png",
      target: "themes",
      words: "theme color colour dark light appearance",
      vscodeOnly: true,
    },
    {
      title: "Show Installed Extensions",
      subtitle: "Manage installed extensions",
      icon: "icons/extensions.png",
      target: "extensions",
      words: "ext extension plugins uninstall",
      vscodeOnly: true,
    },
    {
      title: "Install Extension",
      subtitle: "Install extensions from the Marketplace",
      icon: "icons/install.png",
      target: "install",
      words: "marketplace add ext extension",
      vscodeOnly: true,
    },
    {
      title: "Open with Profile",
      subtitle: "Open a new window with one of your profiles",
      icon: "icons/profiles.png",
      autocomplete: "profile ",
      words: "profile profiles switch",
      vscodeOnly: true,
    },
    {
      title: "Settings Sync",
      subtitle: "Sync now, turn on or off",
      icon: "icons/sync.png",
      autocomplete: "sync ",
      words: "sync settings backup",
      vscodeOnly: true,
    },
    {
      title: "Command Palette",
      subtitle: `Type > and a command to run it in ${name}`,
      icon: "icons/palette.png",
      autocomplete: "> ",
      words: "command palette run",
    },
    {
      title: "Open New Window",
      subtitle: `Open a new ${name} window`,
      icon: "icons/window.png",
      action: "new-window",
      words: "window empty",
    },
    {
      title: "Open Agents Window",
      subtitle: "Open the Agents Window",
      icon: "icons/agents.png",
      action: "agents",
      words: "agent ai chat",
      vscodeOnly: true,
    },
  ].filter((e) => !(e.vscodeOnly && editor().kind === "zed")) as Entry[];
};

/** Every query word must start a word in the title or the extra keywords. */
export const matches = (entry: Pick<Entry, "title" | "words">, query: string): boolean => {
  const haystack = `${entry.title} ${entry.words ?? ""}`.toLowerCase().split(/[^a-z0-9]+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => haystack.some((w) => w.startsWith(q)));
};

const toItem = (entry: Entry, arg = "") => ({
  title: entry.title,
  subtitle: entry.subtitle,
  arg,
  icon: { path: entry.icon },
  valid: !entry.autocomplete,
  ...(entry.autocomplete && { autocomplete: entry.autocomplete }),
  variables: { vsc_target: entry.target ?? "action", vsc_action: entry.action ?? "" },
});

const actionItem = (title: string, subtitle: string, iconPath: string, action: string, arg: string) => ({
  title,
  subtitle,
  arg,
  icon: { path: iconPath },
  variables: { vsc_target: "action", vsc_action: action },
});

/** A typed path that exists: open it directly (the old `code <path>` keyword). */
const pathItem = (input: string) => {
  const path = untildify(input.trim());
  return /^[~/]/.test(input.trim()) && existsSync(path)
    ? [
        {
          ...actionItem(`Open ${input.trim()}`, `Open in ${shortName()}`, "icons/finder.png", "path", path),
          type: "file",
        },
      ]
    : [];
};

const SYNC = [
  ["Sync Now", "Settings Sync: Sync Now"],
  ["Turn On Settings Sync…", "Settings Sync: Backup and Sync Settings..."],
  ["Turn Off Settings Sync", "Settings Sync: Turn Off"],
  ["Show Synced Data", "Settings Sync: Show Synced Data"],
  ["Settings Sync Settings", "Settings Sync: Show Settings"],
];

const subItems = async (q: string) => {
  const lower = q.toLowerCase();
  if (q.startsWith(">")) {
    const cmd = q.slice(1).trim();
    return [
      actionItem(
        cmd ? `Run “${cmd}”` : "Command Palette",
        cmd
          ? `In ${shortName()}'s Command Palette (needs Accessibility for Alfred)`
          : "Type a command after >",
        "icons/palette.png",
        "palette",
        cmd,
      ),
    ];
  }
  if (/^sync\b/.test(lower)) {
    const rest = lower.slice(4).trim();
    return SYNC.filter(([t]) => !rest || matches({ title: t! }, rest)).map(([t, cmd]) =>
      actionItem(t!, `Runs “${cmd}” in ${shortName()}`, "icons/sync.png", "palette", cmd!),
    );
  }
  if (/^profiles?\b/.test(lower)) {
    const rest = lower.replace(/^profiles?/, "").trim();
    return profiles()
      .filter((p) => !rest || p.name.toLowerCase().includes(rest))
      .map((p) =>
        actionItem(
          p.name,
          `Open a new ${shortName()} window with this profile`,
          "icons/profiles.png",
          "profile",
          p.name,
        ),
      );
  }
  if (/^gh\b/.test(lower)) {
    const rest = q.slice(2).trim();
    if (!ghInstalled())
      return [
        {
          title: "GitHub CLI not found",
          subtitle: "Install it with: brew install gh, then gh auth login",
          valid: false,
        },
      ];
    try {
      const mine = (await myRepos()).filter(
        (r) => !rest || r.name.toLowerCase().includes(rest.toLowerCase()),
      );
      const others =
        rest.length >= 3 ? (await searchRepos(rest)).filter((r) => !mine.some((m) => m.url === r.url)) : [];
      return [...mine.slice(0, 30), ...others].map((r) => {
        const repo = parseRepo(r.url)!;
        return {
          ...cloneItem(repo, defaultCloneDir(), r.name),
          subtitle: `${r.private ? "🔒 " : ""}${r.description || r.url}  ·  ↩ clone  ·  ⌘↩ clone now`,
          icon: { path: "icons/github.png" },
        };
      });
    } catch (error) {
      return [
        { title: "GitHub", subtitle: error instanceof Error ? error.message : String(error), valid: false },
      ];
    }
  }
  return undefined;
};

export const rootItems = async (query: string) => {
  const q = query.trim();
  const all = commands();
  if (!q) {
    // A git URL on the clipboard goes first: `code` ↩ clones it.
    const clip = await clipboardRepo();
    return [...(clip ? [cloneItem(clip, defaultCloneDir())] : []), ...all.map((e) => toItem(e))];
  }

  const sub = await subItems(q);
  if (sub) return sub;
  // `code clone …` behaves exactly like `codec …` (folder suggestions, clipboard URL, ⌘↩).
  if (/^clone\b/i.test(q)) return cloneFilterItems(q.replace(/^clone\s*/i, ""), "clone ");
  const typed = parseRepo(q);
  if (typed) return [cloneItem(typed, defaultCloneDir())];
  const path = pathItem(q);
  if (path.length) return path;

  const hits = all.filter((e) => matches(e, q)).map((e) => toItem(e));
  // `install prettier`: the first word picks the command, the rest is its search.
  const [head = "", ...rest] = q.split(/\s+/);
  // An exact word ("install") beats a prefix ("installed").
  const exact = (e: Entry) =>
    `${e.title} ${e.words ?? ""}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .includes(head.toLowerCase());
  const lead = rest.length
    ? all
        .filter((e) => e.target && matches(e, head))
        .toSorted((a, b) => Number(exact(b)) - Number(exact(a)))
        .map((e) => ({ ...toItem(e, rest.join(" ")), subtitle: `${e.title} for “${rest.join(" ")}”` }))
    : [];
  const projects = all.find((e) => e.target === "projects")!;
  return [...lead, ...hits, { ...toItem(projects, q), title: `Search Recent Projects for “${q}”` }];
};

export const root = async ([query = ""]: string[]): Promise<void> => {
  process.stdout.write(JSON.stringify({ items: await rootItems(query) }));
};

const ACTIONS: Record<string, (arg: string) => Promise<string>> = {
  "new-window": async () => (await newWindow(), ""),
  agents: async () => (await agentsWindow(), ""),
  find: async () => (await alfredSearch(`${str("kw_find", "codef")} `), ""),
  path: async (arg) => (await openPath(arg), ""),
  palette: async (arg) => (await runPaletteCommand(arg), ""),
  profile: async (arg) => (await openWithProfile(arg), ""),
  "clone-now": async (arg) => {
    const [url = "", parent = defaultCloneDir()] = arg.split("\t");
    const repo = parseRepo(url);
    if (!repo) return `Not a git URL: ${url}`;
    const dest = targetPath(parent, repo.name);
    const result = await cloneRepo(repo.url, dest);
    await openPath(dest);
    return result === "exists" ? `Opened existing ${tildify(dest)}` : `Cloned into ${tildify(dest)}`;
  },
  finder: async () => {
    const paths = await finderSelection();
    if (!paths.length) return "Nothing selected in Finder";
    for (const p of paths) await openPath(p);
    return "";
  },
};

/** Run Script after the menu: prints a line for the notification (empty = none). */
export const rootAction = async ([arg = ""]: string[]): Promise<void> => {
  const action = ACTIONS[process.env.vsc_action ?? ""];
  if (action) process.stdout.write(await action(arg));
};
