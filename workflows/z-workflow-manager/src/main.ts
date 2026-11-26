import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { rowIcon, loadIcons } from "./icons.ts";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir } from "./env.ts";
import { randomUUID } from "node:crypto";
import { catalog, combine, scan, newer, installer, removeInstalled, type Entry } from "./catalog.ts";
import { create, read, save, type State } from "./state.ts";
import { components, run } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  print,
  merge,
  vars,
  update,
  finish,
  open,
  popup,
  menuItem,
  separator,
  sheet,
  copy,
  errorStatus,
  type Action,
} from "./ui.ts";
const visible = (s: State) =>
  s.entries.filter(
    (e) =>
      (s.filter === "all" ||
        (s.filter === "installed" && e.path) ||
        (s.filter === "available" && !e.path) ||
        (s.filter === "updates" && e.path && newer(e.latest, e.version))) &&
      s.query
        .toLowerCase()
        .split(/\s+/)
        .every((q) => `${e.name} ${e.bundle} ${e.description}`.toLowerCase().includes(q)),
  );
const description = (e: Entry) =>
  `${e.path ? `Installed ${e.version || "(unversioned)"}` : "Not installed"}${e.latest ? ` · Latest ${e.latest}` : " · Update source unknown"}${e.development ? " · Development link" : ""} · ${e.description}`;
