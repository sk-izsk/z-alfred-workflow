import { openTerminal } from "../../../shared/terminal.ts";
import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { statusItems, previewItems, size, usageTone } from "./presentation.ts";
import { referenceData, skipHeading, toneBackground, toneColour } from "../../../shared/reference-rows.ts";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, frame, type State } from "./state.ts";
import { run, parseAnalysis, folder, execution, type Mode, type Item } from "./mole.ts";
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
const rowData = (s: State) =>
  referenceData(
    data(s).map((e) =>
      s.mode === "analyze"
        ? {
            ...e,
            badge: e.details.find(([key]) => key === "Bytes")
              ? size(e.details.find(([key]) => key === "Bytes")![1])
              : e.description,
            description: "",
            tone:
              Number(e.details.find(([key]) => key === "Bytes")?.[1]) > 50e9
                ? "red"
                : Number(e.details.find(([key]) => key === "Bytes")?.[1]) > 10e9
                  ? "orange"
                  : Number(e.details.find(([key]) => key === "Bytes")?.[1]) > 5e9
                    ? "yellow"
                    : "neutral",
          }
        : e.id === "summary"
          ? { ...e, note: e.description, description: "" }
          : e,
    ),
    "mole",
    s.mode !== "analyze" && s.mode !== "menu",
  );
const detailData = (s: State) =>
  (data(s).find((e) => e.id === s.selected)?.details || []).map(([name, value], i) => {
    const number = value.match(/^(\d+(?:\.\d+)?)%/);
    const badge = ["Health", "CPU", "Usage", "Memory", "Battery"].includes(name) || name.startsWith("Disk (");
    const tone = name === "Health" ? "green" : number ? usageTone(Number(number[1])) : "neutral";
    return {
      uid: String(i),
      "metricName.text": name,
      "metricValue.text": value,
      "metricValue.tooltip": value,
      "metricValue.colour": badge ? toneColour(tone) : "labelColor",
      "metricBadge.background": badge && value !== "Not present" ? toneBackground(tone) : null,
    };
  });
const render = (s: State): Action => {
  const values = data(s);
  if (!values.some((e) => e.id === s.selected)) s.selected = values[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: { src: rowData(s) },
        select: s.selected,
        placeholder: s.items.length ? "No matching items" : s.status,
      },
      ...(s.mode === "status" ? { details: { data: { src: detailData(s) } } } : {}),
      statusLabel: {
        text:
          s.mode === "menu"
            ? "Mole"
            : s.mode === "status"
              ? "System Status"
              : s.mode === "analyze"
                ? s.path
                : s.mode === "clean"
                  ? "Clean System · Dry run"
                  : "Optimize System · Dry run",
        tooltip: s.status,
      },
      query: {
        enabled: !(s.mode !== "menu" && !s.ready && (s.status === "Loading…" || s.status === "Refreshing…")),
      },
      scanActivity: { opacity: 0 },
      primary: {
        enabled: s.mode === "menu" || !!s.ready,
        contenttintcolour: s.mode === "clean" ? "systemRedColor" : null,
        text:
          s.mode === "status"
            ? "Refresh  ↩"
            : s.mode === "analyze"
              ? "Browse  ↩"
              : s.mode === "clean"
                ? "Clean All  ↩"
                : s.mode === "optimize"
                  ? "Optimize All  ↩"
                  : "Open  ↩",
      },
    },
    true,
  );
};
const mount = (s: State, load = false): Action =>
  merge(update({ root: { components: components(s) } }, true), {
    pulse: {
      src: "../bin/moleui",
      args: load ? ["load", s.id, s.request] : ["populate", s.id],
      interval: 1,
      intervalmode: "delay",
      now: true,
    },
  });
