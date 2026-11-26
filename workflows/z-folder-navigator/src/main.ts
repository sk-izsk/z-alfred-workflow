import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { create, read, save, push, previous, type State } from "./state.ts";
import { item, children, search, containingFolder, type Item } from "./files.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  merge,
  vars,
  update,
  finish,
  copy,
  popup,
  menuItem,
  separator,
  errorStatus,
  type Action,
} from "./ui.ts";
const rows = (s: State): Action =>
  update(
    {
      items: {
        data: {
          src: s.items.map((e) => ({
            uid: e.uid,
            "rowFlag.image.type": "fileicon",
            "rowFlag.image.src": e.uid,
            "rowTitle.text": e.name,
            "rowDescription.text":
              s.mode === "search"
                ? e.uid
                : `${e.kind === "folder" ? "Folder" : e.kind === "package" ? "Package" : e.link ? "Symbolic link" : "File"}${e.link ? " · Link" : ""}`,
          })),
        },
        select: s.items.some((e) => e.uid === s.selected) ? s.selected : s.items[0]?.uid || "",
        placeholder:
          s.mode === "search"
            ? "No indexed folders found. Try a full path, ~/ or a different name."
            : "No matching files or folders.",
      },
      statusLabel: {
        text: s.status,
        tooltip: s.status,
        colour: s.error ? "systemRedColor" : "secondaryLabelColor",
      },
    },
    true,
  );
const loaded = (s: State): Action => {
  const focus = s.focusPending;
  s.focusPending = false;
  save(s);
  return merge(rows(s), focus ? update({ query: { focus: true } }) : {});
};
const deferred = (s: State): Action => ({
  pulse: { src: "../bin/folders", args: ["load", s.id, s.level, s.request], interval: 0, now: true },
});
const screen = (s: State): Action =>
  merge(
    vars({ folders_session: s.id, folders_level: s.level }),
    update({ root: { components: components(s) } }, true),
    deferred(s),
  );
const navigate = (s: State): Action =>
  merge(
    vars({ folders_level: s.level }),
    update(
      {
        query: {
          text: s.query,
          placeholder: s.mode === "browse" ? "Filter this folder…" : "Search folders, drives or a full path…",
        },
        location: {
          text:
            s.mode === "browse"
              ? s.path
              : s.scope
                ? `Search within ${s.scope}`
                : "Mounted drives and starting folders",
          tooltip: s.path || s.scope,
        },
        items: { data: { src: [] }, select: "", placeholder: "Loading…" },
        statusLabel: { text: s.status, colour: "secondaryLabelColor" },
      },
      true,
    ),
    deferred(s),
  );
