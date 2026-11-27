// Menu Bar: a Script Filter on `m` that lists the front app's menu items right in Alfred's results.
//   menubar filter          → Script Filter JSON (Alfred filters as you type)
//   menubar press <json>    → clicks the chosen item (after Alfred closes)
//   menubar open            → opens Alfred with the keyword (External Trigger, used by Swiss)
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { bool, cacheDir, readJson, str, writeJson } from "./env.ts";
import { alfredItem, pressItem, readMenus, readOwner, type App, type MenuItem } from "./menus.ts";

const lastFile = (bundle: string) => join(cacheDir(), `last-${bundle.replace(/[^\w.-]/g, "_")}.json`);
const print = (value: unknown) =>
  new Promise<void>((resolve) => process.stdout.write(JSON.stringify(value), () => resolve()));
const output = (app: App, items: MenuItem[], extra: Record<string, unknown> = {}) => ({
  ...extra,
  items: items.filter((x) => x.enabled || bool("show_disabled", false)).map((x) => alfredItem(app, x)),
});
const failure = (error: unknown) => ({
  items: [
    {
      title: error instanceof Error ? error.message : String(error),
      subtitle: "Menu Bar couldn't read the menus",
      valid: false,
      icon: { path: "icon.png" },
    },
  ],
});

/**
 * First run: the app's menus from last time, at once, then a rerun reads them live (~0.3 s) and
 * replaces them. Without a saved list, the live read is the first answer.
 */
const filter = async () => {
  const apple = bool("show_apple_menu", false);
  if (process.env.menubar_live !== "1") {
    const app = await readOwner();
    const last = app.bundle ? readJson<MenuItem[]>(lastFile(app.bundle), []) : [];
    if (last.length)
      return output(app, last, {
        rerun: 0.1,
        variables: { menubar_live: "1", menubar_pid: String(app.pid) },
      });
  }
  const menus = await readMenus(Number(process.env.menubar_pid) || 0, apple);
  if (menus.app.bundle) writeJson(lastFile(menus.app.bundle), menus.items);
  return output(menus.app, menus.items, {
    variables: { menubar_live: "1", menubar_pid: String(menus.app.pid) },
  });
};

const main = async () => {
  const [cmd = "", value = ""] = process.argv.slice(2);
  if (cmd === "filter") return print(await filter().catch(failure));
  if (cmd === "press") {
    const { pid, indexes, titles } = JSON.parse(value) as {
      pid: number;
      indexes: number[];
      titles: string[];
    };
    await pressItem(pid, { indexes, titles });
    return;
  }
  if (cmd === "open") {
    // Swiss opens tools by External Trigger; a Script Filter opens by typing its keyword.
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        "on run argv",
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)',
        "-e",
        "end run",
        `${str("kw_main", "m")} `,
      ],
      { timeout: 5000 },
    );
  }
};
main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  },
);
