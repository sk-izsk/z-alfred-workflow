import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { components } from "../ui/window.ts";
import {
  canEject,
  describe,
  eject,
  matches,
  readDrives,
  sortDrives,
  symbol,
  usedShare,
  type Drive,
} from "./drives.ts";
import { bool, str } from "./env.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { create, read, save, storeDrives, type State } from "./state.ts";
import {
  copy,
  errorStatus,
  finish,
  merge,
  popup,
  script,
  separator,
  update,
  vars,
  type Action,
} from "./ui.ts";

const LOW_SPACE = 0.9;
const visible = (s: State): Drive[] => sortDrives(s.drives).filter((d) => matches(d, s.query));
const count = (s: State) => {
  const ejectable = s.drives.filter(canEject).length;
  return `${s.drives.length} drive${s.drives.length === 1 ? "" : "s"}${ejectable ? ` · ${ejectable} ejectable` : ""}`;
};

const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((d) => d.path === s.selected)) s.selected = rows[0]?.path || "";
  save(s);
  const selected = rows.find((d) => d.path === s.selected);
  return update(
    {
      items: {
        data: {
          src: rows.map((d) => ({
            uid: d.path,
            "rowTitle.text": d.name,
            "rowDescription.text": describe(d),
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": symbol(d),
            "rowIcon.contenttintcolour":
              usedShare(d) > LOW_SPACE
                ? "systemOrangeColor"
                : canEject(d)
                  ? "controlAccentColor"
                  : "secondaryLabelColor",
          })),
        },
        select: s.selected,
        placeholder: s.drives.length ? "No matching drives" : s.status,
      },
      primary: { text: selected && !canEject(selected) ? "Open  ↩" : "Eject  ↩" },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/drives", args: ["load", s.id, s.request], interval: 0, now: true },
});
const reload = async (s: State, status: string): Promise<Action> => {
  s.drives = await readDrives();
  storeDrives(s.drives);
  s.status = status;
  return render(s);
};
const target = (s: State, path: string): Drive => {
  const d = s.drives.find((x) => x.path === (path || s.selected));
  if (!d) throw new Error("Select a drive.");
  return d;
};
const open = (args: string[]) => execFileSync("/usr/bin/open", args, { timeout: 3000 });
const action = (id: string, args: string[], async = false): Action =>
  script([args[0]!, id, ...args.slice(1)], async);
const item = (text: string, act: Action, hint = "", confirm?: Action): Action => ({
  text: hint ? `${text}   ${hint}` : text,
  action: act,
  ...(confirm && { confirm }),
});

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("drives_out", process.env.drives_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.drives_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.drives_query || "");
    const s = create(origin.query, origin.returnTo);
    return merge(
      vars({ drives_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ drives_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const drives = await readDrives();
      storeDrives(drives);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.drives = drives;
      latest.status = count(latest);
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
    if (s.drives.some((d) => d.path === value)) {
      s.selected = value;
      save(s);
      // The primary button says Eject or Open for the selected drive.
      return update({ primary: { text: canEject(target(s, value)) ? "Eject  ↩" : "Open  ↩" } });
    }
    return {};
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    return merge(render(s), pulse(s));
  }
  // ↩ ejects; on the startup disk and other internal volumes it opens the drive instead.
  if (cmd === "open") {
    const d = target(s, value);
    if (!canEject(d)) {
      open([d.path]);
      return finish({ drives_out: "done" });
    }
    await eject(d);
    return reload(s, `Ejected ${d.name}`);
  }
  if (cmd === "eject" || cmd === "force-eject") {
    const d = target(s, value);
    await eject(d, cmd === "force-eject");
    return reload(s, `Ejected ${d.name}`);
  }
  if (cmd === "eject-all") {
    const list = s.drives.filter(canEject);
    if (!list.length) throw new Error("Nothing to eject.");
    const failed: string[] = [];
    // One at a time: diskutil serialises ejects anyway, and one failure must not stop the rest.
    for (const d of list)
      await eject(d).catch((error: Error) => {
        failed.push(error.message);
      });
    return reload(
      s,
      failed.length ? failed.join(" ") : `Ejected ${list.length} drive${list.length === 1 ? "" : "s"}`,
    );
  }
  if (cmd === "reveal") {
    open([target(s, value).path]);
    return finish({ drives_out: "done" });
  }
  if (cmd === "image") {
    const d = target(s, value);
    if (!d.image) throw new Error(`${d.name} isn't a disk image.`);
    open(["-R", d.image]);
    return finish({ drives_out: "done" });
  }
  if (cmd === "copy") return copy(target(s, value).path);
  if (cmd === "disk-utility") {
    open(["-b", "com.apple.DiskUtility"]);
    return finish({ drives_out: "done" });
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.drives" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const d = s.drives.find((x) => x.path === (value || s.selected));
    const ejectable = s.drives.filter(canEject);
    return popup("actionsButton", [
      ...(d
        ? [
            ...(canEject(d)
              ? [
                  item("Eject", action(id, ["eject", d.path], true), "↩"),
                  item("Force Eject", action(id, ["force-eject", d.path], true), "", {
                    message: `Force eject ${d.name}?`,
                    informativetext:
                      "Apps using it may lose unsaved changes. Use this only when an eject keeps failing.",
                    confirmbuttontext: "Force Eject",
                  }),
                ]
              : []),
            item("Open in Finder", action(id, ["reveal", d.path]), "⌘O"),
            ...(d.image ? [item("Show Disk Image File", action(id, ["image", d.path]))] : []),
            item("Copy Path", action(id, ["copy", d.path]), "⌘C"),
            separator,
          ]
        : []),
      ...(ejectable.length
        ? [
            item("Eject All", action(id, ["eject-all"], true), "", {
              message: `Eject ${ejectable.length} drive${ejectable.length === 1 ? "" : "s"}?`,
              informativetext: ejectable.map((x) => x.name).join(", "),
              confirmbuttontext: "Eject All",
            }),
          ]
        : []),
      item("Open Disk Utility", action(id, ["disk-utility"])),
      item("Refresh", action(id, ["refresh"], true), "⌘R"),
      item("Workflow Configuration…", action(id, ["configure"])),
    ]);
  }
  return {};
};
main()
  .then((result) => process.stdout.write(JSON.stringify(result || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
