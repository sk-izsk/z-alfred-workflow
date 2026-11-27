import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { windowInput } from "./launch.ts";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { listWindows, actOnWindow, matchesWindow, type Scope } from "../../../shared/window-access.ts";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { components } from "../ui/window.ts";
import { backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, errorStatus, type Action } from "./ui.ts";
const visible = (s: State) => s.items.filter((w) => matchesWindow(w, s.query));
const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((w) => w.id === s.selected)) s.selected = rows[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: rows.map((w) => ({
            uid: w.id,
            "rowTitle.text": w.title || w.app,
            "rowDescription.text": `${w.app}${w.minimized ? " · Minimized" : ""}`,
            "rowIcon.image.type": w.appPath ? "fileicon" : "symbol",
            "rowIcon.image.src": w.appPath || "macwindow",
          })),
        },
        select: s.selected,
        placeholder: s.status,
      },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/wnav", args: ["load", s.id, s.request], interval: 0, now: true },
});
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("wnav_out", process.env.wnav_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.wnav_out === "back") performBack(process.env.swiss_return);
    if (["raise", "close", "quit"].includes(process.env.wnav_out || "")) {
      const s = read(process.env.wnav_session || ""),
        target = s.items.find((w) => w.id === process.env.wnav_target);
      if (!target) throw new Error("Window selection expired. Reopen the workflow.");
      try {
        await actOnWindow(process.env.wnav_out!, target);
      } catch (error) {
        s.status = error instanceof Error ? error.message : String(error);
        save(s);
        execFileSync(
          "/usr/bin/osascript",
          [
            "-e",
            'on run argv\ntell application id "com.runningwithcrayons.Alfred" to run trigger "open" in workflow "com.izsk.window-navigator" with argument (item 1 of argv)\nend run',
            `resume:${s.id}`,
          ],
          { timeout: 5000 },
        );
      }
    }
    return;
  }
  if (cmd === "launch") {
    const raw = process.env.wnav_query || "",
      origin = raw.startsWith("resume:") ? null : windowInput(raw),
      s = origin ? create(origin.query, origin.returnTo) : read(raw.slice(7));
    if (origin) {
      s.scope = origin.scope;
      save(s);
    }
    return merge(
      vars({ wnav_session: s.id }),
      update({ root: { components: components(s.query, s.scope) } }, true),
      origin ? pulse(s) : { pulse: { src: "../bin/wnav", args: ["populate", s.id], interval: 0, now: true } },
    );
  }
  const s = read(id);
  if (cmd === "populate") return render(s);
  if (cmd === "back") return finish({ wnav_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const items = await listWindows(s.scope, s.scope !== "desktop"),
        latest = read(id);
      if (latest.request !== value) return {};
      latest.items = items;
      latest.status = `${items.length} windows · ${s.scope === "desktop" ? "Current desktop" : s.scope === "active" ? "Active app" : "All desktops"}`;
      save(latest);
      return render(latest);
    } catch (error) {
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.status = error instanceof Error ? error.message : String(error);
      latest.items = [];
      save(latest);
      return render(latest);
    }
  }
  if (cmd === "query") {
    s.query = value;
    save(s);
    return render(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    if (s.items.some((w) => w.id === value)) {
      s.selected = value;
      save(s);
    }
    return {};
  }
  if (cmd === "scope") {
    if (!["all", "active", "desktop"].includes(value)) return {};

    s.scope = value as Scope;
    s.items = [];
    s.request = randomUUID();
    s.status = "Loading windows…";
    save(s);
    return merge(render(s), pulse(s));
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    save(s);
    return merge(render(s), pulse(s));
  }
  if (cmd === "open" || cmd === "close" || cmd === "quit") {
    const target = s.items.find((w) => w.id === (value || s.selected));
    if (!target) throw new Error("Select a window.");
    s.selected = target.id;
    save(s);
    return finish({ wnav_out: cmd === "open" ? "raise" : cmd, wnav_session: s.id, wnav_target: target.id });
  }
  if (cmd === "copy") {
    const target = s.items.find((w) => w.id === (value || s.selected));
    if (!target) throw new Error("Select a window.");
    return copy(target.title);
  }
  if (cmd === "permissions") {
    execFileSync(
      "/usr/bin/open",
      ["x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"],
      { timeout: 3000 },
    );
    return {};
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.window-navigator" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Switch to Window", ["open", id, value || s.selected]),
      menuItem("Close Window", ["close", id, value || s.selected]),
      menuItem("Quit Owning App", ["quit", id, value || s.selected]),
      menuItem("Copy Window Title", ["copy", id, value || s.selected]),
      menuItem("Refresh", ["refresh", id]),
      menuItem("Accessibility Settings…", ["permissions", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
