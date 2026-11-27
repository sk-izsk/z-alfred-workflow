// `nt <command> [args…]`: one JSON action on stdout per run.
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { profileCommand } from "../../../shared/ui-profile.ts";
import { bool, cacheDir, dataDir, readJson, str, writeJson } from "./env.ts";
import { isAllDay, parseWhen } from "./format.ts";
import * as nt from "./notion.ts";
import type { DbProp, FormValue, Page, User } from "./notion.ts";
import * as screens from "./screens.ts";
import { type Json, type Row, run } from "./screens.ts";
import { type Action, merge, popup, separator, sheet, update } from "./ui.ts";

await profileCommand(() => import("./env.ts"));

type Sort = "last_edited_time" | "created_time";
type Screen =
  | { kind: "search"; query: string }
  | { kind: "database"; id: string; name: string; query: string; sort: Sort }
  | { kind: "page"; id: string; meta: boolean }
  | { kind: "create"; database: string; multi: Record<string, string[]>; title?: string; content?: string }
  | { kind: "capture"; url: string }
  | { kind: "text"; text: string; target?: string; heading?: string }
  | { kind: "note"; text: string }
  | { kind: "connect"; message?: string };
type State = { stack: Screen[]; token: number; pickerQuery?: string };

const [command = "", ...args] = process.argv.slice(2);
const statePath = () => join(cacheDir(), "state.json");
const loadState = (): State => readJson<State>(statePath(), { stack: [], token: 0 });
const saveState = (s: State) => writeJson(statePath(), s);
const top = (s: State): Screen | undefined => s.stack.at(-1);
const yes = (value: string | undefined) => value === "1" || value === "true";

// ---- Local data: pages seen, pins, recents, database views ----

const pages = (): Record<string, Page> => nt.cached<Record<string, Page>>("pages") ?? {};
const remember = (list: Page[]) => {
  const all = pages();
  for (const p of list) all[p.id] = p;
  nt.store("pages", all);
};
const pageOf = (uid: string): Page | undefined => (uid.startsWith("p-") ? pages()[uid.slice(2)] : undefined);
const users = (): User[] => nt.cached<User[]>("users") ?? [];

const listFile = (name: string) => join(dataDir(), `${name}.json`);
const pinned = () => readJson<Page[]>(listFile("pinned"), []);
const recent = () => readJson<Page[]>(listFile("recent"), []);
const addRecent = (page: Page) =>
  writeJson(listFile("recent"), [page, ...recent().filter((p) => p.id !== page.id)].slice(0, 20));
const lastTarget = () => readJson<string>(listFile("last-target"), "");

type View = { type: "list" | "kanban"; visible?: string[] };
const views = () => readJson<Record<string, View>>(listFile("views"), {});
const viewOf = (id: string, props: DbProp[]): Required<View> => {
  const view = views()[id];
  const fallback = props
    .filter((p) => ["status", "select", "multi_select"].includes(p.type))
    .slice(0, 2)
    .map((p) => p.id);
  return { type: view?.type ?? "list", visible: view?.visible ?? fallback };
};
const saveView = (id: string, view: View) => writeJson(listFile("views"), { ...views(), [id]: view });

const searchResults = (query: string) =>
  nt.cached<Page[]>(`search-${query.toLowerCase()}`) ?? nt.cached<Page[]>("search-") ?? [];
const dbPages = (id: string, sort: Sort, query: string) =>
  nt.cached<Page[]>(`db-${id}-${sort}-${query.toLowerCase()}`);
const dbProps = (id: string) => nt.cached<DbProp[]>(`props-${id}`) ?? [];

// ---- Settings ----

const primaryIsPreview = () => str("primary_action", "notion") === "preview";
const notesRoot = () => str("notes_page_name", "NOTES");
/** The daily page title; supports the common date-fns tokens (yyyy, MMM, MM, dd). */
export const noteDate = (format = str("note_date_format", "yyyy-MM-dd"), date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return format
    .replace(/yyyy/g, String(date.getFullYear()))
    .replace(/MMM/g, months[date.getMonth()] ?? "")
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/dd/g, pad(date.getDate()))
    .replace(/'/g, "");
};

// ---- Rendering ----

const status = (text: string, colour = "secondaryLabelColor"): Action =>
  update({ statusLabel: { text, colour } }, true);
const failure = (text: string): Action => merge(status(text, "systemRedColor"), { sound: { src: "Basso" } });
const firstPage = (rows: Row[]) => String(rows.find((r) => !String(r.uid).startsWith("h-"))?.uid ?? "");

