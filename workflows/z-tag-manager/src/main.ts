import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { readEntry, changeTags, matches, parseImport, scan, validTag, type Entry } from "./tags.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  merge,
  vars,
  update,
  finish,
  copy,
  popup,
  menuItem,
  separator,
  sheet,
  type Action,
  errorStatus,
} from "./ui.ts";
const run = (command: string, s: State, args: string[] = [], async = false): Action => ({
  type: "script",
  src: "../bin/tags",
  args: [command, s.id, s.level, ...args],
  async,
});
const visible = (s: State): Entry[] => s.index.entries.filter((entry) => matches(entry, s.query));
const rows = (s: State): Action => {
  const values =
    s.mode === "list"
      ? visible(s).map((entry) => ({
          uid: entry.path,
          "rowTitle.text": entry.name,
          "rowDescription.text": entry.tags.join(" · "),
          "rowFlag.image.type": "fileicon",
          "rowFlag.image.src": entry.path,
        }))
      : [
          ...(s.query.trim() && !s.editing?.tags.includes(s.query.trim())
            ? [
                {
                  uid: "+",
                  "rowTitle.text": `Add “${s.query.trim()}”`,
                  "rowDescription.text": "Enter to add this tag",
                  "rowFlag.image.type": "symbol",
                  "rowFlag.image.src": "plus.circle",
                },
              ]
            : []),
          ...(s.editing?.tags ?? [])
            .filter((tag) => tag.toLowerCase().includes(s.query.toLowerCase()))
            .map((tag) => ({
              uid: `tag:${tag}`,
              "rowTitle.text": tag,
              "rowDescription.text": "Enter to remove",
              "rowFlag.image.type": "symbol",
              "rowFlag.image.src": "tag",
            })),
        ];
  return update(
    {
      items: {
        data: { src: values },
        select: values.some((v) => v.uid === s.selected) ? s.selected : values[0]?.uid || "",
        placeholder:
          s.mode === "edit"
            ? "Type a tag to add it"
            : "No tagged files found. Refresh or tag a file from Actions.",
      },
      copyButton: { text: s.mode === "edit" ? "Add / Remove  ↩" : "Manage Tags  ↩" },
      statusLabel: {
        text:
          s.mode === "edit"
            ? `${s.editing?.tags.length ?? 0} Finder tags`
            : `${s.index.entries.length} tagged items${s.index.limited ? " · First 500 paths" : ""}${s.index.unavailable ? ` · ${s.index.unavailable} unavailable` : ""}${s.index.stale ? " · Stale cache" : ""}`,
        colour: s.index.unavailable ? "systemOrangeColor" : "secondaryLabelColor",
        tooltip: s.index.fetched
          ? `Index refreshed ${new Date(s.index.fetched).toLocaleString()}`
          : "Loading…",
      },
    },
    true,
  );
};
const navigation = (s: State): Action =>
  merge(
    vars({ tags_level: s.level }),
    update(
      {
        query: {
          text: s.query,
          placeholder: s.mode === "edit" ? "Search or add tags…" : "Search names, paths or tags…",
        },
        location: {
          text: s.mode === "edit" ? s.path : "Finder tags · Files, folders and apps",
          tooltip: s.path,
        },
      },
      true,
    ),
    rows(s),
  );
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/tags", args: ["load", s.id, s.level, s.request], interval: 0, now: true },
});
const pick = (s: State, path: string): Entry => {
  const entry = s.mode === "edit" ? s.editing : s.index.entries.find((e) => e.path === path);
  if (!entry) throw new Error("Select a file or folder.");
  return entry;
};
const edit = async (s: State, path: string): Promise<Action> => {
  const entry = await readEntry(path);
  if (s.mode === "list") s.parent = { query: s.query, selected: path };
  s.mode = "edit";
  s.path = entry.path;
  s.editing = entry;
  s.query = "";
  s.selected = "";
  s.level = randomUUID();
  s.request = randomUUID();
  save(s);
  return navigation(s);
};
const simpleInput = (s: State): Action =>
  sheet("pathSheet", {
    type: "view",
    layout: "border",
    padding: 18,
    spacing: 14,
    components: [
      {
        type: "label",
        text: "Tag a file or folder",
        font: { size: 18, weight: "semibold" },
        constraints: { region: "top" },
      },
      {
        id: "pathInput",
        type: "textfield",
        placeholder: "/Volumes/My SSD/Projects",
        focus: true,
        constraints: { region: "centre", size: { width: 570 } },
        events: [{ triggers: "actioned", action: run("path", s, ["{value:self.text}"]) }],
      },
      {
        type: "button",
        text: "Manage Tags  ↩",
        constraints: { region: "bottom" },
        events: [{ triggers: "actioned", action: run("path", s, ["{value:pathInput.text}"]) }],
      },
    ],
  });
