import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { backBinding, displayWidth, shortcutLabel } from "../../../shared/ui-profile.ts";
import { APP_DIRS, appId, appName, categoryName, iconFile, prepareApps, scanApps } from "./apps.ts";
import { bool, cacheDir, dataDir, readJson, str, writeJson } from "./env.ts";
import { defaultLayout, fromLegacy, isFolder, reconcile, validLayout, type Layout } from "./layout.ts";
import { backVariables, performBack } from "./navigation.ts";
import { renderPage } from "./page.ts";
import { copy, errorStatus, finish, merge, popup, update, vars, type Action } from "./ui.ts";

/** Where the original Launchpad workflow keeps its order (read once, never written). */
const LEGACY = join(
  homedir(),
  "Library/Application Support/Alfred/AlfredUI/Persist/com.alfredapp.vitor.launchpad/variables.json",
);
const num = (key: string, fallback: number, min: number, max: number) => {
  const n = Number(str(key, String(fallback)));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const cols = () => num("page_cols", 7, 3, 12);
const rows = () => num("page_rows", 5, 2, 10);
const size = () => cols() * rows();
const extraDirs = () =>
  str("extra_dirs")
    .split("\n")
    .map((d) => d.trim().replace(/^~(?=\/)/, homedir()))
    .filter(Boolean);
const layoutFile = () => join(dataDir(), "layout.json");
const iconDir = () => join(cacheDir(), "icons");
const categoriesFile = () => join(cacheDir(), "categories.json");
const lastStateFile = () => join(cacheDir(), "last-state.txt");
const installedApps = () => scanApps([...APP_DIRS, ...extraDirs()]);

/** The saved layout, or (first run) the original workflow's order, or Apple's default order. */
const currentLayout = (installed: string[]): Layout => {
  const saved = readJson<Layout | null>(layoutFile(), null);
  let layout = saved;
  if (!layout) {
    const legacy = readJson<{ all_items?: unknown } | null>(LEGACY, null)?.all_items;
    const items = typeof legacy === "string" ? JSON.parse(legacy) : legacy;
    layout = items ? fromLegacy(items, size()) : defaultLayout(installed, size());
  }
  const next = reconcile(layout, installed, size());
  if (JSON.stringify(next) !== JSON.stringify(saved)) writeJson(layoutFile(), next);
  return next;
};

type Extra = { page?: number; sel?: string };
/** Page ids: folders keep `folder:<id>`, apps use their short id. */
const pageId = (slot: string) => (isFolder(slot) ? slot : appId(slot));
/** Pages and folders for the web page use short ids instead of paths. */
const toPage = (layout: Layout, categories: Record<string, string>, extra: Extra = {}) => {
  const paths = [
    ...layout.pages.flat().filter((s) => !isFolder(s)),
    ...Object.values(layout.folders).flatMap((f) => f.apps),
  ];
  return renderPage({
    apps: Object.fromEntries(
      paths.map((p) => [
        appId(p),
        { name: appName(p), icon: `icons/${iconFile(p)}`, cat: categoryName(categories[p] ?? "") },
      ]),
    ),
    pages: layout.pages.map((page) => page.map(pageId)),
    folders: Object.fromEntries(
      Object.entries(layout.folders).map(([k, f]) => [k, { name: f.name, apps: f.apps.map(appId) }]),
    ),
    cols: cols(),
    rows: rows(),
    page: extra.page ?? 0,
    sel: extra.sel ?? "",
  });
};

/** Writes the page to one of four files in turn: a new `src` is what makes the view reload. */
const writePage = (html: string, query = ""): Action => {
  const counter = join(cacheDir(), "page-counter");
  const n = (Number(existsSync(counter) ? readFileSync(counter, "utf8") : "0") + 1) % 4;
  writeFileSync(counter, String(n));
  const file = join(cacheDir(), `page-${n}.html`);
  writeFileSync(file, html);
  return update({ grid: { src: `file://${encodeURI(file)}${query}` }, statusLabel: { text: "" } });
};

/** Scan, export missing icons, reconcile the layout and draw it. */
const show = async (extra: Extra = {}, query = ""): Promise<Action> => {
  const installed = installedApps();
  const categories = await prepareApps(
    installed,
    iconDir(),
    readJson<Record<string, string>>(categoriesFile(), {}),
  );
  writeJson(categoriesFile(), categories);
  return writePage(toPage(currentLayout(installed), categories, extra), query);
};

type PageState = {
  pages: string[][];
  folders: Record<string, { name: string; apps: string[] }>;
  page?: number;
  sel?: string;
};
const decodeState = (s: string): PageState => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
const lastState = (): Partial<PageState> => {
  try {
    return decodeState(readFileSync(lastStateFile(), "utf8"));
  } catch {
    // no state yet
    return {};
  }
};

/** A layout from the page (short ids) back to paths, validated before it is saved. */
const pageLayoutToPaths = (state: PageState) => {
  const installed = installedApps();
  const byId = new Map(installed.map((p) => [appId(p), p]));
  const path = (id: string) => (isFolder(id) ? id : (byId.get(id) ?? `?${id}`));
  const candidate = {
    pages: state.pages.map((page) => page.map(path)),
    folders: Object.fromEntries(
      Object.entries(state.folders ?? {}).map(([k, f]) => [k, { name: f.name, apps: f.apps.map(path) }]),
    ),
  };
  return validLayout(candidate, new Set(installed), size());
};
const appPath = (id: string) => {
  const path = installedApps().find((p) => appId(p) === id);
  if (!path) throw new Error("That app is no longer installed. Refresh Apps from Actions.");
  return path;
};
const open = (args: string[]) => spawn("/usr/bin/open", args, { detached: true, stdio: "ignore" }).unref();

const script = (args: string[], async = false): Action => ({
  type: "script",
  src: "../bin/launchpad",
  args,
  ...(async && { async: true }),
});
const menu = (): Action =>
  popup("actionsButton", [
    { text: "Cheat Sheet   ⌘?", action: script(["help"]) },
    { text: "Refresh Apps", action: script(["refresh"], true) },
    { text: "Open Applications Folder", action: script(["apps-folder"]) },
    { type: "separator" },
    {
      text: "Reset Layout…",
      action: script(["reset"], true),
      confirm: {
        message: "Reset the layout?",
        informativetext:
          "Folders are removed and apps return to Apple's default order. This can't be undone.",
        confirmbuttontext: "Reset",
      },
    },
    { text: "Workflow Configuration…", action: script(["configure"]) },
  ]);

/** The page navigated to `?op=…`; plain page loads (our own `src`) carry no op. */
const pageOp = (value: string): Action => {
  const url = new URL(value || "file:///");
  const op = url.searchParams.get("op");
  if (!op) return {};
  const arg = url.searchParams.get("arg") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (s) writeFileSync(lastStateFile(), s);
  switch (op) {
    case "save":
      writeJson(layoutFile(), pageLayoutToPaths(decodeState(s)));
      return {};
    case "open":
      open([appPath(arg)]);
      return finish();
    case "reveal":
      open(["-R", appPath(arg)]);
      return {};
    case "copy": {
      const path = appPath(arg);
      return merge(copy(path), update({ statusLabel: { text: `Copied the path of ${appName(path)}` } }));
    }
    case "back":
      return finish({ launchpad_out: "back" });
    case "close":
      return finish();
    case "menu":
      return menu();
    default:
      return {};
  }
};

const main = async (): Promise<Action> => {
  const [cmd = "", value = ""] = process.argv.slice(2);
  switch (cmd) {
    case "ui-profile": {
      // Launchpad keeps the original's 1100 × 850 window (configurable), fitted to the display.
      const back = backBinding({ str, bool });
      const wanted = num("window_width", 1100, 600, 3000);
      const available = displayWidth();
      const width = Number.isFinite(available) && available > 80 ? Math.min(wanted, available - 40) : wanted;
      return {
        variables: {
          back_shortcut: back.shortcut,
          back_label: back.label,
          actions_label: shortcutLabel(str("actions_shortcut", "⌘K")),
        },
        update: {
          ids: Object.fromEntries(
            process.argv.slice(3).map((id) => [id, { text: `Back  ${back.label}`, shortcut: back.shortcut }]),
          ),
        },
        window: { resize: { width: Math.floor(width), height: num("window_height", 850, 400, 2000) } },
      };
    }
    case "prepare-origin":
      return vars(backVariables("launchpad_out", ""));
    case "launch":
      return show();
    case "post":
      if (process.env.launchpad_out === "back") performBack("");
      return {};
    case "nav":
      return pageOp(value);
    case "menu":
      return menu();
    case "back":
      return finish({ launchpad_out: "back" });
    case "help": {
      const s = existsSync(lastStateFile()) ? readFileSync(lastStateFile(), "utf8") : "";
      return show({}, `?help=1${s ? `&s=${s}` : ""}`);
    }
    case "refresh": {
      const s = lastState();
      return show({ page: s.page, sel: s.sel });
    }
    case "reset":
      writeJson(layoutFile(), defaultLayout(installedApps(), size()));
      writeFileSync(lastStateFile(), "");
      return show();
    case "apps-folder":
      open(["/Applications"]);
      return {};
    case "configure":
      execFileSync(
        "/usr/bin/osascript",
        [
          "-e",
          'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.launchpad" configuration true',
        ],
        { timeout: 5000 },
      );
      return {};
    default:
      return {};
  }
};

main()
  .then((action) => process.stdout.write(JSON.stringify(action), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
