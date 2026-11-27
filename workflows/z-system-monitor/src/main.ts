import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { referenceData, skipHeading } from "../../../shared/reference-rows.ts";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { snapshot } from "./metrics.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, errorStatus, type Action } from "./ui.ts";
const categories = [
  { id: "system", name: "System Info", icon: "desktopcomputer" },
  { id: "cpu", name: "CPU", icon: "cpu" },
  { id: "memory", name: "Memory", icon: "memorychip" },
  { id: "disks", name: "Disks", icon: "externaldrive" },
  { id: "power", name: "Power", icon: "bolt" },
  { id: "network", name: "Network", icon: "network" },
];
const filtered = (s: State) =>
  categories.filter((c) => c.name.toLowerCase().includes(s.query.toLowerCase().trim()));
const tone = (text: string, power = false): string => {
  const n = Number.parseFloat(text);
  return !Number.isFinite(n)
    ? "neutral"
    : power
      ? n < 20
        ? "red"
        : "green"
      : n >= 90
        ? "red"
        : n >= 60
          ? "yellow"
          : "green";
};
const sidebar = (s: State) =>
  referenceData(
    filtered(s).map((c) => ({
      ...c,
      group: c.id === "system" ? "Overview" : c.name,
      badge:
        c.id === "disks"
          ? s.sample?.sections.disks?.find(([key]) => key === "/")?.[1].match(/([\d.]+)%/)?.[0] ||
            s.sample?.badges.disks ||
            "…"
          : c.id === "system"
            ? ""
            : s.sample?.badges[c.id] || "…",
      tone: tone(s.sample?.badges[c.id] || "", c.id === "power"),
    })),
    "monitor",
  );
const detailData = (s: State) =>
  referenceData(
    (s.sample?.sections[s.selected] || []).map(([name, value], i) => ({
      id: String(i),
      name,
      badge: value,
      group: name.startsWith("#") ? "Top Processes" : name.startsWith("Core ") ? "Per-Core" : undefined,
      tone: /%/.test(value) ? tone(value, s.selected === "power") : "neutral",
    })),
    "metric",
  ).map((row) => {
    for (const key of ["metricIcon.image.type", "metricIcon.image.src", "metricIcon.contenttintcolour"])
      delete row[key];
    if (!row.header && !/%/.test(row["metricBadgeLabel.text"])) row["metricBadge.background"] = null;
    return row;
  });
const render = (s: State): Action => {
  const visible = filtered(s);
  if (!visible.some((c) => c.id === s.selected)) s.selected = visible[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: sidebar(s),
        },
        select: s.selected,
        placeholder: "No matching section",
      },
      details: { data: { src: detailData(s) } },
      statusLabel: {
        text: s.sample
          ? `${s.paused ? "Paused · " : ""}Updated ${new Date(s.sample.at).toLocaleTimeString()}`
          : "Sampling…",
      },
    },
    true,
  );
};
const interval = () => Math.max(2, Math.min(60, Number(str("refresh_seconds", "5")) || 5));
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("sysmon_out", process.env.sysmon_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.sysmon_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.sysmon_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ sysmon_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      { pulse: { src: "../bin/sysmon", args: ["tick", s.id], interval: interval(), now: true } },
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ sysmon_out: "back", swiss_return: s.returnTo });
  if (cmd === "tick" || cmd === "refresh") {
    if (s.paused && cmd === "tick") return {};
    const sample = await snapshot(s.sample),
      latest = read(id);
    latest.sample = sample;
    save(latest);
    return render(latest);
  }
  if (cmd === "query") {
    s.query = args[0] || "";
    save(s);
    return render(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    if (args[0]?.startsWith("heading:")) return skipHeading(sidebar(s), args[0], s.selected);
    if (!categories.some((c) => c.id === args[0]) || s.selected === args[0]) return {};
    s.selected = args[0]!;
    save(s);
    return update({ details: { data: { src: detailData(s) } } }, true);
  }
  if (cmd === "pause") {
    s.paused = !s.paused;
    save(s);
    return render(s);
  }
  if (cmd === "open") {
    execFileSync("/usr/bin/open", ["-b", "com.apple.ActivityMonitor"], { timeout: 3000 });
    return {};
  }
  if (cmd === "copy")
    return copy((s.sample?.sections[s.selected] || []).map(([key, value]) => `${key}: ${value}`).join("\n"));
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.system-monitor" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Open Activity Monitor", ["open", id]),
      menuItem("Copy Section", ["copy", id]),
      menuItem(s.paused ? "Resume Live Updates" : "Pause Live Updates", ["pause", id]),
      menuItem("Refresh", ["refresh", id], "⌘R"),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