const importSheet = (s: State): Action =>
  sheet("importSheet", {
    type: "view",
    layout: "border",
    padding: 18,
    spacing: 12,
    components: [
      {
        type: "label",
        text: `Import tags for ${s.pending!.length} items`,
        font: { size: 18, weight: "semibold" },
        constraints: { region: "top" },
      },
      {
        id: "importList",
        type: "dataview",
        constraints: { region: "centre", size: { width: 620, height: 300 } },
        data: {
          type: "basic",
          src: s.pending!.map((entry) => ({
            uid: entry.path,
            "importTitle.text": entry.path,
            "importTags.text": entry.tags.join(" · "),
          })),
        },
        cell: {
          height: 56,
          root: {
            type: "view",
            layout: "border",
            padding: 8,
            components: [
              {
                id: "importTitle",
                type: "label",
                text: "",
                linebreak: "truncatetail",
                font: { size: 12 },
                constraints: { region: "top" },
              },
              {
                id: "importTags",
                type: "label",
                text: "",
                font: { size: 12 },
                linebreak: "truncatetail",
                constraints: { region: "centre" },
              },
            ],
          },
        },
      },
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        constraints: { region: "bottom" },
        components: [
          {
            type: "label",
            text: "Adds tags to existing items. Existing tags and colours are preserved.",
            font: { size: 11 },
          },
          {
            type: "button",
            text: "Import Tags",
            events: [{ triggers: "actioned", action: run("import-confirm", s, [], true) }],
          },
        ],
      },
    ],
  });
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", level = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (command === "prepare-origin")
    return merge(vars(backVariables("tags_out", process.env.tags_query)), profileAction({ str, bool }));
  if (command === "post") {
    if (process.env.tags_out === "back") performBack(process.env.swiss_return);
    if (process.env.tags_out === "file-actions" && process.env.tags_path)
      execFileSync(
        "/usr/bin/osascript",
        [
          "-e",
          'on run argv\ntell application id "com.runningwithcrayons.Alfred" to action argv as type "file"\nend run',
          process.env.tags_path,
        ],
        { timeout: 5000 },
      );
    return;
  }
  if (command === "launch") {
    const origin = launchInput(process.env.tags_query),
      s = create(origin.query, origin.returnTo);
    if (origin.query.startsWith("/") || origin.query.startsWith("~/")) {
      s.editing = await readEntry(origin.query);
      s.mode = "edit";
      s.path = s.editing.path;
      s.query = "";
      save(s);
    }
    const screen = merge(
      vars({ tags_session: s.id, tags_level: s.level }),
      update({ root: { components: components(s) } }, true),
    );
    return merge(screen, pulse(s));
  }
  const s = read(id);
  if (level !== s.level) return {};
  if (command === "load") {
    if (value !== s.request) return {};
    if (s.mode === "edit") return rows(s);
    await new Promise((resolve) => setTimeout(resolve, 180));
    if (read(id).request !== value) return {};
    const index = await scan(args[1] === "force", s.query),
      latest = read(id);
    if (latest.request !== value || latest.level !== level) return {};
    latest.index = index;
    save(latest);
    return rows(latest);
  }
  if (command === "query") {
    s.query = value.slice(0, 1000);
    if (s.mode === "list") s.request = randomUUID();
    save(s);
    return s.mode === "list" ? merge(rows(s), pulse(s)) : rows(s);
  }
  if (command === "select") {
    s.selected = value;
    save(s);
    return {};
  }
  if (command === "back") {
    if (s.mode === "edit" && s.parent) {
      s.mode = "list";
      s.query = s.parent.query;
      s.selected = s.parent.selected;
      s.parent = undefined;
      s.editing = undefined;
      s.path = "";
      s.level = randomUUID();
      s.request = randomUUID();
      save(s);
      return merge(navigation(s), pulse(s));
    }
    return finish({ tags_out: "back", swiss_return: s.returnTo });
  }
  if (command === "enter") {
    if (s.mode === "list") return edit(s, pick(s, value).path);
    if (value !== "+" && !value.startsWith("tag:")) return {};
    const add = value === "+" ? [validTag(s.query)] : [],
      remove = value.startsWith("tag:") ? [value.slice(4)] : [];
    if (remove.length && !s.editing?.tags.includes(remove[0]!)) return {};
    s.editing = await changeTags(s.path, add, remove);
    s.query = "";
    s.selected = "";
    const index = s.index.entries.findIndex((e) => e.path === s.path);
    if (index >= 0) s.index.entries[index] = s.editing;
    else s.index.entries.push(s.editing);
    save(s);
    return navigation(s);
  }
  if (command === "refresh") {
    if (s.mode === "edit") {
      s.editing = await readEntry(s.path);
      save(s);
      return rows(s);
    }
    s.request = randomUUID();
    save(s);
    return {
      pulse: {
        src: "../bin/tags",
        args: ["load", s.id, s.level, s.request, "force"],
        interval: 0,
        now: true,
      },
    };
  }
  if (command === "new") return simpleInput(s);
  if (command === "path") return merge({ sheet: { close: "pathSheet" } }, await edit(s, value));
  if (command === "export")
    return copy(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          entries: s.mode === "edit" ? [s.editing] : visible(s),
        },
        null,
        2,
      ),
    );
  if (command === "import") {
    const text = execFileSync("/usr/bin/pbpaste", [], {
      encoding: "utf8",
      timeout: 2000,
      maxBuffer: 2100000,
    });
    s.pending = parseImport(text);
    save(s);
    return importSheet(s);
  }
  if (command === "import-confirm") {
    if (!s.pending?.length) throw new Error("Open an import preview first.");
    const pending = s.pending;
    s.pending = undefined;
    save(s);
    let success = 0,
      failed = 0;
    const deadline = Date.now() + 20000;
    for (let i = 0; i < pending.length; i++) {
      if (Date.now() > deadline) {
        failed += pending.length - i;
        break;
      }
      const entry = pending[i]!;
      try {
        await changeTags(entry.path, entry.tags);
        success++;
      } catch {
        failed++;
      }
    }
    const latest = read(id);
    if (latest.level !== level) return {};
    latest.index = await scan(true, latest.query);
    if (latest.mode === "edit") latest.editing = await readEntry(latest.path);
    save(latest);
    return merge(
      { sheet: { close: "importSheet" } },
      rows(latest),
      update(
        {
          statusLabel: {
            text: `Imported ${success} · ${failed} unavailable or not processed. Refresh to see changes.`,
          },
        },
        true,
      ),
    );
  }
  if (command === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.tag-manager" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (command === "open" || command === "reveal") {
    execFileSync("/usr/bin/open", [...(command === "reveal" ? ["-R"] : []), pick(s, value).path], {
      timeout: 3000,
    });
    return {};
  }
  if (command === "copy-path") return copy(pick(s, value).path);
  if (command === "file-actions") return finish({ tags_out: "file-actions", tags_path: pick(s, value).path });
  if (command === "menu") {
    const has = s.mode === "edit" || s.index.entries.some((e) => e.path === value),
      mi = (title: string, cmd: string, argv: string[] = []) =>
        menuItem(title, [cmd, s.id, s.level, ...argv]);
    return popup("actionsButton", [
      ...(has
        ? [
            mi("Manage Tags", "edit", [value]),
            mi("Open", "open", [value]),
            mi("Reveal in Finder", "reveal", [value]),
            mi("Copy Path", "copy-path", [value]),
            mi("All Alfred File Actions…", "file-actions", [value]),
            separator,
          ]
        : []),
      mi("Tag a File or Folder…", "new"),
      mi(s.mode === "edit" ? "Export This Item’s Tags" : "Export Filtered Items’ Tags", "export"),
      mi("Import Tags from Clipboard…", "import"),
      mi("Refresh", "refresh"),
      mi("Workflow Configuration…", "configure"),
    ]);
  }
  if (command === "edit") return edit(s, pick(s, value).path);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
