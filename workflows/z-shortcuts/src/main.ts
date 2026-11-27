import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, storeList, type Input, type State } from "./state.ts";
import { components, run } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  ignoredFolders,
  inFolder,
  inputSupport,
  listShortcuts,
  matches,
  NO_FOLDER,
  type Shortcut,
} from "./shortcuts.ts";
import { merge, vars, update, finish, popup, menuItem, copy, errorStatus, sheet, type Action } from "./ui.ts";

const hidden = () => ignoredFolders(str("ignored_folders"));
const visible = (s: State): Shortcut[] => {
  const skip = hidden();
  // With input from a Universal or File Action, only shortcuts that accept it are offered.
  const needsInput = Boolean(s.input.text || s.input.paths?.length);
  return s.items.filter(
    (x) =>
      !skip.has(x.folder || NO_FOLDER) &&
      inFolder(x, s.folder) &&
      matches(x, s.query) &&
      !(needsInput && x.acceptsInput === false),
  );
};
const folders = (s: State): string[] =>
  [...new Set(s.items.map((x) => x.folder).filter((f) => f && !hidden().has(f)))].toSorted();
const inputLabel = (input: Input): string =>
  input.paths?.length
    ? `Input: ${input.paths.length === 1 ? input.paths[0]!.split("/").at(-1) : `${input.paths.length} files`}`
    : input.text
      ? `Input: “${input.text.length > 40 ? `${input.text.slice(0, 40)}…` : input.text}”`
      : "";

const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((x) => x.id === s.selected)) s.selected = rows[0]?.id || "";
  save(s);
  const label = inputLabel(s.input);
  return update(
    {
      items: {
        data: {
          src: rows.map((x) => ({
            uid: x.id,
            "rowTitle.text": x.name,
            "rowDescription.text": [
              x.folder || NO_FOLDER,
              x.acceptsInput === true ? "Accepts input" : x.acceptsInput === false ? "" : "",
            ]
              .filter(Boolean)
              .join(" · "),
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": "square.stack.3d.up.fill",
            "rowIcon.contenttintcolour": "systemPinkColor",
          })),
        },
        select: s.selected,
        placeholder: s.items.length ? "No matching shortcuts" : s.status,
      },
      folder: {
        items: [
          { text: "All Shortcuts", value: "all" },
          ...folders(s).map((name) => ({ text: name, value: name })),
          { text: NO_FOLDER, value: "none" },
        ],
        selected: s.folder,
      },
      statusLabel: { text: label ? `${label} · ${s.status}` : s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/shortcuts", args: ["load", s.id, s.request], interval: 0, now: true },
});
const target = (s: State, id: string): Shortcut => {
  const x = s.items.find((item) => item.id === (id || s.selected));
  if (!x) throw new Error("Select a shortcut.");
  return x;
};
/** Closes the window; Alfred's Run Shortcut / Edit Shortcut objects take it from there. */
const handOff = (s: State, out: "run" | "files" | "view", x: Shortcut, input: Input): Action => {
  const files = input.paths?.length ? input.paths : undefined;
  return finish(
    {
      shortcuts_out: files && out === "run" ? "files" : out,
      shortcut: x.name,
      inputmode: files ? "1" : input.text ? "0" : "-1",
      swiss_return: s.returnTo,
    },
    files ? files.join("\t") : input.text || "",
  );
};

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("shortcuts_out", process.env.shortcuts_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.shortcuts_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.shortcuts_query || ""),
      paths = (process.env.shortcuts_paths || "").split("\t").filter(Boolean),
      text = process.env.shortcuts_input || "",
      s = create(origin.query, origin.returnTo, paths.length ? { paths } : text ? { text } : {});
    return merge(
      vars({ shortcuts_session: s.id }),
      update({ root: { components: components(s.query, s.folder, folders(s)) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ shortcuts_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const [items, support] = await Promise.all([
        listShortcuts(),
        bool("detect_input", true) ? inputSupport() : Promise.resolve(undefined),
      ]);
      for (const x of items) x.acceptsInput = support?.get(x.id);
      storeList(items);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.items = items;
      latest.status = `${items.length} shortcuts`;
      return render(latest);
    } catch (error) {
      const latest = read(id);
      latest.status = error instanceof Error ? error.message : String(error);
      return render(latest);
    }
  }
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    if (s.items.some((x) => x.id === value)) {
      s.selected = value;
      save(s);
    }
    return {};
  }
  if (cmd === "folder") {
    s.folder = value === "all" || value === "none" || folders(s).includes(value) ? value : "all";
    return render(s);
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    return merge(render(s), pulse(s));
  }
  if (cmd === "open") return handOff(s, "run", target(s, value), s.input);
  if (cmd === "edit") return handOff(s, "view", target(s, value), {});
  if (cmd === "ask-input") {
    const x = target(s, value);
    if (x.acceptsInput === false) throw new Error(`“${x.name}” doesn’t accept input.`);
    // The typed text travels as a script environment variable (shortcuts_text), never in argv.
    const submit = {
      ...run("run-input", [x.id], false),
      variables: { shortcuts_text: "{value:inputField.text}" },
    };
    return sheet("inputSheet", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 10,
      components: [
        { type: "label", text: `Run “${x.name}” with`, font: { size: 15, weight: "semibold" } },
        {
          id: "inputField",
          type: "textfield",
          placeholder: "Text or URL",
          focus: true,
          constraints: { size: { width: 420 } },
          events: [{ triggers: "actioned", action: submit }],
        },
        {
          id: "runInput",
          type: "button",
          text: "Run  ↩",
          constraints: { region: "bottom" },
          events: [{ triggers: "actioned", action: submit }],
        },
      ],
    });
  }
  if (cmd === "run-input")
    return handOff(s, "run", target(s, value), { text: process.env.shortcuts_text || "" });
  if (cmd === "copy") return copy(target(s, value).name);
  if (cmd === "app") {
    execFileSync("/usr/bin/open", ["-b", "com.apple.shortcuts"], { timeout: 3000 });
    return {};
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.shortcuts" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const x = s.items.find((item) => item.id === (value || s.selected));
    return popup("actionsButton", [
      ...(x
        ? [
            menuItem(
              s.input.text || s.input.paths?.length ? "Run with Input" : "Run Shortcut",
              ["open", id, x.id],
              "↩",
            ),
            ...(x.acceptsInput === false ? [] : [menuItem("Run with Text…", ["ask-input", id, x.id], "⌘↩")]),
            menuItem("Edit in Shortcuts", ["edit", id, x.id], "⌥↩"),
            menuItem("Copy Shortcut Name", ["copy", id, x.id]),
          ]
        : []),
      menuItem("Open Shortcuts", ["app", id]),
      menuItem("Refresh", ["refresh", id], "⌘R"),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  }
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
