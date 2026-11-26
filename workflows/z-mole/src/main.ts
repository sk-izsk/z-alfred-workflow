import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { detailRows } from "../../../shared/dashboard.ts";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, frame, type State } from "./state.ts";
import {
  run,
  parseStatus,
  parseAnalysis,
  cleanOutput,
  folder,
  execution,
  type Mode,
  type Item,
} from "./mole.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, sheet, errorStatus, type Action } from "./ui.ts";
const choices: Item[] = [
  {
    id: "status",
    name: "System Status",
    description: "Health, CPU, memory, disks and power",
    icon: "heart",
    details: [],
  },
  {
    id: "analyze",
    name: "Disk Usage",
    description: "Browse storage use, including external drives",
    icon: "externaldrive",
    details: [],
  },
  {
    id: "clean",
    name: "Clean System",
    description: "Read-only cleanup preview; review before running",
    icon: "trash",
    details: [],
  },
  {
    id: "optimize",
    name: "Optimize System",
    description: "Read-only optimization preview",
    icon: "gauge",
    details: [],
  },
];
const data = (s: State) =>
  (s.mode === "menu" ? choices : s.items).filter((e) =>
    `${e.name} ${e.description}`.toLowerCase().includes(s.query.toLowerCase().trim()),
  );
const render = (s: State): Action => {
  const values = data(s);
  if (!values.some((e) => e.id === s.selected)) s.selected = values[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: values.map((e) => ({
            uid: e.id,
            "rowTitle.text": e.name,
            "rowDescription.text": e.description,
            "rowIcon.image.src": e.icon,
          })),
        },
        select: s.selected,
        placeholder: s.status,
      },
      details: {
        data: {
          src: detailRows(
            values.find((e) => e.id === s.selected)?.details.length
              ? values.find((e) => e.id === s.selected)!.details
              : [
                  ["Command", values.find((e) => e.id === s.selected)?.name || "Mole"],
                  ["Behavior", values.find((e) => e.id === s.selected)?.description || s.status],
                ],
          ),
        },
      },
      statusLabel: { text: s.status, tooltip: s.path },
      primary: { text: s.mode === "clean" || s.mode === "optimize" ? "Review…" : "Open  ↩" },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/moleui", args: ["load", s.id, s.request], interval: 0, now: true },
});
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("moleui_out", process.env.moleui_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.moleui_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.moleui_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ moleui_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") {
    const prior = s.history.pop();
    if (!prior) return finish({ moleui_out: "back", swiss_return: s.returnTo });
    Object.assign(s, prior);
    s.request = randomUUID();
    save(s);
    return merge(update({ query: { text: s.query } }, true), render(s));
  }
  if (cmd === "load") {
    if (value !== s.request) return {};
    if (s.mode === "menu") return render(s);
    try {
      const output = await run(s.mode, s.path),
        latest = read(id);
      if (latest.request !== value) return {};
      latest.items =
        s.mode === "status"
          ? parseStatus(output)
          : s.mode === "analyze"
            ? parseAnalysis(output)
            : cleanOutput(output).map((line, i) => ({
                id: String(i),
                name: line,
                description: "Preview only",
                icon: "checkmark",
                details: [["Preview", line]],
              }));
      latest.status = `${latest.items.length} rows · ${new Date().toLocaleTimeString()}${s.mode === "clean" || s.mode === "optimize" ? " · Dry run" : ""}`;
      save(latest);
      return render(latest);
    } catch (error) {
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.status = error instanceof Error ? error.message : String(error);
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
    if (s.selected === value) return {};
    s.selected = value;
    save(s);
    return update(
      { details: { data: { src: detailRows(data(s).find((e) => e.id === value)?.details || []) } } },
      true,
    );
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    save(s);
    return merge(render(s), pulse(s));
  }
  if (cmd === "open") {
    if (s.mode === "status")
      return copy(
        data(s)
          .find((e) => e.id === (value || s.selected))
          ?.details.map(([k, v]) => `${k}: ${v}`)
          .join("\n") || "",
      );
    if (s.mode === "clean" || s.mode === "optimize")
      return sheet("review", {
        type: "view",
        layout: "border",
        padding: 18,
        spacing: 14,
        components: [
          {
            type: "label",
            text: `Run Mole ${s.mode}?`,
            font: { size: 18, weight: "semibold" },
            constraints: { region: "top" },
          },
          {
            type: "label",
            text: "The preview is read-only. Continuing launches the real command in Terminal, where Mole handles its prompts. Cleanup can permanently remove caches and files; optimization changes system services. Review the preview first.",
            linebreak: "wordwrap",
            constraints: { region: "centre", size: { width: 550, height: 100 } },
          },
          {
            type: "button",
            text: `Run ${s.mode} in Terminal`,
            constraints: { region: "bottom" },
            events: [
              {
                triggers: "actioned",
                action: { type: "script", src: "../bin/moleui", args: ["execute", id, s.mode, s.request] },
              },
            ],
          },
        ],
      });
    const chosen = data(s).find((e) => e.id === (value || s.selected));
    if (!chosen) return {};
    if (s.mode === "analyze" && !chosen.directory) {
      execFileSync("/usr/bin/open", [chosen.path!], { timeout: 3000 });
      return {};
    }
    s.history.push(frame(s));
    s.query = "";
    s.selected = "";
    s.items = [];
    s.request = randomUUID();
    s.status = "Loading…";
    if (s.mode === "menu") {
      s.mode = chosen.id as Mode;
      s.path = s.mode === "analyze" ? folder(str("analyze_path", "~")) : "";
    } else s.path = chosen.path!;
    save(s);
    return merge(update({ query: { text: "" } }, true), render(s), pulse(s));
  }
  if (cmd === "execute") {
    if (value !== s.mode || args[1] !== s.request || !s.items.length)
      throw new Error("Refresh and review the preview before running.");
    const command = execution(value);
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'on run argv\ntell application "Terminal"\nactivate\ndo script (item 1 of argv)\nend tell\nend run',
        command,
      ],
      { timeout: 5000 },
    );
    return { sheet: { close: "review" } };
  }
  if (cmd === "copy")
    return copy(
      s.mode === "menu"
        ? "Mole"
        : s.items.map((e) => `${e.name}\n${e.details.map(([k, v]) => `${k}: ${v}`).join("\n")}`).join("\n\n"),
    );
  if (cmd === "reveal") {
    const chosen = data(s).find((e) => e.id === value);
    if (chosen?.path) execFileSync("/usr/bin/open", ["-R", chosen.path], { timeout: 3000 });
    return {};
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.mole" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Open / Review", ["open", id, value]),
      menuItem("Copy Report", ["copy", id]),
      ...(s.mode === "analyze" ? [menuItem("Reveal in Finder", ["reveal", id, value])] : []),
      menuItem("Refresh", ["refresh", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
