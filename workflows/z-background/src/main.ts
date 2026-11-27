import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { components, FILTERS } from "../ui/window.ts";
import { bool, str } from "./env.ts";
import {
  describe,
  inFilter,
  matches,
  readItems,
  removeLoginItem,
  setDisabled,
  sortItems,
  start,
  stop,
  symbol,
  trash,
  type Filter,
  type Item,
} from "./items.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { create, read, save, storeItems, type State } from "./state.ts";
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

const visible = (s: State): Item[] =>
  sortItems(s.items).filter((x) => inFilter(x, s.filter) && matches(x, s.query));
const count = (s: State): string => {
  const running = s.items.filter((x) => x.running).length,
    leftovers = s.items.filter((x) => x.missing).length;
  return [
    `${s.items.length} items`,
    `${running} running`,
    leftovers && `${leftovers} leftover${leftovers === 1 ? "" : "s"}`,
    s.loginDenied && "Login items need Automation access for Alfred",
  ]
    .filter(Boolean)
    .join(" · ");
};

const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((x) => x.id === s.selected)) s.selected = rows[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: rows.map((x) => ({
            uid: x.id,
            "rowTitle.text": x.name,
            "rowDescription.text": describe(x),
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": symbol(x),
            "rowIcon.contenttintcolour": x.missing
              ? "systemOrangeColor"
              : x.running
                ? "systemGreenColor"
                : "secondaryLabelColor",
          })),
        },
        select: s.selected,
        placeholder: s.items.length ? "Nothing matches" : s.status,
      },
      filter: { selected: s.filter },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/background", args: ["load", s.id, s.request], interval: 0, now: true },
});
const reload = async (s: State, status: string): Promise<Action> => {
  const snapshot = await readItems();
  s.items = snapshot.items;
  s.loginDenied = snapshot.loginDenied;
  storeItems(s.items);
  s.status = status;
  return render(s);
};
const target = (s: State, id: string): Item => {
  const x = s.items.find((item) => item.id === (id || s.selected));
  if (!x) throw new Error("Select an item.");
  return x;
};
const open = (args: string[]) => execFileSync("/usr/bin/open", args, { timeout: 3000 });
const action = (id: string, args: string[], async = false): Action =>
  script([args[0]!, id, ...args.slice(1)], async);
const item = (text: string, act: Action, hint = "", confirm?: Action): Action => ({
  text: hint ? `${text}   ${hint}` : text,
  action: act,
  ...(confirm && { confirm }),
});
const filterOf = (value: string | undefined): Filter =>
  (FILTERS.some((f) => f.value === value) ? value : "all") as Filter;

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("background_out", process.env.background_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.background_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.background_query || "");
    const s = create(origin.query, origin.returnTo, filterOf(str("start_filter")));
    return merge(
      vars({ background_session: s.id }),
      update({ root: { components: components(s.query, s.filter) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ background_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const snapshot = await readItems();
      storeItems(snapshot.items);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.items = snapshot.items;
      latest.loginDenied = snapshot.loginDenied;
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
  if (cmd === "filter") {
    s.filter = filterOf(value);
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
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    return merge(render(s), pulse(s));
  }
  // ↩ reveals the plist (or the login item's app) in Finder: looking is always safe.
  if (cmd === "open") {
    const x = target(s, value);
    const path = x.plist || x.program;
    if (!path) throw new Error(`${x.name} has no file to show.`);
    open(["-R", path]);
    return finish({ background_out: "done" });
  }
  if (cmd === "open-plist") {
    const x = target(s, value);
    if (!x.plist) throw new Error("Login items have no plist.");
    open(["-t", x.plist]);
    return finish({ background_out: "done" });
  }
  if (cmd === "toggle-run") {
    const x = target(s, value);
    if (x.group === "login") throw new Error("Open or quit the app itself to start or stop a login item.");
    if (x.running || x.loaded) {
      await stop(x);
      return reload(s, `Stopped ${x.name}`);
    }
    await start(x);
    return reload(s, `Started ${x.name}`);
  }
  if (cmd === "toggle-disable") {
    const x = target(s, value);
    if (x.group === "login") throw new Error("Remove a login item from Actions instead.");
    await setDisabled(x, !x.disabled);
    return reload(s, x.disabled ? `Enabled ${x.name}` : `Disabled ${x.name}: it won't start again`);
  }
  if (cmd === "trash") {
    const x = target(s, value);
    await trash(x);
    return reload(s, `Moved ${x.name} to the Trash`);
  }
  if (cmd === "remove-login") {
    const x = target(s, value);
    await removeLoginItem(x);
    return reload(s, `${x.name} no longer opens at login`);
  }
  if (cmd === "copy") {
    const x = target(s, value);
    return copy(x.label || x.program || x.name);
  }
  if (cmd === "settings") {
    open(["x-apple.systempreferences:com.apple.LoginItems-Settings.extension"]);
    return finish({ background_out: "done" });
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.background" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const x = s.items.find((i) => i.id === (value || s.selected));
    const admin = x?.group === "daemon" ? "  (asks for your password)" : "";
    return popup("actionsButton", [
      ...(x
        ? [
            item(
              x.plist ? "Reveal Plist in Finder" : "Reveal App in Finder",
              action(id, ["open", x.id]),
              "↩",
            ),
            ...(x.plist ? [item("Open Plist", action(id, ["open-plist", x.id]), "⌘O")] : []),
            ...(x.group !== "login"
              ? [
                  item(
                    `${x.running || x.loaded ? "Stop" : "Start"}${admin}`,
                    action(id, ["toggle-run", x.id], true),
                    "⌘S",
                  ),
                  item(
                    `${x.disabled ? "Enable" : "Disable"}${admin}`,
                    action(id, ["toggle-disable", x.id], true),
                    "⌘D",
                  ),
                ]
              : [
                  item("Remove from Login Items", action(id, ["remove-login", x.id], true), "", {
                    message: `Stop opening ${x.name} at login?`,
                    informativetext: "The app stays installed. You can add it back in Login Items settings.",
                    confirmbuttontext: "Remove",
                  }),
                ]),
            ...(x.group === "user-agent"
              ? [
                  item("Move Plist to Trash", action(id, ["trash", x.id], true), "", {
                    message: `Move ${x.name} to the Trash?`,
                    informativetext: "It is stopped first. You can put it back from the Trash.",
                    confirmbuttontext: "Move to Trash",
                  }),
                ]
              : []),
            item(x.label ? "Copy Label" : "Copy Path", action(id, ["copy", x.id]), "⌘C"),
            separator,
          ]
        : []),
      item("Open Login Items Settings", action(id, ["settings"])),
      item("Refresh", action(id, ["refresh"], true), "⌘R"),
      item("Workflow Configuration…", action(id, ["configure"])),
    ]);
  }
  return {};
};
main()
  .then((result) => process.stdout.write(JSON.stringify(result || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
