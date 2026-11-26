import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync, spawn } from "node:child_process";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { scan, bytes, cleanupCommand } from "./caches.ts";
import { busy, beginCleanup, runCleanup } from "./jobs.ts";
import { referenceData, skipHeading } from "../../../shared/reference-rows.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  merge,
  vars,
  update,
  finish,
  popup,
  menuItem,
  copy,
  errorStatus,
  sheet,
  script,
  type Action,
} from "./ui.ts";
const plain = (value: string): string => value.replace(/[\\`*_{}[\]<>]/g, "\\$&");
const details = (s: State): Action => {
  const e = s.rows.find((x) => x.id === s.selected);
  return update(
    {
      cacheDetails: {
        text: e
          ? `# ${plain(e.name)}

${plain(e.note)}

${e.context ? plain(e.context) + "\n\n" : ""}---

**Size:** ${e.error ? plain(e.error) : bytes(e.bytes)}

**Category:** ${plain(e.category)}

**Risk:** ${e.risk === "Safe" ? "Safe to clean" : "Review before cleaning"}

**Path:** ${plain(e.path)}

**Clean command:**

\`\`\`sh
${cleanupCommand(e).replace(/`/g, "\\`")}
\`\`\``
          : "Select a cache to inspect its description and cleanup command.",
      },
      primary: {
        text: e ? `Clean ${e.name}  ↩` : "Clean Selected Cache  ↩",
        enabled: !busy(s) && !!e && e.available !== false && !e.error,
      },
    },
    true,
  );
};
const visible = (s: State) =>
  s.rows.filter(
    (e) =>
      (s.filter === "All" ||
        s.filter === e.risk ||
        s.filter === e.category ||
        (s.filter === "Large > 1 GB" && e.bytes > 1e9)) &&
      `${e.name} ${e.path}`.toLowerCase().includes(s.query.toLowerCase()),
  );