const bounded = async <T>(operation: Promise<T>, ms = 6000): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Folder read timed out. Go Back or try a local folder.")),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
};
const load = async (s: State, ticket: string): Promise<Action> => {
  if (s.request !== ticket) return {};
  if (s.mode === "search") {
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (read(s.id).request !== ticket) return {};
  }
  try {
    const result =
        s.mode === "browse"
          ? { ...(await bounded(children(s.path, s.hidden, s.query))), warning: "" }
          : await search(s.query, s.scope, s.hidden),
      latest = read(s.id);
    if (latest.request !== ticket || latest.level !== s.level) return {};
    latest.items = result.items;
    latest.limited = result.limited;
    latest.error = false;
    latest.status = `${result.items.length} ${s.mode === "search" ? "folders" : "entries"}${result.limited ? " · Limited results; narrow the search" : ""}${result.warning ? ` · ${result.warning}` : ""}${s.hidden ? " · Dotfiles shown" : ""}`;
    save(latest);
    return loaded(latest);
  } catch (error) {
    const latest = read(s.id);
    if (latest.request !== ticket || latest.level !== s.level) return {};
    latest.items = [];
    latest.error = true;
    latest.status = error instanceof Error ? error.message : String(error);
    save(latest);
    return loaded(latest);
  }
};
const selected = (s: State, path: string): Item => {
  const entry = s.items.find((e) => e.uid === path);
  if (!entry) throw new Error("Select a file or folder.");
  return entry;
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", level = "", ...args] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("folders_out", process.env.folders_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.folders_out === "back") performBack(process.env.swiss_return);
    if (process.env.folders_out === "file-actions" && process.env.action_path)
      execFileSync(
        "/usr/bin/osascript",
        [
          "-e",
          'on run argv\ntell application id "com.runningwithcrayons.Alfred" to action argv as type "file"\nend run',
          process.env.action_path,
        ],
        { timeout: 5000 },
      );
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.folders_query),
      s = create(origin.query, origin.returnTo);
    return screen(s);
  }
  const s = read(id);
  if (level !== s.level) return {};
  const path = args[0] || s.selected;
  if (cmd === "load") return load(s, args[0] || "");
  if (cmd === "back") {
    if (previous(s)) return navigate(s);
    return finish({ folders_out: "back", swiss_return: s.returnTo });
  }
  if (cmd === "select") {
    if (s.items.some((e) => e.uid === path) && s.selected !== path) {
      s.selected = path;
      save(s);
    }
    return {};
  }
  if (cmd === "query") {
    s.query = args[0] || "";
    s.selected = "";
    s.items = [];
    s.request = randomUUID();
    s.status = "Searching…";
    save(s);
    return merge(rows(s), deferred(s));
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    save(s);
    return deferred(s);
  }
  if (cmd === "hidden") {
    s.hidden = !s.hidden;
    s.request = randomUUID();
    save(s);
    return deferred(s);
  }
  if (cmd === "global") {
    push(s, { mode: "search", path: "", scope: "", query: "", selected: "" });
    return navigate(s);
  }
  if (cmd === "inside") {
    if (s.mode !== "browse") throw new Error("Open a folder first.");
    push(s, { mode: "search", scope: s.path, path: "", query: "", selected: "" });
    return navigate(s);
  }
  if (cmd === "parent") {
    if (s.mode !== "browse") throw new Error("Open a folder first.");
    const parent = dirname(s.path);
    if (parent === s.path) return {};
    push(s, { mode: "browse", path: parent, query: "", selected: s.path });
    return navigate(s);
  }
  if (cmd === "open-current") {
    if (s.mode !== "browse") throw new Error("Open a folder first.");
    execFileSync("/usr/bin/open", [s.path], { timeout: 5000 });
    return {};
  }
  if (cmd === "menu") {
    const entry = s.items.find((e) => e.uid === path),
      actions: Action[] = [];
    if (entry) {
      actions.push(
        menuItem(entry.kind === "folder" ? "Browse Folder" : "Open File", ["enter", id, level, path], "↩"),
        menuItem("Open in Finder / Default App", ["open", id, level, path]),
        menuItem("Reveal in Finder", ["reveal", id, level, path]),
        menuItem("Get Info", ["info", id, level, path]),
        menuItem("Copy Path", ["copy", id, level, path]),
        menuItem("Open Terminal Here", ["terminal", id, level, path]),
        menuItem("All Alfred File Actions…", ["file-actions", id, level, path]),
      );
      if (entry.kind === "package")
        actions.push(menuItem("Show Package Contents", ["package", id, level, path]));
      actions.push(separator);
    }
    if (s.mode === "browse")
      actions.push(
        menuItem("Open Current Folder in Finder", ["open-current", id, level]),
        menuItem("Enclosing Folder", ["parent", id, level]),
        menuItem("Search Nested Folders", ["inside", id, level]),
        menuItem("Search All Folders", ["global", id, level]),
      );
    actions.push(
      menuItem(s.hidden ? "Hide Dotfiles" : "Show Dotfiles", ["hidden", id, level]),
      menuItem("Refresh", ["refresh", id, level], "⌘R"),
      menuItem("Configuration", ["configure", id, level]),
    );
    return popup("actionsButton", actions);
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.folder-navigator" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  const entry = selected(s, path);
  if (cmd === "enter" || cmd === "package") {
    const current = await item(entry.uid);
    if (current.kind === "folder" || (cmd === "package" && current.directory)) {
      s.selected = current.uid;
      push(s, { mode: "browse", path: current.uid, query: "", selected: "" });
      return navigate(s);
    }
    execFileSync("/usr/bin/open", [current.uid], { timeout: 5000 });
    return {};
  }
  if (cmd === "open") {
    execFileSync("/usr/bin/open", [entry.uid], { timeout: 5000 });
    return {};
  }
  if (cmd === "reveal") {
    execFileSync("/usr/bin/open", ["-R", entry.uid], { timeout: 5000 });
    return {};
  }
  if (cmd === "copy") return copy(entry.uid);
  if (cmd === "terminal") {
    execFileSync("/usr/bin/open", ["-a", "Terminal", containingFolder(entry)], { timeout: 5000 });
    return {};
  }
  if (cmd === "file-actions") return finish({ folders_out: "file-actions", action_path: entry.uid });
  if (cmd === "info") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'on run argv\ntell application "Finder" to open information window of (POSIX file (item 1 of argv) as alias)\nend run',
        entry.uid,
      ],
      { timeout: 5000 },
    );
    return {};
  }
  throw new Error("Unknown Folder Navigator action.");
};
// A timed-out network filesystem read must not keep the UI script alive after its error was delivered.
try {
  const action = await main();
  if (action) process.stdout.write(JSON.stringify(action), () => process.exit(0));
  else process.exit(0);
} catch (error) {
  process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0));
}
