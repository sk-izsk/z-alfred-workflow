// Menu Bar: a Script Filter on `m` that lists the front app's menu items right in Alfred's results.
//   menubar filter          → Script Filter JSON (Alfred filters as you type)
//   menubar press <json>    → clicks the chosen item (after Alfred closes)
//   menubar open            → opens Alfred with the keyword (External Trigger, used by Swiss)
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { bool, cacheDir, readJson, str, writeJson } from "./env.ts";
import { alfredItem, pressItem, readMenus, readOwner, search, type App, type MenuItem } from "./menus.ts";

/** A whole number from Configuration, or the default when empty or invalid. */
const whole = (key: string, fallback: number) => {
  const n = Number.parseInt(str(key, String(fallback)), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
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

const MAX_RESULTS = 300;
/** Fresh enough to skip another live read (the user is typing, or reopened just now). */
const FRESH_MS = 5000;
const results = (app: App, items: MenuItem[], query: string, extra: Record<string, unknown> = {}) =>
  output(
    app,
    search(items, query, bool("show_disabled", false), bool("fuzzy", true)).slice(0, MAX_RESULTS),
    extra,
  );

/**
 * Runs on every keystroke (Alfred passes the query). Filtering uses the saved list, so typing never
 * waits for the menus; the menus are read live once per opening, by a rerun, unless they were read in
 * the last few seconds.
 */
const filter = async (query: string) => {
  const live = process.env.menubar_live === "1";
  const app: App = live && process.env.menubar_app ? JSON.parse(process.env.menubar_app) : await readOwner();
  const file = app.bundle ? lastFile(app.bundle) : "";
  const last = file ? readJson<MenuItem[]>(file, []) : [];
  const age = file && existsSync(file) ? Date.now() - statSync(file).mtimeMs : Infinity;
  const variables = { menubar_live: "1", menubar_app: JSON.stringify(app) };
  if (last.length && (live || age < FRESH_MS)) return results(app, last, query, { variables });
  // Saved list now; the rerun (flagged) reads the menus live and replaces it.
  if (last.length && process.env.menubar_refresh !== "1")
    return results(app, last, query, {
      rerun: 0.1,
      variables: { menubar_refresh: "1", menubar_app: JSON.stringify(app) },
    });
  const menus = await readMenus(app.pid, {
    apple: bool("show_apple_menu", false),
    depth: Math.max(1, whole("max_depth", 10)),
    perMenu: whole("max_per_menu", 40),
  });
  if (file) writeJson(file, menus.items);
  return results(menus.app, menus.items, query, { variables });
};

const main = async () => {
  const [cmd = "", value = ""] = process.argv.slice(2);
  if (cmd === "filter") return print(await filter(value).catch(failure));
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