const rows = (s: State): Action => {
  const data = visible(s),
    installedMatches = s.filter === "available" ? visible({ ...s, filter: "installed" }).length : 0;
  return update(
    {
      items: {
        data: {
          src: data.map((e) => ({
            uid: e.uid,
            "rowFlag.image.type": "file",
            "rowFlag.image.src": rowIcon(e),
            "rowTitle.text": `${e.path && newer(e.latest, e.version) ? "↑ " : ""}${e.name}`,
            "rowDescription.text": description(e),
            "rowTitle.colour": e.path && newer(e.latest, e.version) ? "systemOrangeColor" : "labelColor",
          })),
        },
        select: data.some((e) => e.uid === s.selected) ? s.selected : data[0]?.uid || "",
        placeholder:
          installedMatches && !data.length
            ? `${installedMatches} matching workflow${installedMatches === 1 ? " is" : "s are"} already installed. Choose Show Installed to manage ${installedMatches === 1 ? "it" : "them"}.`
            : s.filter === "updates"
              ? "No verified updates match. Use Check for Updates in Actions."
              : s.filter === "available"
                ? "No uninstalled workflows match. Try All workflows or another search."
                : "No workflows match this search.",
      },
      copyButton: {
        hidden: !data.length && !installedMatches,
        text:
          !data.length && installedMatches
            ? "Show Installed  ↩"
            : (s.entries.find((e) => e.uid === s.selected) || visible(s)[0])?.path
              ? "Configure  ↩"
              : "Install  ↩",
      },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const screen = (s: State): Action =>
  merge(vars({ wfman_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/wfman", args: ["populate", s.id], interval: 0, now: true },
  });
const load = async (s: State, fresh = false): Promise<Action> => {
  const ticket = randomUUID();
  s.request = ticket;
  save(s);
  const local = scan();
  let entries = local,
    message = "Installed workflows · Gallery unavailable";
  try {
    const data = await catalog(fresh);
    entries = combine(local, data.entries);
    message = `${local.length} installed · Gallery checked ${new Date(data.fetched).toLocaleTimeString()}${data.stale ? " · Some sources unavailable; metadata may be cached" : ""}`;
  } catch (e) {
    message += ` · ${e instanceof Error ? e.message : "Fetch failed"}`;
  }
  const latest = read(s.id);
  if (latest.request !== ticket) return {};
  latest.entries = entries;
  latest.status = message;
  save(latest);
  return rows(latest);
};
const selected = (s: State, uid: string): Entry => {
  const e = s.entries.find((entry) => entry.uid === uid);
  if (!e) throw new Error("Select a workflow.");
  return e;
};
const configure = (e: Entry, config = true): void => {
  if (!e.path) throw new Error("Install this workflow first.");
  execFileSync(
    "/usr/bin/osascript",
    [
      "-e",
      `on run argv\ntell application id "com.runningwithcrayons.Alfred" to reveal workflow (item 1 of argv) configuration ${config ? "true" : "false"}\nend run`,
      e.uid,
    ],
    { timeout: 5000 },
  );
};
const installEntry = async (e: Entry): Promise<Action> => {
  const url = installer(e);
  if (e.source === "gallery") return open(url);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error(`Download HTTP ${response.status}`);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 50e6) throw new Error("Workflow download exceeds 50 MB.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error("Downloaded workflow is not a ZIP archive.");
  const path = join(cacheDir(), `install-${randomUUID()}.alfredworkflow`);
  writeFileSync(path, bytes, { mode: 0o600 });
  execFileSync("/usr/bin/open", [path], { timeout: 5000 });
  return {};
};
const queueNext = async (s: State): Promise<Action> => {
  const uid = s.queue.shift();
  if (!uid) {
    s.installing = undefined;
    s.status = "Update queue complete. Refresh to check installed versions.";
    save(s);
    return merge(rows(s), { pulse: { interval: 0, now: false } });
  }
  const e = selected(s, uid);
  s.installing = { bundle: e.bundle, version: e.latest };
  s.status = `Install ${e.name} in Alfred’s installer · ${s.queue.length} remaining · Cancel queue in Actions`;
  save(s);
  return merge(await installEntry(e), rows(s), {
    pulse: { src: "../bin/wfman", args: ["queue-poll", s.id], interval: 2, now: false },
  });
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "prepare-origin") return vars(backVariables("wfman_out", process.env.wfman_query));
  if (cmd === "post") {
    if (process.env.wfman_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const s = create(launchInput(process.env.wfman_query).query);
    s.entries = scan();
    save(s);
    return merge(screen(s), {
      pulse: { src: "../bin/wfman", args: ["load", s.id], interval: 0, now: true },
    });
  }
  const s = read(id),
    uid = args[0] || s.selected;
  if (cmd === "back") return finish(backVariables("wfman_out", process.env.wfman_query));
  if (cmd === "populate") return rows(s);
  if (cmd === "icons") {
    await loadIcons(args[0] ? s.entries.filter((e) => e.uid === args[0]) : visible(s));
    const current = read(s.id);
    return rows(current);
  }
  if (cmd === "load" || cmd === "refresh") return load(s, cmd === "refresh");
  if (cmd === "select") {
    s.selected = uid;
    save(s);
    const entry = s.entries.find((e) => e.uid === uid);
    if (!entry) return {};
    if (!entry) return {};
    return merge(
      update({ copyButton: { text: entry?.path ? "Configure  ↩" : "Install  ↩" } }),
      !s.installing && entry?.source === "gallery" && !entry.path && rowIcon(entry) === entry.icon
        ? { pulse: { src: "../bin/wfman", args: ["icons", s.id, uid], interval: 0, now: true } }
        : {},
    );
  }
  if (cmd === "query" || cmd === "filter") {
    if (cmd === "query") s.query = args[0] || "";
    else s.filter = args[0] || "installed";
    s.selected = "";
    save(s);
    return merge(
      rows(s),
      s.installing ? {} : { pulse: { src: "../bin/wfman", args: ["icons", s.id], interval: 0, now: true } },
    );
  }
  if (cmd === "queue-poll") {
    if (!s.installing) return {};
    const local = scan().find((e) => e.bundle === s.installing!.bundle);
    if (local && (local.version === s.installing.version || newer(local.version, s.installing.version)))
      return queueNext(s);
    return {};
  }
  if (cmd === "cancel-queue") {
    s.queue = [];
    s.installing = undefined;
    s.status = "Update queue cancelled.";
    save(s);
    return merge(rows(s), { pulse: { interval: 0, now: false } });
  }
  if (cmd === "update-all") {
    s.queue = s.entries
      .filter(
        (e) =>
          e.path &&
          !e.development &&
          e.bundle !== "com.izsk.workflow-manager" &&
          e.source !== "unknown" &&
          newer(e.latest, e.version),
      )
      .map((e) => e.uid);
    if (!s.queue.length) throw new Error("No verified updates available. Check for Updates first.");
    save(s);
    return queueNext(s);
  }
  if (cmd === "menu") {
    const e = s.entries.find((entry) => entry.uid === uid),
      items: Action[] = [];
    if (e) {
      if (e.path) {
        items.push(
          menuItem("Open Configuration", ["configure", id, uid]),
          menuItem("Edit Workflow", ["edit", id, uid]),
          menuItem("Reveal in Finder", ["reveal", id, uid]),
        );
        if (e.source !== "unknown")
          items.push(menuItem("Update / Reinstall in Alfred", ["install", id, uid]));
        items.push(menuItem("Move Workflow to Trash…", ["remove-review", id, uid]));
      } else items.push(menuItem("Install in Alfred", ["install", id, uid]));
      if (e.url) items.push(menuItem("Open Workflow Page", ["website", id, uid]));
      items.push(menuItem("Copy Workflow Info", ["copy", id, uid]), separator);
    }
    items.push(
      menuItem("Check for Updates", ["refresh", id], "⌘R"),
      menuItem("Update All Available (review in Alfred)", ["update-all", id]),
      menuItem("Cancel Update Queue", ["cancel-queue", id]),
    );
    return popup("actionsButton", items);
  }
  if (
    cmd === "activate" &&
    !visible(s).length &&
    s.filter === "available" &&
    visible({ ...s, filter: "installed" }).length
  ) {
    s.filter = "installed";
    s.selected = "";
    save(s);
    return merge(rows(s), update({ filter: { selected: "installed" } }));
  }
  const e = selected(s, uid);
  if (cmd === "activate") {
    if (e.path) {
      configure(e);
      return {};
    }
    return installEntry(e);
  }
  if (cmd === "configure" || cmd === "edit") {
    configure(e, cmd === "configure");
    return {};
  }
  if (cmd === "install") return installEntry(e);
  if (cmd === "website") return open(e.url);
  if (cmd === "reveal") {
    execFileSync("/usr/bin/open", ["-R", e.path]);
    return {};
  }
  if (cmd === "copy") return copy(`${e.name}\n${e.bundle}\n${description(e)}\n${e.url}`);
  if (cmd === "remove-review")
    return sheet("removeSheet", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 18,
      components: [
        { type: "label", text: `Move ${e.name} to Trash?`, font: { size: 20, weight: "semibold" } },
        {
          type: "label",
          text: e.development
            ? "Only the development symlink is removed. Repository files are preserved."
            : "The installed workflow folder is moved to Trash. Workflow Data and cached settings outside it are retained.",
          linebreak: "wordwrap",
          constraints: { size: { width: 500 } },
        },
        {
          type: "button",
          text: "Move to Trash",
          events: [{ triggers: "actioned", action: run("remove", [uid]) }],
        },
      ],
    });
  if (cmd === "remove") {
    removeInstalled(e);
    s.entries = s.entries.filter((x) => x.uid !== uid);
    s.selected = "";
    save(s);
    return merge({ sheet: { close: "removeSheet" } }, rows(s));
  }
  throw new Error("Unknown Workflow Manager action.");
};
try {
  const action = await main();
  if (action) print(action);
} catch (e) {
  print(errorStatus(e));
}
