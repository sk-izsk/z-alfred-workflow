import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { scan, stop, restartPlan, quote, type Server } from "./servers.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, open, errorStatus, type Action } from "./ui.ts";
const render = (s: State): Action => {
  const visible = s.rows.filter(
    (e) =>
      (s.filter === "All" || e.framework === s.filter) &&
      `${e.project} ${e.cwd} ${e.framework} ${e.port}`.toLowerCase().includes(s.query.toLowerCase()),
  );
  if (!visible.some((e) => e.id === s.selected)) s.selected = visible[0]?.id || "";
  save(s);
  const frameworks = [...new Set(s.rows.map((e) => e.framework))].toSorted();
  return update(
    {
      items: {
        data: {
          src: visible.map((e) => ({
            uid: e.id,
            "rowTitle.text": `${e.project} · localhost:${e.port}`,
            "rowDescription.text": `${e.framework} · PID ${e.pid} · ${e.cwd}`,
          })),
        },
        select: s.selected,
        placeholder: "No local development servers found.",
      },
      filter: {
        items: [{ text: "All Tools", value: "All" }, ...frameworks.map((value) => ({ text: value, value }))],
        selected: s.filter,
      },
      statusLabel: {
        text: `${s.rows.length} servers · ${s.paused ? "Paused" : new Date().toLocaleTimeString()}`,
      },
    },
    true,
  );
};
const load = async (s: State): Promise<Action> => {
  const rows = await scan();
  const current = read(s.id);
  current.rows = rows;
  return render(current);
};
const terminal = (command: string): void => {
  execFileSync(
    "/usr/bin/osascript",
    [
      "-e",
      'on run argv\ntell application "Terminal"\nactivate\ndo script (item 1 of argv)\nend tell\nend run',
      command,
    ],
    { timeout: 5000 },
  );
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("devservers_out", process.env.devservers_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.devservers_out === "back") performBack(process.env.dev_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.devservers_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ devservers_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      {
        pulse: {
          src: "../bin/devservers",
          args: ["tick", s.id],
          interval: Math.min(60, Math.max(2, Number(str("refresh_seconds", "5")) || 5)),
          now: true,
        },
      },
    );
  }
  const s = read(id);
  if (cmd === "tick") return s.paused ? {} : load(s);
  if (cmd === "refresh") return load(s);
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "filter") {
    s.filter = value;
    return render(s);
  }
  if (cmd === "select") {
    s.selected = value;
    save(s);
    return {};
  }
  if (cmd === "pause") {
    s.paused = !s.paused;
    save(s);
    return render(s);
  }
  if (cmd === "back") return finish({ devservers_out: "back", dev_return: s.returnTo });
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.dev-servers" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  const e = s.rows.find((x) => x.id === (value || s.selected));
  if (cmd === "menu")
    return popup("actionsButton", [
      ...(e
        ? [
            menuItem("Open in Browser", ["open", id, e.id]),
            menuItem("Stop Server", ["stop", id, e.id]),
            menuItem("Copy URL", ["copy", id, e.id]),
            menuItem("Restart Server", ["restart", id, e.id]),
            menuItem("Open in Terminal", ["terminal", id, e.id]),
            menuItem("Show in Finder", ["finder", id, e.id]),
            menuItem("Stop All for Project", ["stop-project", id, e.id]),
          ]
        : []),
      menuItem("Refresh", ["refresh", id]),
      menuItem(s.paused ? "Resume Refresh" : "Pause Refresh", ["pause", id]),
      menuItem("Stop All Listed Servers", ["stop-all", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  if (cmd === "stop-all") {
    await stop(s.rows);
    return load(s);
  }
  if (!e) throw new Error("Select a server.");
  if (cmd === "open") return open(e.url);
  if (cmd === "copy") return copy(e.url);
  if (cmd === "finder") return { open: { type: "file", src: e.cwd } };
  if (cmd === "terminal") {
    terminal(`cd ${quote(e.cwd)}`);
    return {};
  }
  if (cmd === "stop" || cmd === "stop-project") {
    const targets: Server[] = cmd === "stop" ? [e] : s.rows.filter((x) => x.cwd === e.cwd);
    await stop(targets);
    return load(s);
  }
  if (cmd === "restart") {
    const plan = restartPlan(e);
    await stop([e]);
    terminal(`sleep 1; ${plan}`);
    return update({ statusLabel: { text: "Restart handed to Terminal" } }, true);
  }
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {})))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error))));