/** Pinned, then Recent, then search results, each matching what is typed. */
const searchRows = (query: string): Row[] => {
  const people = users();
  const match = (p: Page) => p.title.toLowerCase().includes(query.trim().toLowerCase());
  const pin = pinned().filter(match);
  const pinIds = new Set(pin.map((p) => p.id));
  const rec = recent().filter((p) => match(p) && !pinIds.has(p.id));
  const seen = new Set([...pinIds, ...rec.map((p) => p.id)]);
  const results = searchResults(query).filter((p) => !seen.has(p.id));
  const section = (name: string, list: Page[]) =>
    list.length ? [screens.sectionRow(name), ...list.map((p) => screens.pageRow(p, people))] : [];
  return [...section("Pinned", pin), ...section("Recent", rec), ...section("Search", results)];
};

const databaseRows = (screen: Extract<Screen, { kind: "database" }>): Row[] => {
  const props = dbProps(screen.id);
  const view = viewOf(screen.id, props);
  const list = dbPages(screen.id, screen.sort, screen.query) ?? [];
  const row = (p: Page) => screens.pageRow(p, users(), view.visible);
  if (view.type !== "kanban") return list.map(row);
  // Kanban: one section per status (or select) option, in the database's own order.
  const by = props.find((p) => p.type === "status") ?? props.find((p) => p.type === "select");
  if (!by) return list.map(row);
  const optionOf = (p: Page) => {
    const value = p.properties.find((q) => q.id === by.id);
    return value && "option" in value ? value.option?.name : undefined;
  };
  const groups = [...(by.options ?? []).map((o) => o.name), undefined];
  return groups.flatMap((name) => {
    const inGroup = list.filter((p) => optionOf(p) === name);
    return inGroup.length ? [screens.sectionRow(name ?? `No ${by.name}`), ...inGroup.map(row)] : [];
  });
};

const pickerPages = (screen: Screen, query = loadState().pickerQuery ?? ""): Page[] => {
  const all = searchResults(query);
  return screen.kind === "capture" ? all : all.filter((p) => p.object === "page");
};

const multiOptions = (props: DbProp[]): screens.MultiOptions =>
  Object.fromEntries(
    props.map((p) => [
      p.id,
      p.type === "people"
        ? users().map((u) => ({ id: u.id, name: u.name }))
        : p.type === "relation"
          ? (nt.cached<Page[]>(`relation-${p.relation}`) ?? []).map((q) => ({ id: q.id, name: q.title }))
          : (p.options ?? []).map((o) => ({ id: o.id, name: o.name })),
    ]),
  );

/** The whole window for the screen on top of the stack. */
const render = (s: State, note = ""): Action => {
  const screen = top(s);
  let view: { components: Json[]; shortcuts: Json[] } = screens.loadingScreen(note || "Loading…");
  if (screen?.kind === "connect")
    view = screens.connectScreen(nt.cached<string>("workspace"), screen.message ?? note);
  else if (screen?.kind === "search")
    view = screens.searchScreen(
      searchRows(screen.query),
      screen.query,
      note,
      primaryIsPreview() ? "Preview Page" : "Open in Notion",
    );
  else if (screen?.kind === "database") {
    if (dbPages(screen.id, screen.sort, screen.query))
      view = screens.databaseScreen(
        screen.name,
        databaseRows(screen),
        screen.query,
        screen.sort,
        note,
        primaryIsPreview() ? "Preview Page" : "Open in Notion",
      );
  } else if (screen?.kind === "page") {
    const page = pages()[screen.id];
    if (page)
      view = screens.pageScreen(
        page,
        nt.cached<string>(`md-${screen.id}`) ?? "*Loading…*",
        users(),
        screen.meta,
        note,
      );
  } else if (screen?.kind === "create") {
    const databases = nt.cached<Page[]>("databases") ?? [];
    const props = dbProps(screen.database);
    if (databases.length)
      view = screens.createScreen(
        databases,
        screen.database,
        screens.fieldSpecs(props),
        screen.multi,
        multiOptions(props),
        { title: screen.title, content: screen.content },
        bool("close_after_create", false),
      );
  } else if (screen?.kind === "capture")
    view = screens.captureScreen(pickerPages(screen), screen.url, "url", lastTarget());
  else if (screen?.kind === "text")
    view = screens.addTextScreen(
      pickerPages(screen),
      screen.text,
      screen.target ?? lastTarget(),
      screen.heading,
    );
  else if (screen?.kind === "note")
    view = screens.noteScreen(
      pickerPages(screen),
      screen.text,
      `${notesRoot()} › ${noteDate()}`,
      notesRoot(),
      readJson(listFile("note-parent"), ""),
    );
  return update({ root: { components: view.components, shortcuts: view.shortcuts } }, true);
};

