import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { scan, clean, bytes } from "./caches.ts";
import { detailRows } from "../../../shared/dashboard.ts";
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
const details = (s: State): Action => {
  const e = s.rows.find((x) => x.id === s.selected);
  return update(
    {
      details: {
        data: {
          src: detailRows(
            e
              ? [
                  ["Cache", e.name],
                  ["Size", e.error || bytes(e.bytes)],
                  ["Category", e.category],
                  ["Risk", e.risk],
                  ["Path", e.path],
                  ["Behavior", e.note],
                  ["Cleanup", `Permanently remove ${e.path}`],
                ]
              : [],
          ),
        },
      },
    },
    true,
  );
};
const render = (s: State): Action => {
  const rows = s.rows.filter(
    (e) =>
      (s.filter === "All" ||
        s.filter === e.risk ||
        s.filter === e.category ||
        (s.filter === "Large > 1 GB" && e.bytes > 1e9)) &&
      `${e.name} ${e.path}`.toLowerCase().includes(s.query.toLowerCase()),
  );
  if (!rows.some((x) => x.id === s.selected)) s.selected = rows[0]?.id || "";
  save(s);
  return merge(
    update(
      {
        items: {
          data: {
            src: rows.map((e) => ({
              uid: e.id,
              "rowIcon.image.type": "symbol",
              "rowIcon.image.src": e.risk === "Safe" ? "checkmark.circle" : "exclamationmark.circle",
              "rowTitle.text": `${e.name} · ${bytes(e.bytes)}`,
              "rowDescription.text": `${e.risk} · ${e.category}`,
            })),
          },
          select: s.selected,
          placeholder: "No caches in this filter.",
        },
        statusLabel: {
          text: `${bytes(s.rows.reduce((n, e) => n + e.bytes, 0))} total · ${bytes(s.rows.filter((e) => e.risk === "Safe").reduce((n, e) => n + e.bytes, 0))} safe${s.limited ? " · Scan limit reached" : ""}`,
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
    ? s.rows.filter((e) => e.risk === "Safe" && e.bytes > 0 && !e.error)
    : s.rows.filter((e) => e.id === s.selected);
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
      constraints: { size: { width: 650, height: 310 } },
      components: [
        {
          type: "label",
          text: `Permanently clean ${targets.length} cache folder(s)?`,
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
              "reviewNote.text": `${e.risk}: ${e.note}`,
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
        {
          type: "button",
          text: `Permanently Clean ${bytes(targets.reduce((n, e) => n + e.bytes, 0))}`,
          constraints: { region: "bottom", position: "right" },
          events: [{ triggers: "actioned", action: script(["confirm", s.id], true) }],
        },
      ],
    },
    false,
    script(["cancel-review", s.id], false),
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
    return details(s);
  }
  if (cmd === "back") return finish({ devcache_out: "back", dev_return: s.returnTo });
  if (cmd === "open" || cmd === "safe") return review(s, cmd === "safe");
  if (cmd === "cancel-review") {
    s.plan = [];
    save(s);
    return { sheet: { close: "cleanupReview" } };
  }
  if (cmd === "confirm") {
    const targets = s.plan;
    s.plan = [];
    save(s);
    await clean(targets);
    return merge({ sheet: { close: "cleanupReview" } }, await load(s));
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
  if (cmd === "menu")
    return popup("actionsButton", [
      ...(e
        ? [
            menuItem("Review Selected Cleanup…", ["open", id, e.id]),
            menuItem("Open Folder", ["folder", id, e.id]),
            menuItem("Copy Path", ["copy", id, e.id]),
            menuItem("Copy Cleanup Description", ["description", id, e.id]),
          ]
        : []),
      menuItem("Review Safe Caches…", ["safe", id]),
      menuItem("Scan Again", ["refresh", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  if (!e) throw new Error("Select a cache.");
  if (cmd === "folder") return { open: { type: "file", src: e.path } };
  if (cmd === "copy") return copy(e.path);
  if (cmd === "description") return copy(`${e.risk}: ${e.note}\nPermanently remove ${e.path}`);
  return {};
};
main()
  .then((a) => process.stdout.write(JSON.stringify(a || {})))
  .catch((e) => process.stdout.write(JSON.stringify(errorStatus(e))));
