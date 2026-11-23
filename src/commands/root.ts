import { existsSync } from "node:fs";
import { editor, shortName } from "../editors.ts";
import { str, untildify } from "../env.ts";
import { finderSelection } from "../finder.ts";
import { agentsWindow, alfredSearch, newWindow, openPath } from "../launch.ts";
import { parseRepo } from "../clone.ts";

/**
 * The `vsc` Script Filter: one menu for everything, like `bw`.
 * `vsc` → all commands; `vsc install prettier` → Install Extension searching "prettier";
 * `vsc https://github.com/x/y` → Clone; `vsc web` → Search Recent Projects for "web".
 */
type Entry = {
  title: string;
  subtitle: string;
  icon: string;
  target?: "projects" | "extensions" | "install" | "clone";
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
      subtitle: "Paste a git URL after the keyword",
      icon: "icons/clone.png",
      autocomplete: "clone ",
      words: "git github gitlab repo",
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

const cloneItem = (input: string) => {
  const repo = parseRepo(input);
  return repo
    ? [
        {
          ...toItem({ title: "", subtitle: "", icon: "icons/clone.png", target: "clone" }, repo.url),
          title: `Clone ${repo.label}`,
          subtitle: "↩ Choose where to save it, then clone and open",
        },
      ]
    : [];
};

/** A typed path that exists: open it directly (the old `code <path>` keyword). */
const pathItem = (input: string) => {
  const path = untildify(input.trim());
  return input.trim().match(/^[~/]/) && existsSync(path)
    ? [
        {
          ...toItem({ title: "", subtitle: "", icon: "icons/finder.png", action: "path" }, path),
          title: `Open ${input.trim()}`,
          subtitle: `Open in ${shortName()}`,
          type: "file",
        },
      ]
    : [];
};

export const rootItems = (query: string) => {
  const q = query.trim();
  const all = commands();
  if (!q) return all.map((e) => toItem(e));

  const clone = cloneItem(q.replace(/^clone\s+/i, ""));
  if (clone.length) return clone;
  if (/^clone\b/i.test(q)) return [toItem(all.find((e) => e.autocomplete === "clone ")!)];
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
        .map((e) => ({
          ...toItem(e, rest.join(" ")),
          subtitle: `${e.title} for “${rest.join(" ")}”`,
        }))
    : [];
  const projects = all.find((e) => e.target === "projects")!;
  return [...lead, ...hits, { ...toItem(projects, q), title: `Search Recent Projects for “${q}”` }];
};

export const root = async ([query = ""]: string[]): Promise<void> => {
  process.stdout.write(JSON.stringify({ items: rootItems(query) }));
};

const ACTIONS: Record<string, (arg: string) => Promise<string>> = {
  "new-window": async () => (await newWindow(), ""),
  agents: async () => (await agentsWindow(), ""),
  find: async () => (await alfredSearch(`${str("kw_find", "vscf")} `), ""),
  path: async (arg) => (await openPath(arg), ""),
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