const rowData = (s: State): Action[] => {
  const rows = visible(s),
    groups = new Map<string, { count: number; size: number }>();
  for (const e of rows) {
    const g = groups.get(e.category) || { count: 0, size: 0 };
    g.count++;
    g.size += e.bytes;
    groups.set(e.category, g);
  }
  return referenceData(
    rows.map((e) => ({
      id: e.id,
      name: e.name,
      group: e.category,
      badge: e.error ? "Unknown" : bytes(e.bytes),
      tone: e.risk === "Safe" ? "green" : "orange",
      icon: "circle.fill",
    })),
    "cache",
  ).map((row) => {
    delete row["cacheSubtitle.text"];
    delete row["cacheSubtitle.tooltip"];
    if (row.header) {
      const group = row["cacheHeader.text"] as string,
        g = groups.get(group)!;
      delete row["cacheHeader.text"];
      row["cacheGroupTitle.text"] = group;
      row["cacheGroupTotal.text"] = `${g.count} items — ${bytes(g.size)}`;
    } else {
      row["cacheBadge.background"] = null;
      row["cacheBadgeLabel.colour"] = "secondaryLabelColor";
    }
    return row;
  });
};
const render = (s: State, persist = true): Action => {
  if (
    !["All", "Safe", "Review", "Large > 1 GB"].includes(s.filter) &&
    !s.rows.some((row) => row.category === s.filter)
  )
    s.filter = "All";
  const rows = visible(s);
  if (!rows.some((x) => x.id === s.selected)) s.selected = rows[0]?.id || "";
  if (persist) save(s);
  const total = bytes(s.rows.reduce((n, e) => n + e.bytes, 0)),
    safe = bytes(s.rows.filter((e) => e.risk === "Safe").reduce((n, e) => n + e.bytes, 0));
  const groups = [...new Set(s.rows.map((e) => e.category))];
  return merge(
    update(
      {
        items: {
          enabled: !busy(s),
          data: { src: rowData(s) },
          select: s.selected,
          placeholder: "No caches match this filter.",
        },
        query: {
          enabled: !busy(s),
          placeholder: `Search caches… (${total} total, ${safe} safe)`,
          tooltip: `${total} total · ${safe} safe`,
        },
        filter: {
          enabled: !busy(s),
          items: [
            { text: `All (${s.rows.length})`, value: "All" },
            { text: `Safe Only (${s.rows.filter((e) => e.risk === "Safe").length})`, value: "Safe" },
            { text: `Review (${s.rows.filter((e) => e.risk === "Review").length})`, value: "Review" },
            { text: `Large > 1 GB (${s.rows.filter((e) => e.bytes > 1e9).length})`, value: "Large > 1 GB" },
            { type: "separator" },
            ...groups.map((value) => ({
              text: `${value} (${s.rows.filter((e) => e.category === value).length})`,
              value,
            })),
          ],
          selected: s.filter,
        },
        activity: {
          opacity: busy(s) ? 1 : 0,
          progress: s.job ? s.job.completed / Math.max(1, s.job.total) : 0,
        },
        statusLabel: {
          text: busy(s)
            ? s.job!.message.replace("…", ".".repeat(1 + (Math.floor(Date.now() / 500) % 3)))
            : s.job?.message || "Scan Caches",
          tooltip: `${s.job?.message ? s.job.message + "\n" : ""}${total} total · ${safe} safe${s.limited ? " · Scan limit reached" : ""}`,
          colour: s.job?.phase === "error" ? "systemRedColor" : "secondaryLabelColor",
        },
      },
      true,
    ),
    details(s),
  );
};
const load = async (s: State): Promise<Action> => {
  const result = await scan(),
    current = read(s.id);
  Object.assign(current, result);
  current.plan = [];
  return render(current);
};
const review = (s: State, safe: boolean): Action => {
  const targets = safe
    ? s.rows.filter((e) => e.risk === "Safe" && e.bytes > 0 && !e.error && e.available !== false)
    : s.rows.filter((e) => e.id === s.selected && e.available !== false && !e.error);
  if (!targets.length) throw new Error("No selected caches to clean.");
  s.plan = targets;
  save(s);
  return sheet(
    "cleanupReview",
    {
      type: "view",
      layout: "border",
      padding: 18,
      spacing: 12,
      constraints: { size: { width: 650, height: Math.min(310, Math.max(160, targets.length * 58 + 70)) } },
      components: [
        {
          type: "label",
          text: `Clean ${targets.length} cache ${targets.length === 1 ? "item" : "items"}?`,
          font: { size: 18, weight: "medium" },
          constraints: { region: "top" },
        },
        {
          type: "dataview",
          constraints: { region: "centre" },
          data: {
            type: "basic",
            src: targets.map((e) => ({
              uid: e.id,
              "reviewName.text": `${e.name} · ${bytes(e.bytes)} · ${e.path}`,
              "reviewName.tooltip": e.path,
              "reviewNote.text": `Permanent cleanup. ${e.risk}: ${e.note} ${e.kind === "simulator" ? "Only the reviewed unavailable devices will be deleted." : ""}`,
            })),
          },
          cell: {
            height: 58,
            root: {
              type: "view",
              layout: "border",
              components: [
                {
                  id: "reviewName",
                  type: "label",
                  text: "",
                  linebreak: "truncatetail",
                  font: { size: 12 },
                  constraints: { region: "top" },
                },
                {
                  id: "reviewNote",
                  type: "label",
                  text: "",
                  linebreak: "truncatetail",
                  font: { size: 11 },
                  colour: "secondaryLabelColor",
                  constraints: { region: "bottom" },
                },
              ],
            },
          },
        },
      ],
    },
    true,
    script(["cancel-review", s.id], false),
    [
      {
        type: "button",
        text: `Clean ${bytes(targets.reduce((n, e) => n + e.bytes, 0))}  ↩`,
        bordered: false,
        shortcut: "↩",
        contenttintcolour: "systemRedColor",
        events: [{ triggers: "actioned", action: script(["confirm", s.id], true) }],
      },
    ],
  );
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("devcache_out", process.env.devcache_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.devcache_out === "back") performBack(process.env.dev_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.devcache_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ devcache_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      { pulse: { src: "../bin/devcache", args: ["refresh", s.id], interval: 0, now: true } },
    );
  }
  const s = read(id);
  if (cmd === "cleanup-worker") {
    await runCleanup(id, value);
    return {};
  }
  if (cmd === "cleanup-poll") return merge(render(s, !busy(s)), busy(s) ? {} : { pulse: { interval: 0 } });
  if (busy(s) && ["refresh", "query", "filter", "select", "open", "safe", "confirm"].includes(cmd)) return {};
  if (cmd === "refresh") {
    s.job = undefined;
    save(s);
    return load(s);
  }
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "filter") {
    s.filter = value;
    return render(s);
  }
  if (cmd === "select") {
    if (value.startsWith("heading:")) return skipHeading(rowData(s), value, s.selected);
    s.selected = value;
    save(s);
    return details(s);
  }
  if (cmd === "back") return finish({ devcache_out: "back", dev_return: s.returnTo });
  if (cmd === "open" || cmd === "safe") return review(s, cmd === "safe");
  if (cmd === "cancel-review") {
    if (busy(s)) return { sheet: { close: "cleanupReview" } };
    s.plan = [];
    save(s);
    return { sheet: { close: "cleanupReview" } };
  }
  if (cmd === "confirm") {
    const jobID = beginCleanup(s);
    const action = merge({ sheet: { close: "cleanupReview" } }, render(s, false), {
      pulse: {
        src: "../bin/devcache",
        args: ["cleanup-poll", id],
        interval: 0.5,
        intervalmode: "delay",
        now: true,
      },
    });
    const child = spawn(process.execPath, [process.argv[1]!, "cleanup-worker", id, jobID], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return action;
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.dev-cache-cleaner" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  const e = s.rows.find((x) => x.id === (value || s.selected));
  if (cmd === "menu" && busy(s))
    return popup("actionsButton", [menuItem("Cleanup is running…", ["cleanup-poll", id])]);
  if (cmd === "menu")
    return popup("actionsButton", [
      ...(e
        ? [
            menuItem("Review Selected Cleanup…", ["open", id, e.id]),
            ...(e.kind !== "command" ? [menuItem("Open Folder", ["folder", id, e.id])] : []),
            menuItem("Copy Path", ["copy", id, e.id]),
            menuItem("Copy Clean Command", ["description", id, e.id]),
          ]
        : []),
      menuItem("Review Safe Caches…", ["safe", id]),
      menuItem("Scan Again", ["refresh", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  if (!e) throw new Error("Select a cache.");
  if (cmd === "folder") return { open: { type: "file", src: e.path } };
  if (cmd === "copy") return copy(e.path);
  if (cmd === "description") return copy(cleanupCommand(e));
  return {};
};
main()
  .then((a) => process.stdout.write(JSON.stringify(a || {})))
  .catch((e) => process.stdout.write(JSON.stringify(errorStatus(e))));
