import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { adoptableApps } from "./apps.ts";
import {
  cached,
  catalog,
  details,
  executable,
  jsonBrew,
  loadPackages,
  outdatedPackages,
  readBrew,
  store,
} from "./brew.ts";
import { doctorReport, vulnerabilityReport } from "./diagnostics.ts";
import { bool, cacheDir, dataDir, readJson, writeJson, cacheMinutes } from "./env.ts";
import { type Package, packageDetails, tapName } from "./model.ts";
import { commands, dryRun, packagePlan, type Plan, type Verb, terminalCommand } from "./operations.ts";
import { metadata, render } from "./presentation.ts";
import {
  createState,
  getState,
  select,
  selected,
  setState,
  type Item,
  type Mode,
  type ViewState,
} from "./state.ts";
import {
  type Action,
  copy,
  finish,
  menuItem,
  merge,
  open,
  popup,
  separator,
  sheet,
  status,
  update,
  vars,
} from "./ui.ts";
import { button, json, label, run } from "../ui/shared.ts";

const ignoredPath = () => join(dataDir(), "ignored-apps.json");
const ignored = () => readJson<string[]>(ignoredPath(), []);
const view = (
  state: ViewState,
  type = process.env.brew_type || "all",
  filter = process.env.brew_status || "all",
  query = process.env.brew_search ?? process.env.brew_query ?? "",
) => {
  const current =
    state.mode === "adopt"
      ? {
          ...state,
          items: (state.items || []).filter((i) =>
            filter === "ignored" ? ignored().includes(i.id) : !ignored().includes(i.id),
          ),
        }
      : state;
  return render(current, type, filter, query);
};
export const load = async ([rawMode = "installed", refresh = ""]: string[]): Promise<Action> => {
  const modes: Mode[] = [
    "installed",
    "search",
    "upgrades",
    "adopt",
    "services",
    "taps",
    "doctor",
    "vulns",
    "maintenance",
  ];
  if (!modes.includes(rawMode as Mode)) throw new Error("Unknown Brew view.");
  const mode = rawMode as Mode;
  let packages: Package[] = [],
    items: Item[] | undefined,
    report: string | undefined;
  if (mode === "installed" || mode === "search")
    packages = await loadPackages(mode === "search", refresh === "refresh" && mode === "search");
  if (mode === "upgrades") packages = await outdatedPackages();
  if (mode === "adopt") {
    packages = await catalog(refresh === "refresh");
    const local = await loadPackages(false);
    const installedIds = new Set(local.map((p) => p.id));
    packages = packages.filter((p) => !installedIds.has(p.id));
    items = await adoptableApps(packages);
  }
  if (mode === "services") {
    const raw = await jsonBrew(["services", "list", "--json"]);
    if (!Array.isArray(raw)) throw new Error("Unsupported Homebrew service response.");
    items = raw.map((s: any) => ({
      id: `service:${s.name}`,
      title: String(s.name),
      description: `${s.status || "unknown"}${s.user ? " · " + s.user : ""}`,
      value: s.exit_code ? `Exit ${s.exit_code}` : "",
      colour: String(s.status).startsWith("error")
        ? "systemRedColor"
        : s.status === "started"
          ? "systemGreenColor"
          : "secondaryLabelColor",
      icon: s.status === "started" ? "play.circle" : "stop.circle",
      packageId: `formula:${s.name}`,
    }));
  }
  if (mode === "taps") {
    const raw = await jsonBrew(["tap-info", "--json", "--installed"]);
    if (!Array.isArray(raw)) throw new Error("Unsupported Homebrew tap response.");
    items = raw.map((t: any) => ({
      id: `tap:${t.name}`,
      title: String(t.name),
      description: t.remote || "Homebrew tap",
      value: `${t.formula_names?.length || 0} formulae · ${t.cask_tokens?.length || 0} casks`,
      colour: t.trusted === false ? "systemOrangeColor" : "secondaryLabelColor",
      icon: "shippingbox",
      path: t.path,
    }));
  }
  if (mode === "doctor") report = doctorReport(await jsonBrew(["doctor", "--json"], true));
  if (mode === "vulns") report = vulnerabilityReport(await jsonBrew(["vulns", "--json"], true));
  if (mode === "maintenance")
    report =
      "Homebrew Maintenance\n\nUpdate Homebrew refreshes its metadata.\nClean Up removes old cached downloads and outdated versions using Homebrew’s defaults.\nClear Workflow Cache removes only this workflow’s cached catalog.\n\nUse ⌘K to choose an action. Package changes run in your Terminal after confirmation.";
  const state: Omit<ViewState, "at"> = {
    mode,
    packages,
    items,
    report,
    selected: mode === "upgrades" ? packages.filter((p) => !p.pinned && !p.disabled).map((p) => p.id) : [],
  };
  const id = createState(state);
  const query = process.env.brew_window ? process.env.brew_search || "" : process.env.brew_query || "";
  const output = report
    ? merge(
        update({ reportText: { text: report } }),
        status(
          `${mode === "doctor" ? "Doctor complete" : mode === "vulns" ? "Scan complete" : "Maintenance"} · ⌘K actions`,
        ),
      )
    : view(
        { ...state, at: Date.now() },
        process.env.brew_type || "all",
        process.env.brew_status || "all",
        query,
      );
  return merge(vars({ brew_window: id, brew_search: query }), output);
};
export const filter = async ([type = "all", health = "all", query = ""]: string[]): Promise<Action> => {
  if (!process.env.brew_window) return {};
  return merge(
    vars({ brew_type: type, brew_status: health, brew_search: query }),
    view(getState(), type, health, query),
  );
};
const findPackage = (uid: string, state = getState()): Package => {
  const item = state.items?.find((i) => i.id === uid);
  const found = state.packages.find((p) => p.id === (item?.packageId || uid));
  if (!found) throw new Error("Select a package, or refresh with ⌘R.");
  return found;
};
const reportSheet = (title: string, text: string): Action =>
  sheet("detailsSheet", {
    type: "view",
    layout: "border",
    padding: 16,
    spacing: 12,
    components: [
      label("sheetTitle", {
        text: title,
        font: { size: 19, weight: "semibold" },
        constraints: { region: "top" },
      }),
      {
        type: "textarea",
        text,
        background: null,
        colour: "labelColor",
        editable: false,
        selectable: true,
        font: { size: 13 },
        constraints: { region: "centre", size: { width: 760, height: 400 } },
      },
      button("closeSheet", "Close  ⎋", json({ sheet: { close: "detailsSheet" } }), {
        shortcut: "⎋",
        constraints: { region: "bottom", position: "right" },
      }),
    ],
  });
