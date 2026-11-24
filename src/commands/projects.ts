import { join } from "node:path";
import { EDITORS, editor, shortName } from "../editors.ts";
import { cacheDir, readJson, str, writeJson } from "../env.ts";
import { type GitStatus, branch, gitStatus, remoteUrl, webUrl } from "../git.ts";
import {
  installedEditors,
  openInTerminal,
  openPathIn,
  openProject,
  openUrl,
  openWithProfile,
  revealInFinder,
} from "../launch.ts";
import { movePin, pins, togglePin } from "../pins.ts";
import { profiles } from "../profiles.ts";
import { KIND_FILTERS, type Project, byKind, discovered, recents, removeRecent } from "../projects.ts";
import { cachedRepos, refreshRepos } from "../scan.ts";
import {
  type Action,
  copy,
  finish,
  menuItem,
  merge,
  popup,
  rows,
  separator,
  status,
  update,
  vars,
} from "../ui.ts";
import { entry, icon } from "./common.ts";

const SYMBOL: Record<string, string> = { remote: "network", workspace: "square.stack.3d.up" };

// ── git status cache: rows render from it instantly, a background refresh keeps it current ──
type StatusMap = Record<string, GitStatus>;
const statusFile = () => join(cacheDir(), "git-status.json");
const cachedStatus = (): StatusMap => readJson<StatusMap>(statusFile(), {});

const syncText = (s?: GitStatus) =>
  s ? [s.ahead && `↑${s.ahead}`, s.behind && `↓${s.behind}`].filter(Boolean).join(" ") : "";

export const toRow = (p: Project, pinned: boolean, showBranch: boolean, s?: GitStatus) => {
  const b = showBranch && p.path ? branch(p.path) : "";
  const sync = syncText(s);
  return {
    uid: p.uri,
    ...(p.path ? icon("fileicon", p.path) : icon("symbol", SYMBOL[p.kind] ?? "folder")),
    "rowTitle.text": p.name,
    "rowDetail.text": p.discovered ? `${p.detail} · not opened yet` : p.detail,
    "rowBranch.text": b,
    "rowBranchPill.hidden": !b,
    "rowDirty.hidden": !s?.dirty,
    "rowSync.text": sync,
    "rowSync.hidden": !sync,
    "rowPin.hidden": !pinned,
    match: [p.name, p.detail, b, p.kind].join(" "),
  };
};

/** Pinned first (in pin order), then the editor's own recency order. */
export const ordered = (list: Project[], pinned: string[]): Project[] => [
  ...pinned.map((uri) => list.find((p) => p.uri === uri)).filter((p): p is Project => !!p),
  ...list.filter((p) => !pinned.includes(p.uri)),
];

/** Recents + repos found by the folder scan. */
const allProjects = async (): Promise<Project[]> => {
  const list = await recents();
  return [...list, ...discovered(cachedRepos(), list)];
};

/** The saved type filter, never trusted blindly: an unknown `selected` value makes Alfred drop the action. */
const savedFilter = (): string => {
  const value = process.env.type_filter ?? "all";
  return KIND_FILTERS.some((f) => f.value === value) ? value : "all";
};

const load = async (filter: string): Promise<Action> => {
  const pinned = pins();
  const list = ordered((await allProjects()).filter(byKind(filter)), pinned);
  const showBranch = str("show_branch", "1") !== "0";
  const git = cachedStatus();
  return merge(
    rows(
      "items",
      list.map((p) => toRow(p, pinned.includes(p.uri), showBranch, git[p.path])),
    ),
    update({ sectionLabel: { text: pinned.length ? "Pinned · Recent Projects" : "Recent Projects" } }, true),
    status(list.length ? "Search Recent Projects" : "No recent projects found"),
  );
};

export const projectsInit = async (): Promise<Action> => load(savedFilter());

/** Picker choices, on their own so a picker problem can never empty the list. */
export const projectsPicker = async (): Promise<Action> =>
  update({ typePicker: { items: KIND_FILTERS, selected: savedFilter() } });

export const projectsFilter = async ([filter = "all"]: string[]): Promise<Action> =>
  merge(vars({ type_filter: filter }), await load(filter));

/**
 * Background (async): rescan folders if stale, refresh git status. Re-sends the rows only when
 * something changed, so an unchanged list keeps your selection.
 */
export const projectsRefresh = async (): Promise<Action> => {
  const scanned = refreshRepos();
  const repos = (await allProjects()).filter((p) => p.git);
  const before = cachedStatus();
  const after: StatusMap = {};
  const queue = [...repos];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const s = await gitStatus(p.path);
      if (s) after[p.path] = s;
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  writeJson(statusFile(), after);
  return scanned || JSON.stringify(before) !== JSON.stringify(after) ? load(savedFilter()) : {};
};

