import { basename } from "node:path";
import { shortName } from "../editors.ts";
import { branch } from "../git.ts";
import { openInTerminal, openProject, revealInFinder } from "../launch.ts";
import { movePin, pins, togglePin } from "../pins.ts";
import { KIND_FILTERS, type Project, byKind, recents } from "../projects.ts";
import { str } from "../env.ts";
import { type Action, copy, finish, merge, popup, rows, separator, status, update, vars } from "../ui.ts";
import { entry, icon } from "./common.ts";

const SYMBOL: Record<string, string> = { remote: "network", workspace: "square.stack.3d.up" };

export const toRow = (p: Project, pinned: boolean, showBranch: boolean) => {
  const b = showBranch && p.path ? branch(p.path) : "";
  return {
    uid: p.uri,
    ...(p.path ? icon("fileicon", p.path) : icon("symbol", SYMBOL[p.kind] ?? "folder")),
    "rowTitle.text": p.name,
    "rowDetail.text": p.detail,
    "rowBranch.text": b,
    "rowBranchPill.hidden": !b,
    "rowPin.hidden": !pinned,
    match: [p.name, p.detail, b, p.kind].join(" "),
  };
};

/** Pinned first (in pin order), then VS Code's own recency order. */
export const ordered = (list: Project[], pinned: string[]): Project[] => [
  ...pinned.map((uri) => list.find((p) => p.uri === uri)).filter((p): p is Project => !!p),
  ...list.filter((p) => !pinned.includes(p.uri)),
];

const load = async (filter: string): Promise<Action> => {
  const pinned = pins();
  const list = ordered((await recents()).filter(byKind(filter)), pinned);
  const showBranch = str("show_branch", "1") !== "0";
  return merge(
    rows(
      "items",
      list.map((p) => toRow(p, pinned.includes(p.uri), showBranch)),
    ),
    update({ sectionLabel: { text: pinned.length ? "Pinned · Recent Projects" : "Recent Projects" } }, true),
    status(list.length ? "Search Recent Projects" : "No recent projects found"),
  );
};

/** The saved type filter. Read from env (like bitwarden), never trusted blindly: an unknown `selected` value makes Alfred drop the whole action. */
const savedFilter = (): string => {
  const value = process.env.type_filter ?? "all";
  return KIND_FILTERS.some((f) => f.value === value) ? value : "all";
};

export const projectsInit = async (): Promise<Action> => load(savedFilter());

/** Picker choices, sent on their own so a picker problem can never empty the list. */
export const projectsPicker = async (): Promise<Action> =>
  update({ typePicker: { items: KIND_FILTERS, selected: savedFilter() } });

export const projectsFilter = async ([filter = "all"]: string[]): Promise<Action> =>
  merge(vars({ type_filter: filter }), await load(filter));

const find = async (uri: string): Promise<Project> => {
  const p = (await recents()).find((x) => x.uri === uri);
  if (!p) throw new Error("Select a project first");
  return p;
};

const menu = (p: Project): Action => {
  const item = entry("project", p.uri);
  const pinned = pins();
  const isPinned = pinned.includes(p.uri);
  const at = pinned.indexOf(p.uri);
  return popup(
    "actionsButton",
    [
      item(`Open in ${shortName()}`, "open", "↩"),
      item(`Open in ${shortName()} and Close Other`, "open-close", "⇧⌘↩"),
      ...(p.path
        ? [
            item("Show in Finder", "reveal", "⇧⌘F"),
            item("Open With…", "open-with", "⌘O"),
            item(`Open with ${str("terminal_app", "Terminal")}`, "terminal", "⇧⌘T"),
          ]
        : []),
      separator,
      item("Copy Name", "copy-name", "⇧⌘C"),
      item(p.path ? "Copy Path" : "Copy URI", "copy-path", "⇧⌘."),
      separator,
      item(isPinned ? "Unpin" : "Pin", "pin", "⇧⌘P"),
      ...(isPinned && at > 0 ? [item("Move Up", "up")] : []),
      ...(isPinned && at < pinned.length - 1 ? [item("Move Down", "down")] : []),
    ].filter(Boolean) as Action[],
  );
};

const refresh = async (note: string) => merge(await load(savedFilter()), status(note));

export const project = async ([action = "", uri = ""]: string[]): Promise<Action> => {
  const p = await find(uri);
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
    case "copy-name":
      return merge(copy(p.name), status(`Copied “${p.name}”`));
    case "copy-path":
      return merge(copy(p.path || p.uri), status(`Copied ${p.path ? "path" : "URI"} of ${basename(p.name)}`));
    case "pin":
      return refresh(togglePin(p.uri) ? `Pinned ${p.name}` : `Unpinned ${p.name}`);
    case "up":
    case "down":
      movePin(p.uri, action === "up" ? -1 : 1);
      return refresh(`Moved ${p.name} ${action}`);
    case "menu":
      return menu(p);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