const pulse = (s: State): Action => ({
  pulse: {
    src: "../bin/moleui",
    args: ["load", s.id, s.request],
    interval: 1,
    intervalmode: "delay",
    now: true,
  },
});
const main = async (): Promise<Action | void> => {
  let [cmd = "", id = "", ...args] = process.argv.slice(2),
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
    return merge(vars({ moleui_session: s.id }), mount(s, true));
  }
  const s = read(id);
  if (cmd === "populate") return merge(render(s), { pulse: { interval: 0 } });
  if (cmd === "poll") {
    if (s.status === "Loading…" || s.status === "Refreshing…") {
      if (!s.loadingSince || Date.now() - s.loadingSince < 100000) {
        const seconds = Math.max(0, Math.floor((Date.now() - (s.loadingSince || Date.now())) / 1000));
        return update(
          {
            items: { placeholder: s.progress || "Scanning system… No changes are being made." },
            scanActivity: { opacity: 1, progress: (Date.now() % 3000) / 3000 },
            statusLabel: {
              text: `Scanning${".".repeat(1 + (seconds % 3))} ${seconds}s · ${s.mode === "clean" || s.mode === "optimize" ? "Dry run" : "Read-only"}`,
              tooltip: s.progress || "Read-only preview in progress",
            },
            query: { enabled: false },
            primary: { enabled: false },
          },
          true,
        );
      }
      s.status = "Mole preview timed out. Use Refresh to try again.";
      s.items = [];
      s.ready = false;
      s.request = randomUUID();
    }
    return merge(render(s), { pulse: { interval: 0 } });
  }
  if (cmd === "back") {
    const prior = s.history.pop();
    if (!prior) return finish({ moleui_out: "back", swiss_return: s.returnTo });
    Object.assign(s, prior);
    s.request = randomUUID();
    save(s);
    return mount(s);
  }
  if (cmd === "load") {
    if (value !== s.request) return { pulse: { interval: 0 } };
    if (s.mode === "menu") return merge(render(s), { pulse: { interval: 0 } });
    s.loadingSince = Date.now();
    s.progress = "";
    const action = render(s);
    // Long CLI previews must not hold Alfred's pulse response open.
    const child = spawn(process.execPath, [process.argv[1]!, "load-worker", id, value], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return merge(action, {
      pulse: { src: "../bin/moleui", args: ["poll", id], interval: 1, intervalmode: "delay", now: false },
    });
  }
  if (cmd === "load-worker") {
    if (value !== s.request || s.mode === "menu") return {};

    try {
      let lastProgress = 0;
      const output = await run(s.mode, s.path, (line) => {
          if (Date.now() - lastProgress < 250) return;
          lastProgress = Date.now();
          const current = read(id);
          if (current.request !== value || current.ready) return;
          current.progress = line;
          save(current);
        }),
        latest = read(id);
      if (latest.request !== value) return {};
      latest.items =
        s.mode === "status"
          ? statusItems(output)
          : s.mode === "analyze"
            ? parseAnalysis(output)
            : previewItems(output, s.mode);
      latest.ready = true;
      latest.status = `${latest.items.length} rows · ${new Date().toLocaleTimeString()}${s.mode === "clean" || s.mode === "optimize" ? " · Dry run" : ""}`;
      save(latest);
      return {};
    } catch (error) {
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.ready = false;
      latest.items = [];
      latest.status = error instanceof Error ? error.message : String(error);
      save(latest);
      return {};
    }
  }
  if (
    s.mode !== "menu" &&
    !s.ready &&
    (s.status === "Loading…" || s.status === "Refreshing…") &&
    ["query", "select", "refresh", "open"].includes(cmd)
  )
    return {};
  if (cmd === "query") {
    s.query = value;
    save(s);
    return render(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    if (value.startsWith("heading:")) return skipHeading(rowData(s), value, s.selected);
    if (s.selected === value) return {};
    s.selected = value;
    save(s);
    return s.mode === "status" ? update({ details: { data: { src: detailData(s) } } }, true) : {};
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    s.ready = false;
    save(s);
    return merge(render(s), pulse(s));
  }
  if (cmd === "open") {
    if (s.mode === "status") {
      s.request = randomUUID();
      s.status = "Refreshing…";
      s.ready = false;
      save(s);
      return merge(render(s), pulse(s));
    }
    if ((s.mode === "clean" || s.mode === "optimize") && !s.ready)
      throw new Error("Wait for a successful dry-run preview before reviewing changes.");
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
            text: "The preview is read-only. Continuing launches the real command in your configured terminal, where Mole handles its prompts. Cleanup can permanently remove caches and files; optimization changes system services. Review the preview first.",
            linebreak: "wordwrap",
            constraints: { region: "centre", size: { width: 550, height: 100 } },
          },
          {
            type: "button",
            text: `Run ${s.mode} in ${str("terminal_app", "Ghostty")}`,
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
    s.scroll = 0;
    s.selected = "";
    s.items = [];
    s.request = randomUUID();
    s.status = "Loading…";
    s.ready = false;
    if (s.mode === "menu") {
      s.mode = chosen.id as Mode;
      s.path = s.mode === "analyze" ? folder(str("analyze_path", "~")) : "";
    } else s.path = chosen.path!;
    save(s);
    return mount(s, true);
  }
  if (cmd === "execute") {
    if (value !== s.mode || args[1] !== s.request || !s.items.length || !s.ready)
      throw new Error("Refresh and review the preview before running.");
    const command = execution(value);
    await openTerminal({ str }, { command });
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