const detailKey = (id: string) => `detail-${Buffer.from(id).toString("base64url")}`;
export const selectedPackage = async ([uid = ""]: string[]): Promise<Action> => {
  if (!uid || !process.env.brew_window) return {};
  select(uid);
  const state = getState();
  if (state.mode !== "search") return {};
  try {
    const p = findPackage(uid, state);
    return metadata(cached<Package>(detailKey(uid), cacheMinutes("detail_cache_minutes", 15) * 60000) || p);
  } catch {
    return {};
  }
};
export const hydrate = async ([uid = ""]: string[]): Promise<Action> => {
  if (!uid || !process.env.brew_window) return {};
  const state = getState();
  if (state.mode !== "search") return {};
  await new Promise((r) => setTimeout(r, 200));
  if (selected() !== uid) return {};
  try {
    const old = cached<Package>(detailKey(uid), cacheMinutes("detail_cache_minutes", 15) * 60000);
    const p = old || (await details(findPackage(uid, state)));
    if (!old) store(detailKey(uid), p);
    return selected() === uid ? metadata(p) : {};
  } catch {
    return {};
  }
};
const confirm = (plan: Plan, labelText: string): Action => {
  commands(plan);
  const command = terminalCommand(executable(), plan);
  return merge(
    vars({ brew_plan: JSON.stringify(plan) }),
    sheet("confirmSheet", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      spacing: 14,
      padding: 20,
      components: [
        label("confirmTitle", { text: labelText, font: { size: 19, weight: "semibold" } }),
        label("confirmMessage", {
          text: "Review the command below. It will run visibly in Terminal; refresh this view when it finishes.",
          linebreak: "wordwrap",
          constraints: { size: { width: 660 } },
        }),
        {
          type: "textarea",
          text: command,
          background: null,
          editable: false,
          selectable: true,
          font: { size: 12, monospaced: true },
          constraints: { size: { width: 660, height: 110 } },
        },
        {
          type: "view",
          layout: "inline",
          spacing: 16,
          components: [
            button("cancelPlan", "Cancel", json({ sheet: { close: "confirmSheet" } })),
            button(
              "runPlan",
              "Run in Terminal",
              [json({ sheet: { close: "confirmSheet" } }), run(["execute"])],
              { bordered: true },
            ),
          ],
        },
      ],
    }),
  );
};
export const execute = async (): Promise<Action> => {
  const plan = JSON.parse(process.env.brew_plan || "null") as Plan;
  commands(plan);
  return finish({ brew_out: "execute", brew_execution: JSON.stringify(plan) });
};
export const planAction = async ([verb = "", uid = ""]: string[]): Promise<Action> => {
  const state = getState();
  let plan: Plan;
  if (verb === "cleanup" || verb === "update") plan = { verb, targets: [] };
  else if (verb === "tap" || verb === "untap")
    plan = { verb, targets: [], tap: tapName(uid.replace(/^tap:/, "")) };
  else if (verb.startsWith("service-"))
    plan = { verb: verb as Verb, targets: [{ kind: "formula", token: uid.replace(/^service:/, "") }] };
  else {
    const packages =
      uid === "selected"
        ? state.packages.filter((p) => state.selected.includes(p.id))
        : [findPackage(uid, state)];
    plan = packagePlan(verb as Verb, packages, bool("greedy_upgrades"));
  }
  return confirm(
    plan,
    `${verb.replace(/-/g, " ")} ${plan.targets.length ? plan.targets.map((t) => t.token).join(", ") : plan.tap || "Homebrew"}`,
  );
};
export const preview = async ([uid = ""]: string[]): Promise<Action> => {
  const state = getState();
  const packages =
    uid === "selected"
      ? state.packages.filter((p) => state.selected.includes(p.id))
      : [findPackage(uid, state)];
  const verb =
    state.mode === "adopt"
      ? "adopt"
      : state.mode === "upgrades" || packages[0]?.outdated
        ? "upgrade"
        : "install";
  const plan = packagePlan(verb, packages, bool("greedy_upgrades"));
  const output: string[] = [];
  for (const args of dryRun(plan)) {
    const result = await readBrew(args);
    if (result.code !== 0) throw new Error(result.stderr || result.stdout || "Preview failed.");
    output.push(result.stdout, result.stderr);
  }
  return reportSheet(
    "Homebrew Preview",
    output.filter(Boolean).join("\n") || "No changes reported by Homebrew.",
  );
};
export const action = async ([verb = "menu", uid = ""]: string[]): Promise<Action> => {
  const state = getState();
  if (verb === "primary" && state.mode === "upgrades") return planAction(["upgrade", "selected"]);
  if (verb === "primary" && state.mode === "adopt") return preview([uid]);
  if (verb === "preview") return preview([state.mode === "upgrades" ? uid || "selected" : uid]);
  if (verb === "toggle" || verb === "select-all" || verb === "deselect-all") {
    if (state.mode !== "upgrades") return {};
    if (verb === "toggle") {
      const p = findPackage(uid, state);
      if (p.pinned || p.disabled)
        throw new Error("Unpin or replace this package before selecting it for upgrade.");
      state.selected = state.selected.includes(uid)
        ? state.selected.filter((id) => id !== uid)
        : [...state.selected, uid];
    }
    if (verb === "select-all")
      state.selected = state.packages.filter((p) => !p.pinned && !p.disabled).map((p) => p.id);
    if (verb === "deselect-all") state.selected = [];
    setState(state);
    return view(state);
  }
  if (verb === "ignore" || verb === "unignore") {
    const values = ignored();
    writeJson(
      ignoredPath(),
      verb === "ignore" ? [...new Set([...values, uid])] : values.filter((id) => id !== uid),
    );
    return view(state);
  }
  if (state.mode === "taps" && verb === "menu" && !uid)
    return popup("actionsButton", [menuItem("Add Tap…", ["add-tap"])]);
  if (state.mode === "services" || state.mode === "taps") {
    const item = state.items?.find((i) => i.id === uid);
    if (!item) throw new Error("Select an entry first.");
    if (verb === "primary") return reportSheet(item.title, [item.description, item.value].join("\n\n"));
    if (verb === "menu")
      return popup(
        "actionsButton",
        state.mode === "services"
          ? [
              ...["start", "stop", "restart"].map((command) =>
                menuItem(`${command} ${item.title}`, ["plan", `service-${command}`, uid]),
              ),
              menuItem("Show Details", ["action", "primary", uid]),
            ]
          : [
              menuItem("Show Details", ["action", "primary", uid]),
              menuItem("Open on GitHub", ["action", "tap-homepage", uid]),
              menuItem("Remove Tap", ["plan", "untap", uid]),
              menuItem("Add Tap…", ["add-tap"]),
            ],
      );
    if (verb === "tap-homepage") return open(`https://github.com/${tapName(item.title)}`);
    return {};
  }
  const p = findPackage(uid, state);
  if (verb === "primary" || verb === "details")
    return reportSheet(
      p.name,
      packageDetails(p)
        .map(([k, v]) => `${k}\n${v}`)
        .join("\n\n"),
    );
  if (verb === "homepage") {
    if (!/^https?:\/\//.test(p.homepage)) throw new Error("No valid homepage is available.");
    return open(p.homepage);
  }
  if (verb === "copy-url") return copy(p.homepage);
  if (verb === "copy-command")
    return copy(
      terminalCommand(executable(), packagePlan(state.mode === "adopt" ? "adopt" : "install", [p])),
    );
  if (verb === "finder") return finish({ brew_out: "finder", brew_package: p.id });
  if (verb === "pin") return planAction([p.pinned ? "unpin" : "pin", uid]);
  if (verb === "upgrade" || verb === "install" || verb === "uninstall" || verb === "adopt")
    return planAction([verb, uid]);
  if (verb === "menu")
    return popup("actionsButton", [
      ...(state.mode === "adopt"
        ? [
            menuItem("Preview Adoption", ["preview", uid]),
            menuItem("Adopt App", ["plan", "adopt", uid]),
            menuItem(ignored().includes(uid) ? "Stop Ignoring This App" : "Ignore This App", [
              "action",
              ignored().includes(uid) ? "unignore" : "ignore",
              uid,
            ]),
          ]
        : p.installed.length
          ? [
              ...(p.outdated
                ? [
                    menuItem("Upgrade", ["plan", "upgrade", uid], "⇧⌘U"),
                    menuItem("Preview Upgrade", ["preview", uid], "⌥⌘I"),
                  ]
                : []),
              menuItem(p.pinned ? "Unpin Package" : "Pin Package", ["action", "pin", uid], "⌘."),
              menuItem("Uninstall", ["plan", "uninstall", uid]),
            ]
          : [menuItem("Install", ["plan", "install", uid]), menuItem("Preview Install", ["preview", uid])]),
      separator,
      menuItem("Show Details", ["action", "details", uid], "↩"),
      menuItem("Open Homepage", ["action", "homepage", uid]),
      menuItem("Show in Finder", ["action", "finder", uid]),
      menuItem("Copy Homepage URL", ["action", "copy-url", uid]),
      ...(state.mode === "upgrades"
        ? [
            separator,
            menuItem(state.selected.includes(uid) ? "Deselect" : "Select", ["action", "toggle", uid], "⇧⌘X"),
            menuItem("Select All", ["action", "select-all"]),
            menuItem("Deselect All", ["action", "deselect-all"]),
            menuItem("Preview Selected Upgrades", ["preview", "selected"]),
            menuItem("Upgrade Selected", ["plan", "upgrade", "selected"]),
          ]
        : []),
    ]);
  return {};
};
export const addTap = async (): Promise<Action> =>
  sheet("tapSheet", {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 20,
    spacing: 14,
    components: [
      label("tapTitle", { text: "Add Homebrew Tap", font: { size: 19, weight: "semibold" } }),
      {
        id: "tapField",
        type: "textfield",
        placeholder: "owner/repository",
        text: process.env.brew_query || "",
        focus: true,
        constraints: { size: { width: 500 } },
      },
      button(
        "reviewTap",
        "Review",
        [
          json({ sheet: { close: "tapSheet" } }, { brew_tap: "{value:tapField.text}" }),
          run(["plan", "tap", "{var:brew_tap}"]),
        ],
        { bordered: true },
      ),
    ],
  });
export const reportCopy = async (): Promise<Action> => copy(getState().report || "");
export const reportMenu = async (): Promise<Action> =>
  popup("actionsButton", [
    menuItem("Copy Report", ["report-copy"]),
    separator,
    menuItem("Update Homebrew", ["plan", "update"]),
    menuItem("Clean Up", ["plan", "cleanup"]),
    menuItem("Clear Workflow Cache", ["clear-cache"]),
  ]);
export const clearCache = async (): Promise<Action> => {
  for (const name of ["catalog", "installed"]) {
    try {
      unlinkSync(join(cacheDir(), `${name}.json`));
    } catch {
      /* Cache absent. */
    }
  }
  return status("Workflow catalog cache cleared. Refresh to reload.");
};

export const maintenanceAction = async (): Promise<Action> => {
  const requested = process.env.brew_query;
  if (requested === "clear-cache") return clearCache();
  if (requested === "update" || requested === "cleanup") return planAction([requested]);
  return reportMenu();
};
