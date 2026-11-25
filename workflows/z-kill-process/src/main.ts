import { launchInput, backVariables, performBack } from "./navigation.ts";
import { randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { processes, metrics, ancestors, appExists } from "./system.ts";
import {
  create,
  read,
  save,
  select,
  selected,
  planFile,
  selectionFile,
  windowFile,
  type State,
} from "./state.ts";
import { render } from "./presentation.ts";
import { titles, operations, makePlan, type Plan, type Operation, bytes } from "./model.ts";
import { executePlan } from "./operations.ts";
import { bool, str, readJson, writeJson } from "./env.ts";
import { exec } from "./proc.ts";
import {
  type Action,
  errorStatus,
  print,
  merge,
  status,
  vars,
  sheet,
  popup,
  menuItem,
  separator,
  copy,
  finish,
} from "./ui.ts";
import { button, label, json, run } from "../ui/window.ts";
const interval = (): number => {
  const n = Number(str("refresh_seconds", "3"));
  return Number.isFinite(n) ? (n === 0 ? 0 : Math.min(60, Math.max(1, n))) : 3;
};
const uid = () => process.getuid?.() ?? -1;
const poll = async (id: string): Promise<Action> => {
  if (!id) return {};
  const initial = read(id),
    ticket = randomUUID();
  initial.request = ticket;
  save(initial);
  const [rows, usage] = await Promise.all([processes(), metrics()]);
  const current = read(id);
  if (current.request !== ticket) return {};
  current.rows = rows;
  current.metrics = usage;
  current.at = Date.now();
  save(current);
  return render(current);
};
const selectedProcess = (s: State, id: string) => {
  const p = s.rows.find((candidate) => candidate.id === (id || selected(s)));
  if (!p) throw new Error("Select a running process first, or refresh with ⌘R.");
  return p;
};
const review = (plan: Plan): Action => {
  const text = plan.targets.map((p) => `${p.name} · PID ${p.pid} · ${p.path}`).join("\n");
  return sheet(
    "confirmSheet",
    {
      type: "view",
      layout: "border",
      padding: 20,
      spacing: 14,
      components: [
        label("confirmTitle", `${titles[plan.operation]}?`, {
          font: { size: 20, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 12,
          constraints: { region: "centre" },
          components: [
            label(
              "confirmMessage",
              `${plan.targets.length} process${plan.targets.length === 1 ? "" : "es"} · ${plan.operation.startsWith("force") ? "SIGKILL stops immediately; unsaved work may be lost." : "SIGTERM requests termination; apps may need to save work."}${plan.app ? " The app will reopen only after the selected processes exit." : ""}`,
              { linebreak: "wordwrap", constraints: { size: { width: 680 } } },
            ),
            {
              type: "textarea",
              text,
              editable: false,
              selectable: true,
              background: null,
              font: { size: 12 },
              constraints: {
                size: { width: 680, height: Math.min(240, Math.max(80, plan.targets.length * 40)) },
              },
            },
          ],
        },
        {
          type: "view",
          layout: "inline",
          spacing: 14,
          constraints: { region: "bottom", position: "right" },
          components: [
            button("cancelAction", "Cancel  ⎋", run("cancel"), { shortcut: "⎋" }),
            button(
              "confirmAction",
              titles[plan.operation],
              [json({ sheet: { close: "confirmSheet" } }), run("execute")],
              { bordered: true, shortcut: "↩" },
            ),
          ],
        },
      ],
    },
    false,
    run("cancel"),
  );
};
const execute = async (s: State): Promise<Action> => {
  const file = planFile(s.id),
    plan = readJson<Plan | null>(file, null);
  if (!plan) throw new Error("No pending confirmation. Select an action first.");
  unlinkSync(file);
  if (plan.app && !appExists(plan.app)) throw new Error("The app has moved or is no longer installed.");
  const latest = await processes();
  let message = "";
  try {
    message = await executePlan(
      plan,
      {
        list: processes,
        signal: (pid, signal) => {
          process.kill(pid, signal);
        },
        open: async (app) => {
          await exec("/usr/bin/open", ["-a", app]);
        },
        sleep: async (ms) => {
          await new Promise((resolve) => setTimeout(resolve, ms));
        },
      },
      uid(),
      ancestors(latest),
    );
  } catch (error) {
    return merge(await poll(s.id), errorStatus(error));
  }
  return merge(await poll(s.id), status(message));
};
const action = async (s: State, verb: string, id: string): Promise<Action> => {
  if (verb === "activity-monitor") {
    await exec("/usr/bin/open", ["-b", "com.apple.ActivityMonitor"]);
    return {};
  }
  if (verb === "pause") return { pulse: { interval: 0 }, ...status("Auto-refresh paused · ⌘R refresh") };
  if (verb === "resume") return { pulse: { interval: interval() || 3 }, ...status("Auto-refresh enabled") };
  const p = selectedProcess(s, id);
  if (verb === "menu")
    return popup("actionsButton", [
      menuItem("Kill", ["action", s.id, "terminate", p.id], "↩"),
      menuItem("Force Kill", ["action", s.id, "force", p.id], "⌘↩"),
      ...(p.app
        ? [
            menuItem("Restart", ["action", s.id, "restart", p.id], "⌥⌘R"),
            menuItem("Force Restart", ["action", s.id, "force-restart", p.id], "⌥⇧⌘R"),
          ]
        : []),
      menuItem("Kill All", ["action", s.id, "terminate-all", p.id], "⌥↩"),
      menuItem("Force Kill All", ["action", s.id, "force-all", p.id], "⌥⇧↩"),
      separator,
      menuItem("Copy Path", ["action", s.id, "copy-path", p.id], "⌥⌘C"),
      menuItem("Copy PID", ["action", s.id, "copy-pid", p.id]),
      menuItem("Show Details", ["action", s.id, "details", p.id]),
      menuItem("Show in Finder", ["action", s.id, "finder", p.id]),
      separator,
      menuItem("Reload", ["poll", s.id], "⌘R"),
      menuItem("Pause Auto-Refresh", ["action", s.id, "pause"]),
      menuItem("Resume Auto-Refresh", ["action", s.id, "resume"]),
      menuItem("Open Activity Monitor", ["action", s.id, "activity-monitor"]),
    ]);
  if (verb === "copy-path") return copy(p.path);
  if (verb === "copy-pid") return copy(String(p.pid));
  if (verb === "finder") {
    if (!p.path.startsWith("/")) throw new Error("No executable path is available.");
    await exec("/usr/bin/open", ["-R", p.path]);
    return {};
  }
  if (verb === "details")
    return sheet("detailsSheet", {
      type: "view",
      layout: "border",
      padding: 20,
      spacing: 12,
      components: [
        label("detailTitle", p.name, {
          font: { size: 20, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          type: "textarea",
          text: `PID: ${p.pid}\nParent PID: ${p.ppid}\nUser ID: ${p.uid}\nCPU: ${p.cpu.toFixed(1)}%\nResident memory: ${bytes(p.memory)}\nStarted: ${p.started}\nExecutable: ${p.path}\nApp: ${p.app || "Background process"}\n\nProcess CPU is sampled by ps and can exceed 100% for multiple cores. RSS includes shared pages.`,
          editable: false,
          selectable: true,
          background: null,
          font: { size: 13 },
          constraints: { region: "centre", size: { width: 680, height: 290 } },
        },
      ],
    });
  if (!operations.includes(verb as Operation)) throw new Error("Unknown process action.");
  const latest = await processes();
  const current = latest.find((row) => row.id === p.id && row.path === p.path);
  if (!current) throw new Error("This process has exited or changed. Refresh the list.");
  const plan = makePlan(verb, current, latest, uid(), ancestors(latest));
  writeJson(planFile(s.id), plan);
  if (!bool("confirm_termination", false)) return execute(s);
  return review(plan);
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "prepare-origin") return vars(backVariables("kp_out", process.env.kp_query));
  if (cmd === "post") {
    if (process.env.kp_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "cleanup") {
    if (!id) return {};
    read(id);
    for (const path of [planFile(id), selectionFile(id)]) {
      try {
        unlinkSync(path);
      } catch {
        /* Already absent. */
      }
    }
    unlinkSync(windowFile(id));
    return {};
  }
  if (cmd === "back") return finish(backVariables("kp_out", process.env.kp_query));
  if (cmd === "launch") {
    const s = create(
      launchInput(process.env.kp_query).query,
      str("default_sort", "cpu") === "memory" ? "memory" : "cpu",
    );
    return merge(
      vars({ kp_session: s.id }),
      await poll(s.id),
      { pulse: { interval: interval() } },
      { update: { ids: { sortPicker: { selected: s.sort } } } },
    );
  }
  if (cmd === "poll") return poll(id);
  const s = read(id);
  if (cmd === "selected") {
    select(s, args[0] || "");
    return {};
  }
  if (cmd === "filter") {
    s.query = args[0] || "";
    s.sort = args[1] === "memory" ? "memory" : "cpu";
    save(s);
    return render(s);
  }
  if (cmd === "action") return action(s, args[0] || "menu", args[1] || "");
  if (cmd === "cancel") {
    try {
      unlinkSync(planFile(s.id));
    } catch {
      /* No pending plan. */
    }
    return { sheet: { close: "confirmSheet" } };
  }
  if (cmd === "execute") return execute(s);
  throw new Error("Unknown Kill Process command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