const find = async (uri: string): Promise<Project> => {
  const p = (await allProjects()).find((x) => x.uri === uri);
  if (!p) throw new Error("Select a project first");
  return p;
};

const menu = (p: Project): Action => {
  const item = entry("project", p.uri);
  const pinned = pins();
  const isPinned = pinned.includes(p.uri);
  const at = pinned.indexOf(p.uri);
  const remote = p.path ? webUrl(remoteUrl(p.path)) : "";
  const others = installedEditors().filter((e) => e.id !== editor().id);
  const vscodeLike = editor().kind === "vscode";
  return popup("actionsButton", [
    item(`Open in ${shortName()}`, "open", "↩"),
    item(`Open in ${shortName()} and Close Other`, "open-close", "⇧⌘↩"),
    ...(p.path && others.length
      ? [
          {
            text: "Open in",
            submenu: others.map((e) => menuItem(e.title, ["project", `open-in:${e.id}`, p.uri])),
          },
        ]
      : []),
    ...(vscodeLike && p.path
      ? [
          {
            text: "Open with Profile",
            submenu: profiles().map((pr) => menuItem(pr.name, ["project", `profile:${pr.name}`, p.uri])),
          },
        ]
      : []),
    separator,
    ...(p.path
      ? [
          item("Show in Finder", "reveal", "⇧⌘F"),
          item("Open With…", "open-with", "⌘O"),
          item(`Open in ${str("terminal_app", "Terminal")}`, "terminal", "⇧⌘T"),
        ]
      : []),
    ...(remote
      ? [item(`Open on ${new URL(remote).hostname}`, "web", "⇧⌘G"), item("Copy Remote URL", "copy-remote")]
      : []),
    separator,
    item("Copy Name", "copy-name", "⇧⌘C"),
    item(p.path ? "Copy Path" : "Copy URI", "copy-path", "⇧⌘."),
    separator,
    item(isPinned ? "Unpin" : "Pin", "pin", "⇧⌘P"),
    ...(isPinned && at > 0 ? [item("Move Up", "up")] : []),
    ...(isPinned && at < pinned.length - 1 ? [item("Move Down", "down")] : []),
    ...(p.discovered ? [] : [separator, item("Remove from Recent Projects", "remove", "⌃X")]),
  ]);
};

const refresh = async (note: string) => merge(await load(savedFilter()), status(note));

export const project = async ([action = "", uri = ""]: string[]): Promise<Action> => {
  const p = await find(uri);
  if (action.startsWith("open-in:")) {
    const target = EDITORS.find((e) => e.id === action.slice(8));
    if (!target || !p.path) throw new Error("Can't open that here");
    await openPathIn(target, p.path);
    return finish();
  }
  if (action.startsWith("profile:")) {
    await openWithProfile(action.slice(8), p.path);
    return finish();
  }
  switch (action) {
    case "open":
      await openProject(p, str("close_others") === "1");
      return finish();
    case "open-close":
      await openProject(p, str("close_others") !== "1");
      return finish();
    case "reveal":
      await revealInFinder(p.path);
      return finish();
    case "terminal":
      await openInTerminal(p.kind === "folder" ? p.path : p.path.replace(/\/[^/]+$/, ""));
      return finish();
    case "open-with":
      if (!p.path) throw new Error("Remote projects have no local file");
      // Hand the path to Alfred's File Actions after the window closes (see post.ts).
      return finish({ vsc_out: "file-actions", vsc_path: p.path });
    case "web": {
      const url = webUrl(remoteUrl(p.path));
      if (!url) throw new Error("No remote named origin");
      await openUrl(url);
      return finish();
    }
    case "copy-remote":
      return merge(copy(remoteUrl(p.path)), status("Copied remote URL"));
    case "copy-name":
      return merge(copy(p.name), status(`Copied “${p.name}”`));
    case "copy-path":
      return merge(copy(p.path || p.uri), status(`Copied ${p.path ? "path" : "URI"} of ${p.name}`));
    case "pin":
      return refresh(togglePin(p.uri) ? `Pinned ${p.name}` : `Unpinned ${p.name}`);
    case "up":
    case "down":
      movePin(p.uri, action === "up" ? -1 : 1);
      return refresh(`Moved ${p.name} ${action}`);
    case "remove":
      if (p.discovered) throw new Error("Not in the recent list");
      await removeRecent(p.uri);
      return refresh(`Removed ${p.name} from Recent Projects`);
    case "menu":
      return menu(p);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