const push = (s: State, screen: Screen, note = ""): Action => {
  s.stack.push(screen);
  return render(s, note);
};

// ---- Network ----

const connectClient = async (): Promise<string | undefined> => {
  const token = await nt.readToken();
  if (token && token !== nt.DEMO) nt.connect(token);
  return token;
};

/** Fetches what the screen on top needs and caches it. */
const fetchFor = async (s: State): Promise<void> => {
  const screen = top(s);
  if (!screen || screen.kind === "connect") return;
  if (!nt.cached<User[]>("users")) nt.store("users", await nt.users());
  if (screen.kind === "search") {
    const found = await nt.search(screen.query);
    remember(found);
    nt.store(`search-${screen.query.toLowerCase()}`, found);
    await nt.downloadPictures(found.map((p) => p.iconUrl));
  } else if (screen.kind === "database") {
    const [props, list] = await Promise.all([
      nt.databaseProperties(screen.id),
      nt.queryDatabase(screen.id, screen.query, screen.sort),
    ]);
    remember(list);
    nt.store(`props-${screen.id}`, props);
    nt.store(`db-${screen.id}-${screen.sort}-${screen.query.toLowerCase()}`, list);
  } else if (screen.kind === "page") {
    nt.store(`md-${screen.id}`, await nt.pageMarkdown(screen.id));
  } else if (screen.kind === "create") {
    const databases = await nt.databases();
    remember(databases);
    nt.store("databases", databases);
    if (!databases.some((d) => d.id === screen.database)) screen.database = databases[0]?.id ?? "";
    if (screen.database) {
      const props = await nt.databaseProperties(screen.database);
      nt.store(`props-${screen.database}`, props);
      for (const p of props.filter((q) => q.type === "relation" && q.relation))
        nt.store(
          `relation-${p.relation}`,
          await nt.queryDatabase(p.relation as string, "", "last_edited_time").catch(() => []),
        );
    }
  } else {
    const query = s.pickerQuery ?? "";
    const found = await nt.search(query, 50);
    remember(found);
    nt.store(`search-${query.toLowerCase()}`, found);
  }
};

/** Background refresh; drops its answer when another action happened meanwhile. */
const refresh = async (s: State, done = ""): Promise<Action> => {
  const ticket = Date.now();
  s.token = ticket;
  saveState(s);
  const token = await connectClient();
  if (!token) {
    if (top(s)?.kind !== "connect") s.stack.push({ kind: "connect" });
    saveState(s);
    return render(s);
  }
  if (token !== nt.DEMO)
    try {
      await fetchFor(s);
    } catch (error) {
      const latest = loadState();
      if (latest.token !== ticket) return {};
      if (nt.isUnauthorized(error)) {
        latest.stack.push({ kind: "connect", message: nt.describeError(error) });
        saveState(latest);
        return render(latest);
      }
      return failure(nt.describeError(error));
    }
  const latest = loadState();
  if (latest.token !== ticket) return {};
  // The fetch may have chosen the first database for an empty Create form.
  const screen = top(latest);
  const fetched = top(s);
  if (screen?.kind === "create" && fetched?.kind === "create") screen.database = fetched.database;
  saveState(latest);
  return render(latest, done);
};

// ---- Actions on a page ----

