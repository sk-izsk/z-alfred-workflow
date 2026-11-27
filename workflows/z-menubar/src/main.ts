import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { components } from "../ui/window.ts";
import { bool, str } from "./env.ts";
import { menuPath, pressItem, readMenus, search, shortcut, title, uid, type MenuItem } from "./menus.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { create, read, save, storeMenus, type State } from "./state.ts";
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

const MAX_ROWS = 200;
const visible = (s: State): MenuItem[] =>
  search(s.items, s.query, bool("show_disabled", false)).slice(0, MAX_ROWS);

const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((x) => uid(x) === s.selected)) s.selected = rows[0] ? uid(rows[0]) : "";
  save(s);
  const icon = s.app?.path
    ? { "rowIcon.image.type": "fileicon", "rowIcon.image.src": s.app.path }
    : { "rowIcon.image.type": "symbol", "rowIcon.image.src": "filemenu.and.selection" };
  return update(
    {
      items: {
        data: {
          src: rows.map((x) => ({
            uid: uid(x),
            "rowTitle.text": title(x),
            "rowDescription.text": [menuPath(x), shortcut(x), !x.enabled && "Unavailable"]
              .filter(Boolean)
              .join("   ·   "),
            ...icon,
          })),
        },
        select: s.selected,
        placeholder: s.items.length ? "No matching menu items" : s.status,
      },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/menubar", args: ["load", s.id, s.request], interval: 0, now: true },
});
const target = (s: State, id: string): MenuItem => {
  const x = s.items.find((item) => uid(item) === (id || s.selected));
  if (!x) throw new Error("Select a menu item.");
  return x;
};
const count = (s: State) => `${s.app?.name ?? "App"} · ${s.items.length} menu items`;

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("menubar_out", process.env.menubar_query)), profileAction({ str, bool }));
  // After the window closes: click the chosen item (its app is in front again), or go Back.
  if (cmd === "post") {
    if (process.env.menubar_out === "back") performBack(process.env.swiss_return);
    if (process.env.menubar_out === "press")
      await pressItem(Number(process.env.menubar_pid), {
        indexes: JSON.parse(process.env.menubar_indexes || "[]"),
        titles: JSON.parse(process.env.menubar_titles || "[]"),
      });
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.menubar_query || "");
    const s = create(origin.query, origin.returnTo);
    return merge(
      vars({ menubar_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ menubar_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const menus = await readMenus(s.app?.pid ?? 0, bool("show_apple_menu", false));
      storeMenus(menus);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.app = menus.app;
      latest.items = menus.items;
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
    s.selected = value;
    save(s);
    return {};
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Reading menus…";
    return merge(render(s), pulse(s));
  }
  if (cmd === "open") {
    const x = target(s, value);
    if (!x.enabled) throw new Error(`“${title(x)}” is unavailable right now.`);
    if (!s.app) throw new Error("Wait for the menus to load.");
    return finish({
      menubar_out: "press",
      menubar_pid: String(s.app.pid),
      menubar_indexes: JSON.stringify(x.indexes),
      menubar_titles: JSON.stringify(x.titles),
      swiss_return: s.returnTo,
    });
  }
  if (cmd === "copy") return copy(target(s, value).titles.join(" › "));
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.menubar" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const x = s.items.find((item) => uid(item) === (value || s.selected));
    const act = (a: string[], async = false) => script([a[0]!, id, ...a.slice(1)], async);
    return popup("actionsButton", [
      ...(x
        ? [
            { text: "Click   ↩", action: act(["open", uid(x)]) },
            { text: "Copy Menu Path   ⌘C", action: act(["copy", uid(x)]) },
            separator,
          ]
        : []),
      { text: "Refresh   ⌘R", action: act(["refresh"], true) },
      { text: "Workflow Configuration…", action: act(["configure"]) },
    ]);
  }
  return {};
};
main()
  .then((result) => process.stdout.write(JSON.stringify(result || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