const browserUrl = (page: Page) => page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`;
/** The Notion app when it is installed and chosen in Configuration, the browser otherwise. */
const appUrl = (page: Page) =>
  str("open_in", "app") === "app" && existsSync("/Applications/Notion.app")
    ? browserUrl(page).replace(/^https:\/\//, "notion://")
    : browserUrl(page);

const item = (text: string, action: Json | Json[], hint = "") => ({
  text: hint ? `${text}   ${hint}` : text,
  action,
});

const pageMenu = (s: State, page: Page): Json[] => {
  const screen = top(s);
  const isPinned = pinned().some((p) => p.id === page.id);
  const uid = `p-${page.id}`;
  const word = page.object === "page" ? "Page" : "Database";
  const props = screen?.kind === "database" ? dbProps(screen.id) : [];
  const editable = props.filter((p) =>
    ["checkbox", "select", "status", "multi_select", "people"].includes(p.type),
  );
  const editMenu = editable.map((prop) => {
    const value = page.properties.find((p) => p.id === prop.id);
    if (prop.type === "checkbox") {
      const checked = value?.type === "checkbox" && value.checked;
      return {
        text: `${prop.name}: ${checked ? "Uncheck" : "Check"}`,
        action: run("set-prop", [page.id, prop.id, checked ? "0" : "1"], true),
      };
    }
    const options =
      prop.type === "people"
        ? users().map((u) => ({ id: u.id, name: u.name }))
        : (prop.options ?? []).map((o) => ({ id: o.id, name: o.name }));
    const current =
      value && "option" in value
        ? [value.option?.id]
        : value && "options" in value
          ? value.options.map((o) => o.id)
          : value && "ids" in value
            ? value.ids
            : [];
    return {
      text: prop.name,
      submenu: options.map((o) => ({
        text: o.name,
        state: current.includes(o.id) ? "on" : "off",
        action: run("set-prop", [page.id, prop.id, o.id], true),
      })),
    };
  });
  const view = screen?.kind === "database" ? viewOf(screen.id, props) : undefined;
  return [
    page.object === "page"
      ? item("Preview Page", run("preview", [uid]), primaryIsPreview() ? "↩" : "")
      : item("Navigate to Database", run("primary", [uid]), "↩"),
    item("Open in Notion", run("open-app", [uid]), primaryIsPreview() ? "⌘O" : "↩"),
    item("Open in Browser", run("open-browser", [uid])),
    separator,
    ...(editMenu.length ? [{ text: "Edit Property", submenu: editMenu }] : []),
    page.object === "page"
      ? item("Append Content to Page", run("append", [uid]), "⇧⌘N")
      : item("Create New Page", run("new-page", [uid]), "⌘N"),
    ...(screen?.kind === "database"
      ? [item("Create New Page in This Database", run("new-page", [`d-${screen.id}`]), "⌘N")]
      : []),
    item(isPinned ? "Unpin Page" : "Pin Page", run("pin", [uid]), "⇧⌘P"),
    ...(view
      ? [
          separator,
          {
            text: "View Type",
            submenu: (["list", "kanban"] as const).map((type) => ({
              text: type === "list" ? "List" : "Kanban (by status)",
              state: view.type === type ? "on" : "off",
              action: run("view-type", [type]),
            })),
          },
          {
            text: "Visible Properties",
            submenu: props
              .filter((p) => p.type !== "title")
              .map((p) => ({
                text: p.name,
                state: view.visible.includes(p.id) ? "on" : "off",
                action: run("view-prop", [p.id]),
              })),
          },
        ]
      : []),
    separator,
    item(`Copy ${word} URL`, run("copy", [uid, "url"]), "⇧⌘C"),
    item("Copy Formatted URL", run("copy", [uid, "markdown"]), "⇧⌘."),
    item(`Copy ${word} Title`, run("copy", [uid, "title"]), "⇧⌘,"),
    separator,
    ...(screen?.kind === "page"
      ? [item(screen.meta ? "Hide Metadata" : "Show Metadata", run("toggle-meta"), "⇧⌘M")]
      : []),
    item(`Delete ${word}…`, run("delete", [uid]), "⌃X"),
    separator,
    item("Refresh Results", run("refresh", [], true), "⌘R"),
    item("Manage Notion Connection", run("connection")),
  ];
};

// ---- Commands ----

const clipboard = (): string => {
  try {
    return execFileSync("/usr/bin/pbpaste", { encoding: "utf8", timeout: 1000 }).trim();
  } catch {
    return "";
  }
};

/** A typed form value for a property, or an Error to show. */
export const valueFor = (prop: DbProp, raw: string, multi: string[]): FormValue | Error => {
  if (prop.type === "checkbox") return yes(raw);
  if (["multi_select", "people", "relation"].includes(prop.type)) return multi;
  if (prop.type === "date") {
    if (!raw.trim()) return undefined;
    const date = parseWhen(raw);
    return date ? { date, allDay: isAllDay(raw) } : new Error(`Couldn't read the date in “${prop.name}”`);
  }
  if (prop.type === "number" && raw.trim() && !Number.isFinite(Number(raw)))
    return new Error(`“${prop.name}” must be a number`);
  return raw.trim();
};

const demo = async () => (await connectClient()) === nt.DEMO;

const commands: Record<string, (s: State) => Action | Promise<Action>> = {
  launch: async (s) => {
    const mode = process.env.nt_mode ?? "search";
    const query = (args[0] ?? "").trim();
    s.pickerQuery = "";
    const clip = mode === "capture" || mode === "create" ? clipboard() : "";
    const use = str("use_clipboard", "");
    const first: Screen =
      mode === "create"
        ? {
            kind: "create",
            database: readJson(listFile("last-database"), ""),
            multi: {},
            title: query || (use === "title" ? clip.split("\n")[0] : undefined),
            content: use === "content" ? clip : undefined,
          }
        : mode === "capture"
          ? { kind: "capture", url: nt.isUrl(query) ? query : nt.isUrl(clip) ? clip : "" }
          : mode === "note"
            ? { kind: "note", text: query }
            : mode === "text"
              ? { kind: "text", text: query }
              : mode === "connect"
                ? { kind: "connect" }
                : { kind: "search", query };
    s.stack = [first];
    if (mode !== "connect" && !(await nt.readToken())) s.stack.push({ kind: "connect" });
    return render(s, "Refreshing…");
  },

  /** Async after launch, and ⌘R. */
  load: (s) => refresh(s),
  refresh: (s) => refresh(s, "Refreshed"),

  back: (s) => {
    s.stack.pop();
    if (!s.stack.length) return { finish: { variables: { nt_out: "back" } } };
    return render(s);
  },

  /** Async: search as you type, updating only the rows so the field keeps its cursor. */
  search: async (s) => {
    const screen = top(s);
    if (screen?.kind !== "search") return {};
    screen.query = args[0] ?? "";
    const ticket = Date.now();
    s.token = ticket;
    saveState(s);
    if (!(await demo()))
      try {
        await fetchFor(s);
      } catch (error) {
        return failure(nt.describeError(error));
      }
    if (loadState().token !== ticket) return {};
    const rows = searchRows(screen.query);
    return update({ list: { data: { src: rows }, select: firstPage(rows) }, statusLabel: { text: "" } });
  },

  "db-search": async (s) => {
    const screen = top(s);
    if (screen?.kind !== "database") return {};
    screen.query = args[0] ?? "";
    const ticket = Date.now();
    s.token = ticket;
    saveState(s);
    if (!(await demo()))
      try {
        await fetchFor(s);
      } catch (error) {
        return failure(nt.describeError(error));
      }
    if (loadState().token !== ticket) return {};
    const rows = databaseRows(screen);
    return update({ list: { data: { src: rows }, select: firstPage(rows) } });
  },

  "db-sort": (s) => {
    const screen = top(s);
    if (screen?.kind !== "database") return {};
    screen.sort = args[0] === "created_time" ? "created_time" : "last_edited_time";
    return refresh(s);
  },

  primary: (s) => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    addRecent(page);
    if (page.object === "database")
      return push(s, {
        kind: "database",
        id: page.id,
        name: page.title,
        query: "",
        sort: "last_edited_time",
      });
    if (primaryIsPreview()) return push(s, { kind: "page", id: page.id, meta: true });
    return { open: { type: "url", src: appUrl(page) } };
  },

  preview: (s) => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    addRecent(page);
    return push(s, { kind: "page", id: page.id, meta: true });
  },

  "open-app": () => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    addRecent(page);
    return { open: { type: "url", src: appUrl(page) } };
  },
  "open-browser": () => {
    const page = pageOf(args[0] ?? "");
    return page ? { open: { type: "url", src: browserUrl(page) } } : {};
  },

  menu: (s) => {
    const screen = top(s);
    const page = pageOf(args[0] ?? "") ?? (screen?.kind === "page" ? pages()[screen.id] : undefined);
    if (page && (screen?.kind === "search" || screen?.kind === "database" || screen?.kind === "page"))
      return popup("actionsButton", pageMenu(s, page));
    if (screen?.kind === "connect")
      return popup("actionsButton", [
        item("Test Connection", run("test-connection", [], true)),
        item("Open notion.so/my-integrations", {
          type: "json",
          src: { open: { type: "url", src: "https://www.notion.so/my-integrations" } },
        }),
        separator,
        item("Disconnect Notion…", run("disconnect")),
      ]);
    return popup("actionsButton", [
      item("Refresh", run("refresh", [], true), "⌘R"),
      item("Manage Notion Connection", run("connection")),
    ]);
  },

  copy: () => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    const url = browserUrl(page);
    const text = args[1] === "title" ? page.title : args[1] === "markdown" ? `[${page.title}](${url})` : url;
    return merge({ copy: { type: "text", src: text } }, status("Copied"));
  },

  pin: (s) => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    const list = pinned();
    const isPinned = list.some((p) => p.id === page.id);
    writeJson(listFile("pinned"), isPinned ? list.filter((p) => p.id !== page.id) : [page, ...list]);
    return render(s, isPinned ? "Unpinned" : "Pinned");
  },

  append: (s) => {
    const page = pageOf(args[0] ?? "");
    if (!page || page.object !== "page") return {};
    return push(s, { kind: "text", text: "", target: page.id, heading: `Append to ${page.title}` });
  },

  "new-page": (s) => {
    const uid = args[0] ?? "";
    const screen = top(s);
    const database = uid.startsWith("d-")
      ? uid.slice(2)
      : pageOf(uid)?.object === "database"
        ? uid.slice(2)
        : screen?.kind === "database"
          ? screen.id
          : "";
    if (!database) return failure("Select a database first");
    return push(s, { kind: "create", database, multi: {} });
  },

  "toggle-meta": (s) => {
    const screen = top(s);
    if (screen?.kind !== "page") return {};
    screen.meta = !screen.meta;
    return render(s);
  },

  "view-type": (s) => {
    const screen = top(s);
    if (screen?.kind !== "database") return {};
    saveView(screen.id, {
      ...viewOf(screen.id, dbProps(screen.id)),
      type: args[0] === "kanban" ? "kanban" : "list",
    });
    return render(s);
  },
  "view-prop": (s) => {
    const screen = top(s);
    if (screen?.kind !== "database") return {};
    const view = viewOf(screen.id, dbProps(screen.id));
    const id = args[0] ?? "";
    saveView(screen.id, {
      ...view,
      visible: view.visible.includes(id) ? view.visible.filter((v) => v !== id) : [...view.visible, id],
    });
    return update({ list: { data: { src: databaseRows(screen) } } });
  },

  /** Quick edit from the Actions menu: checkbox, select, status (set), multi-select and people (toggle). */
  "set-prop": async (s) => {
    const [pageId = "", propId = "", value = ""] = args;
    const screen = top(s);
    const prop = (screen?.kind === "database" ? dbProps(screen.id) : []).find((p) => p.id === propId);
    const page = pages()[pageId];
    if (!prop || !page) return {};
    const current = page.properties.find((p) => p.id === propId);
    let next: FormValue = value;
    if (prop.type === "checkbox") next = value === "1";
    if (prop.type === "select" || prop.type === "status")
      next = current && "option" in current && current.option?.id === value ? undefined : value;
    if (prop.type === "multi_select" || prop.type === "people") {
      const ids =
        current && "options" in current
          ? current.options.map((o) => o.id)
          : current && "ids" in current
            ? current.ids
            : [];
      next = ids.includes(value) ? ids.filter((id) => id !== value) : [...ids, value];
    }
    if (await demo()) return status("Demo mode: nothing was changed");
    try {
      remember([await nt.setProperty(pageId, propId, prop.type, next)]);
    } catch (error) {
      return failure(nt.describeError(error));
    }
    return refresh(s, `Updated ${prop.name}`);
  },

  delete: () => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    const word = page.object === "page" ? "page" : "database";
    return sheet("deleteSheet", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 22,
      spacing: 10,
      components: [
        { type: "label", text: `Delete “${page.title}”?`, font: { size: 15, weight: "semibold" } },
        {
          type: "label",
          text: `The ${word} moves to Notion's trash, where it can be restored for 30 days.`,
          colour: "secondaryLabelColor",
          linebreak: "wordwrap",
          constraints: { size: { width: 340 } },
        },
        {
          type: "button",
          text: `Delete ${word}  ⌘↩`,
          shortcut: "⌘↩",
          constraints: { region: "bottom" },
          events: [
            {
              triggers: "actioned",
              action: [
                { type: "json", src: { sheet: { close: "deleteSheet" } } },
                run("delete-confirm", [`p-${page.id}`], true),
              ],
            },
          ],
        },
      ],
    });
  },
  "delete-confirm": async (s) => {
    const page = pageOf(args[0] ?? "");
    if (!page) return {};
    if (await demo()) return status("Demo mode: nothing was deleted");
    try {
      await nt.trash(page);
    } catch (error) {
      return failure(nt.describeError(error));
    }
    writeJson(
      listFile("pinned"),
      pinned().filter((p) => p.id !== page.id),
    );
    writeJson(
      listFile("recent"),
      recent().filter((p) => p.id !== page.id),
    );
    return refresh(s, `Moved “${page.title}” to Notion's trash`);
  },

  // ---- Forms ----

  "pick-database": (s) => {
    const screen = top(s);
    if (screen?.kind !== "create" || screen.database === args[0]) return {};
    screen.database = args[0] ?? "";
    screen.multi = {};
    saveState(s);
    return refresh(s);
  },

  "multi-menu": (s) => {
    const screen = top(s);
    if (screen?.kind !== "create") return {};
    const propId = args[0] ?? "";
    const props = dbProps(screen.database);
    const prop = props.find((p) => p.id === propId);
    const field = screens.fieldSpecs(props).find((f) => f.prop.id === propId)?.field;
    if (!prop || !field) return {};
    const options = multiOptions([prop])[propId] ?? [];
    if (!options.length)
      return status(
        prop.type === "people"
          ? "No people listed: the integration needs “Read user information”."
          : "Nothing to choose from",
      );
    return popup(
      field,
      options.map((o) => ({
        text: o.name,
        state: (screen.multi[propId] ?? []).includes(o.id) ? "on" : "off",
        action: run("multi-toggle", [propId, o.id]),
      })),
    );
  },
  "multi-toggle": (s) => {
    const screen = top(s);
    if (screen?.kind !== "create") return {};
    const [propId = "", id = ""] = args;
    const chosen = screen.multi[propId] ?? [];
    screen.multi[propId] = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    const props = dbProps(screen.database);
    const field = screens.fieldSpecs(props).find((f) => f.prop.id === propId)?.field;
    if (!field) return {};
    return update(
      { [field]: { text: screens.multiText(multiOptions(props)[propId] ?? [], screen.multi[propId] ?? []) } },
      true,
    );
  },

  "create-submit": async (s) => {
    const screen = top(s);
    if (screen?.kind !== "create") return {};
    const [database = "", ...rest] = args;
    const specs = screens.fieldSpecs(dbProps(database));
    const content = rest[specs.length] ?? "";
    const divider = yes(rest[specs.length + 1]);
    const values: { id: string; type: string; value: FormValue }[] = [];
    for (const [i, spec] of specs.entries()) {
      const value = valueFor(spec.prop, rest[i] ?? "", screen.multi[spec.prop.id] ?? []);
      if (value instanceof Error) return failure(value.message);
      values.push({ id: spec.prop.id, type: spec.prop.type, value });
    }
    if (await demo()) return status("Demo mode: nothing was created");
    try {
      const created = await nt.createDatabasePage(database, values, content, divider);
      remember([created]);
      writeJson(listFile("last-database"), database);
      if (bool("close_after_create", false)) return { finish: {} };
      const latest = loadState();
      if (latest.stack.length > 1) {
        latest.stack.pop();
        return refresh(latest, `Created “${created.title}”`);
      }
      // Opened from the keyword: a fresh form for the next page.
      latest.stack = [{ kind: "create", database, multi: {} }];
      saveState(latest);
      return merge(render(latest), status(`Created “${created.title}”`, "systemGreenColor"));
    } catch (error) {
      return failure(`Couldn't create the page: ${nt.describeError(error)}`);
    }
  },

  /** Async: refreshes a page picker from what is typed above it. */
  "page-search": async (s) => {
    const screen = top(s);
    if (!screen || !["capture", "text", "note"].includes(screen.kind)) return {};
    s.pickerQuery = args[0] ?? "";
    saveState(s);
    if (!(await demo()))
      try {
        await fetchFor(s);
      } catch (error) {
        return failure(nt.describeError(error));
      }
    const items = screens.pageItems(pickerPages(screen, s.pickerQuery));
    const all =
      screen.kind === "note"
        ? [{ text: `None — “${notesRoot()}” already exists`, value: "" }, ...items]
        : items;
    return update(
      {
        target: {
          items: all.length ? all : [{ text: "Nothing found", value: "" }],
          selected: all[0]?.value ?? "",
        },
      },
      true,
    );
  },

  "capture-submit": async () => {
    const [url = "", as = "url", divider = "", target = ""] = args.map((a) => a.trim());
    if (!nt.isUrl(url)) return failure("Enter a valid URL");
    const page = pages()[target];
    if (!page) return failure("Choose a Notion page or database");
    if (await demo()) return status("Demo mode: nothing was captured");
    try {
      const detail = as === "url" ? undefined : await nt.readWebPage(url);
      const content = nt.captureContent(url, as, detail);
      if (page.object === "page") await nt.appendToPage(page.id, content, { dateDivider: yes(divider) });
      else {
        const titleProp = (await nt.databaseProperties(page.id)).find((p) => p.type === "title");
        await nt.createDatabasePage(
          page.id,
          titleProp ? [{ id: titleProp.id, type: "title", value: detail?.title ?? url }] : [],
          typeof content === "string" ? content : `[${url}](${url})`,
          yes(divider),
        );
      }
      writeJson(listFile("last-target"), page.id);
      return merge(status(`Captured to “${page.title}”`, "systemGreenColor"), update({ url: { text: "" } }));
    } catch (error) {
      return failure(`Couldn't capture: ${nt.describeError(error)}`);
    }
  },

  "text-submit": async (s) => {
    const [target = "", content = "", prepend = "", divider = ""] = args;
    const page = pages()[target];
    if (!page) return failure("Choose a Notion page");
    if (!content.trim()) return failure("Write something first");
    if (await demo()) return status("Demo mode: nothing was added");
    try {
      await nt.appendToPage(page.id, content, { prepend: yes(prepend), dateDivider: yes(divider) });
      writeJson(listFile("last-target"), page.id);
      const screen = top(s);
      if (screen?.kind === "text" && screen.heading && s.stack.length > 1) {
        s.stack.pop();
        return render(s, `Added to “${page.title}”`);
      }
      return merge(status(`Added to “${page.title}”`, "systemGreenColor"), update({ content: { text: "" } }));
    } catch (error) {
      return failure(`Couldn't add the text: ${nt.describeError(error)}`);
    }
  },

  "note-submit": async () => {
    const [content = "", parent = ""] = args;
    if (!content.trim()) return failure("Write your note first");
    if (await demo()) return status("Demo mode: nothing was added");
    try {
      await nt.addNote(
        content.trim(),
        notesRoot(),
        noteDate(),
        str("note_style", "bulleted"),
        parent || undefined,
      );
      if (parent) writeJson(listFile("note-parent"), parent);
      return merge(
        status(`Note added to ${notesRoot()} › ${noteDate()}`, "systemGreenColor"),
        update({ content: { text: "" } }),
      );
    } catch (error) {
      return failure(
        error instanceof nt.MissingNotesRoot
          ? error.message
          : `Couldn't save the note: ${nt.describeError(error)}`,
      );
    }
  },

  // ---- Connection ----

  connection: (s) => push(s, { kind: "connect" }),

  /** The secret arrives in the environment (`nt_key`), never as an argument. */
  "connect-save": async (s) => {
    const key = (process.env.nt_key ?? "").trim();
    if (!key) return failure("Paste your integration secret first");
    try {
      nt.connect(key);
      nt.store("workspace", await nt.whoAmI());
    } catch (error) {
      return failure(nt.isUnauthorized(error) ? "Notion rejected this secret" : nt.describeError(error));
    }
    await nt.saveToken(key);
    nt.store("users", null);
    s.stack = s.stack.filter((screen) => screen.kind !== "connect");
    if (!s.stack.length) s.stack.push({ kind: "search", query: "" });
    return refresh(s, `Connected to ${nt.cached<string>("workspace")}`);
  },

  "test-connection": async () => {
    const token = await connectClient();
    if (!token) return failure("No integration secret saved");
    if (token === nt.DEMO) return status("Demo mode");
    try {
      const name = await nt.whoAmI();
      nt.store("workspace", name);
      return merge(
        status(`Connected to ${name}`, "systemGreenColor"),
        update({ connState: { text: `Connected to ${name}`, colour: "systemGreenColor" } }),
      );
    } catch (error) {
      return failure(nt.describeError(error));
    }
  },

  disconnect: async (s) => {
    await nt.deleteToken();
    rmSync(cacheDir(), { recursive: true, force: true });
    s.stack = [{ kind: "connect", message: "Disconnected. The secret was removed from your Keychain." }];
    return render(s);
  },

  post: () => {
    if (process.env.nt_out === "back")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application id "com.runningwithcrayons.Alfred" to search ""'],
        { timeout: 5000 },
      );
    return {};
  },
};

/** These save their own state (they run in the background and re-read it). */
const SELF_SAVING = [
  "post",
  "load",
  "refresh",
  "search",
  "db-search",
  "db-sort",
  "set-prop",
  "delete-confirm",
  "create-submit",
  "page-search",
  "connect-save",
  "pick-database",
];

const emit = (action: Action) =>
  new Promise<void>((resolve) => process.stdout.write(JSON.stringify(action), () => resolve()));

const main = async (): Promise<void> => {
  const handler = commands[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);
  const s = loadState();
  const action = await handler(s);
  if (!SELF_SAVING.includes(command)) saveState(s);
  await emit(action);
};

if (command)
  main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      return emit(update({ statusLabel: { text: message, colour: "systemRedColor" } }));
    })
    .finally(() => process.exit(0));
