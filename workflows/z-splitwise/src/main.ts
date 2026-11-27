// `sw <command> [args…]`: one JSON action on stdout per run.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { profileCommand } from "../../../shared/ui-profile.ts";
import * as api from "./api.ts";
import type { Category, Expense, Friend, Group, User } from "./api.ts";
import { cacheDir, readJson, str, writeJson } from "./env.ts";
import { longDate, money, parseWhen } from "./format.ts";
import * as screens from "./screens.ts";
import { type Json, run } from "./screens.ts";
import { type Action, merge, popup, separator, sheet, update } from "./ui.ts";

await profileCommand(() => import("./env.ts"));

type Target = { type: "friend" | "group"; id: number; name: string };
type Screen =
  | { kind: "people"; query?: string }
  | { kind: "add"; target: Target }
  | { kind: "expenses"; query?: string; selected?: string }
  | { kind: "edit"; id: number; owes: number[] }
  | { kind: "connect"; message?: string };
type State = { stack: Screen[]; token: number };

const [command = "", ...args] = process.argv.slice(2);
const statePath = () => join(cacheDir(), "state.json");
const loadState = (): State => readJson<State>(statePath(), { stack: [], token: 0 });
const saveState = (s: State) => writeJson(statePath(), s);
const top = (s: State): Screen | undefined => s.stack.at(-1);

const limit = () => {
  const n = Number(str("loading_limit", "250"));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 250;
};

type Data = { user?: User; friends: Friend[]; groups: Group[]; expenses: Expense[]; categories: Category[] };
const data = (): Data => ({
  user: api.cached<User>("user"),
  friends: api.cached<Friend[]>("friends") ?? [],
  groups: api.cached<Group[]>("groups") ?? [],
  expenses: api.cached<Expense[]>("expenses") ?? [],
  categories: api.cached<Category[]>("categories") ?? [],
});

const status = (text: string, colour = "secondaryLabelColor"): Action =>
  update({ statusLabel: { text, colour } }, true);
const failure = (text: string): Action => merge(status(text, "systemRedColor"), { sound: { src: "Basso" } });

const idOf = (uid: string, prefix: string) =>
  uid.startsWith(`${prefix}-`) ? Number(uid.slice(2)) : undefined;
const expenseById = (id: number | undefined) => data().expenses.find((e) => e.id === id);

/** Everyone who can pay or owe: you, your friends and the people already on the expense. */
const peopleFor = (expense: Expense | undefined): screens.Person[] => {
  const d = data();
  const all = [
    ...(d.user ? [{ id: d.user.id, name: api.fullName(d.user) }] : []),
    ...d.friends.map((f) => ({ id: f.id, name: api.fullName(f) })),
    ...(expense?.users.map((u) => ({ id: u.user.id, name: api.fullName(u.user) })) ?? []),
  ];
  return all.filter((p, i) => all.findIndex((q) => q.id === p.id) === i);
};

/** The whole window for the screen on top of the stack. */
const render = (s: State, note = ""): Action => {
  const screen = top(s);
  const d = data();
  let view: { components: Json[]; shortcuts: Json[] };
  if (!screen) view = screens.loadingScreen("");
  else if (screen.kind === "connect") view = screens.connectScreen(screen.message ?? note);
  else if (screen.kind === "people")
    view =
      d.friends.length || d.groups.length
        ? screens.peopleScreen(screens.peopleRows(d.friends, d.groups), screen.query ?? "", note)
        : screens.loadingScreen(note || "Loading friends and groups…");
  else if (screen.kind === "add") view = screens.addScreen(screen.target, d.user, d.categories);
  else if (screen.kind === "expenses") {
    const rows = screens.expenseRows(d.expenses, d.user?.id);
    const selected =
      screen.selected && rows.some((r) => r.uid === screen.selected)
        ? screen.selected
        : String(rows[0]?.uid ?? "");
    screen.selected = selected;
    view = d.expenses.length
      ? screens.expensesScreen(
          rows,
          selected,
          screens.detailView(expenseById(idOf(selected, "e")), d.user?.id, d.groups),
          screen.query ?? "",
          note,
        )
      : screens.loadingScreen(note || "Loading expenses…");
  } else {
    const expense = expenseById(screen.id);
    const paid = expense?.users.find((u) => Number(u.paid_share) > 0)?.user.id ?? d.user?.id ?? 0;
    view = expense
      ? screens.editScreen(expense, peopleFor(expense), paid, screen.owes)
      : screens.loadingScreen("That expense is no longer available.");
  }
  return update({ root: { components: view.components, shortcuts: view.shortcuts } }, true);
};

const push = (s: State, screen: Screen, note = ""): Action => {
  s.stack.push(screen);
  return render(s, note);
};

/** Fetches what the screen on top needs and caches it. */
const fetchFor = async (screen: Screen | undefined, token: string): Promise<void> => {
  if (!screen || screen.kind === "connect" || token === api.DEMO) return;
  api.store("user", await api.currentUser(token));
  if (screen.kind === "people" || screen.kind === "add") {
    const [friends, groups, categories] = await Promise.all([
      api.friends(token),
      api.groups(token),
      api.categories(token).catch(() => data().categories),
    ]);
    api.store("friends", friends);
    api.store("groups", groups);
    api.store("categories", categories);
    await api.downloadPictures([
      ...friends.map((f) => f.picture.small),
      ...groups.map((g) => g.avatar.small),
    ]);
  } else {
    const [expenses, groups, friends] = await Promise.all([
      api.expenses(token, limit()),
      api.groups(token),
      api.friends(token).catch(() => data().friends),
    ]);
    api.store("expenses", expenses);
    api.store("groups", groups);
    api.store("friends", friends);
  }
};

/** Background refresh; drops its answer when another action happened meanwhile. */
const refresh = async (s: State, done = ""): Promise<Action> => {
  const ticket = Date.now();
  s.token = ticket;
  const token = await api.readToken();
  if (!token) {
    if (top(s)?.kind !== "connect") s.stack.push({ kind: "connect" });
    saveState(s);
    return render(s);
  }
  saveState(s);
  try {
    await fetchFor(top(s), token);
  } catch (error) {
    const latest = loadState();
    if (latest.token !== ticket) return {};
    if (error instanceof api.AuthError) {
      latest.stack.push({
        kind: "connect",
        message: "Splitwise rejected the saved API key. Paste a new one.",
      });
      saveState(latest);
      return render(latest);
    }
    return failure(error instanceof Error ? error.message : String(error));
  }
  const latest = loadState();
  if (latest.token !== ticket) return {};
  const action = render(latest, done);
  saveState(latest);
  return action;
};

const browserUrl = (uid: string, screen: Screen | undefined): string | undefined => {
  if (uid.startsWith("f-")) return `https://secure.splitwise.com/#/friends/${uid.slice(2)}`;
  if (uid.startsWith("g-")) return `https://secure.splitwise.com/#/groups/${uid.slice(2)}`;
  if (uid.startsWith("e-")) return `https://secure.splitwise.com/#/all/expenses/${uid.slice(2)}`;
  if (screen?.kind === "add")
    return `https://secure.splitwise.com/#/${screen.target.type === "friend" ? "friends" : "groups"}/${screen.target.id}`;
  if (screen?.kind === "edit") return `https://secure.splitwise.com/#/all/expenses/${screen.id}`;
  return undefined;
};

const item = (text: string, action: Json | Json[], hint = "") => ({
  text: hint ? `${text}   ${hint}` : text,
  action,
});
const APPS = "https://secure.splitwise.com/apps";

const commands: Record<string, (s: State) => Action | Promise<Action>> = {
  launch: async (s) => {
    const mode = process.env.sw_mode === "list" ? "expenses" : "people";
    const query = (args[0] ?? "").trim();
    s.stack = [mode === "expenses" ? { kind: "expenses", query } : { kind: "people", query }];
    if (!(await api.readToken())) s.stack.push({ kind: "connect" });
    return render(s, "Refreshing…");
  },

  /** Async after launch, and ⌘R. */
  load: (s) => refresh(s),
  reload: (s) => refresh(s, "Reloaded"),

  back: (s) => {
    s.stack.pop();
    if (!s.stack.length || top(s)?.kind === "connect") return { finish: { variables: { sw_out: "back" } } };
    return render(s);
  },

  open: (s) => {
    const d = data();
    // ↩ on a section heading opens the first person under it.
    let uid = args[0] ?? "";
    if (uid.startsWith("h-")) {
      const rows = screens.peopleRows(d.friends, d.groups);
      const at = rows.findIndex((r) => r.uid === uid);
      uid = String(rows.slice(at + 1).find((r) => !String(r.uid).startsWith("h-"))?.uid ?? "");
    }
    const friend = d.friends.find((f) => f.id === idOf(uid, "f"));
    const group = d.groups.find((g) => g.id === idOf(uid, "g"));
    if (friend)
      return push(s, { kind: "add", target: { type: "friend", id: friend.id, name: api.fullName(friend) } });
    if (group) return push(s, { kind: "add", target: { type: "group", id: group.id, name: group.name } });
    return {};
  },

  browser: (s) => {
    const url = browserUrl(args[0] ?? "", top(s));
    return url ? { open: { type: "url", src: url } } : {};
  },

  menu: (s) => {
    const screen = top(s);
    const uid = args[0] ?? "";
    const disconnect = item("Disconnect Splitwise…", run("disconnect"));
    if (screen?.kind === "people")
      return popup("actionsButton", [
        item("Add Expense", run("open", [uid]), "↩"),
        item("Reload", run("reload", [], true), "⌘R"),
        item("Open in Browser", run("browser", [uid]), "⌘O"),
        separator,
        disconnect,
      ]);
    if (screen?.kind === "expenses") {
      const expense = expenseById(idOf(uid, "e"));
      return popup("actionsButton", [
        item("Open Expense in Splitwise", run("browser", [uid]), "↩"),
        ...(expense && api.isEditable(expense) ? [item("Change Values", run("edit", [uid]), "⌘E")] : []),
        ...(expense?.receipt.original ? [item("View Receipt", run("receipt", [uid]), "⌘Y")] : []),
        separator,
        item("Reload", run("reload", [], true), "⌘R"),
        ...(expense ? [item("Delete Expense…", run("delete", [uid]), "⌃X")] : []),
        separator,
        disconnect,
      ]);
    }
    if (screen?.kind === "add" || screen?.kind === "edit")
      return popup("actionsButton", [item("Open in Browser", run("browser", [""]))]);
    return popup("actionsButton", [
      item("Open secure.splitwise.com/apps", { type: "json", src: { open: { type: "url", src: APPS } } }),
    ]);
  },

  "date-hint": () => {
    const date = parseWhen(args[0] ?? "");
    return update({
      dateHint: date
        ? { text: longDate(date), colour: "secondaryLabelColor" }
        : {
            text: "Couldn't read this date. Try 2026-01-04 12:00, today or yesterday 18:30.",
            colour: "systemRedColor",
          },
    });
  },

  "add-submit": async (s) => {
    const screen = top(s);
    if (screen?.kind !== "add") return {};
    const [description = "", category = "", when = "", currency = "", cost = ""] = args.map((a) => a.trim());
    const date = parseWhen(when);
    if (!description) return failure("Description is required");
    if (!date) return failure("Couldn't read the date");
    if (!api.validCost(cost)) return failure("Cost: a number with at most 2 decimals, e.g. 10.00");
    const token = await api.readToken();
    const me = data().user?.id;
    if (!token || !me) return failure("Not connected to Splitwise");
    try {
      const expense = await api.createExpense(token, {
        description,
        date: date.toISOString(),
        cost: Number(cost).toFixed(2),
        currency_code: currency,
        ...(category && { category_id: Number(category) }),
        ...(screen.target.type === "friend"
          ? api.friendSplit(cost, me, screen.target.id)
          : { group_id: screen.target.id, split_equally: true }),
      });
      const latest = loadState();
      latest.stack.pop();
      return refresh(
        latest,
        `Added “${expense.description}” worth ${money(expense.cost, expense.currency_code)}`,
      );
    } catch (error) {
      return failure(`Couldn't add the expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  select: (s) => {
    const screen = top(s);
    const uid = args[0] ?? "";
    if (screen?.kind !== "expenses" || !uid.startsWith("e-") || screen.selected === uid) return {};
    screen.selected = uid;
    const d = data();
    return {
      replace: { ids: { detail: screens.detailView(expenseById(idOf(uid, "e")), d.user?.id, d.groups) } },
    };
  },

  edit: (s) => {
    const expense = expenseById(idOf(args[0] ?? "", "e"));
    if (!expense) return {};
    if (!api.isEditable(expense))
      return failure(
        "Only expenses with one payer and an equal split can be changed here. Open it in Splitwise.",
      );
    return push(s, {
      kind: "edit",
      id: expense.id,
      owes: expense.users.filter((u) => Number(u.owed_share) > 0).map((u) => u.user.id),
    });
  },

  "owes-menu": (s) => {
    const screen = top(s);
    if (screen?.kind !== "edit") return {};
    return popup(
      "owesButton",
      peopleFor(expenseById(screen.id)).map((p) => ({
        text: p.name,
        state: screen.owes.includes(p.id) ? "on" : "off",
        action: run("owes-toggle", [String(p.id)]),
      })),
    );
  },

  "owes-toggle": (s) => {
    const screen = top(s);
    if (screen?.kind !== "edit") return {};
    const id = Number(args[0]);
    screen.owes = screen.owes.includes(id) ? screen.owes.filter((o) => o !== id) : [...screen.owes, id];
    return update(
      { owesButton: { text: screens.owesText(peopleFor(expenseById(screen.id)), screen.owes) } },
      true,
    );
  },

  "edit-submit": async (s) => {
    const screen = top(s);
    if (screen?.kind !== "edit") return {};
    const expense = expenseById(screen.id);
    if (!expense) return failure("That expense is no longer available");
    const [description = "", when = "", cost = "", paid = ""] = args.map((a) => a.trim());
    const date = parseWhen(when);
    if (!description) return failure("Description is required");
    if (!date) return failure("Couldn't read the date");
    if (!api.validCost(cost)) return failure("Cost: a number with at most 2 decimals, e.g. 10.00");
    if (!paid) return failure("Choose who paid");
    if (!screen.owes.length || (!expense.payment && screen.owes.length < 2))
      return failure("Select at least 2 people who owe");
    const token = await api.readToken();
    if (!token) return failure("Not connected to Splitwise");
    try {
      await api.updateExpense(token, expense.id, {
        description,
        date: date.toISOString(),
        cost: Number(cost).toFixed(2),
        ...(expense.group_id && { group_id: expense.group_id }),
        ...api.equalSplit(cost, Number(paid), screen.owes),
      });
      const latest = loadState();
      latest.stack.pop();
      return refresh(latest, `Expense “${description}” updated`);
    } catch (error) {
      return failure(`Couldn't update: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  receipt: () => {
    const expense = expenseById(idOf(args[0] ?? "", "e"));
    const url = expense?.receipt.original;
    if (!expense || !url) return {};
    const safe = url.replace(/"/g, "%22");
    return sheet("receiptSheet", {
      type: "view",
      layout: "border",
      padding: 14,
      components: [
        {
          type: "label",
          text: `Receipt of '${expense.description}'`,
          font: { size: 14, weight: "semibold" },
          constraints: { region: "top" },
        },
        {
          type: "webkitview",
          openlinksexternally: "^https?:",
          text: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'"><style>body{margin:0;display:grid;place-items:center;height:100vh;background:transparent}img{max-width:100%;max-height:100vh}</style><img src="${safe}">`,
          constraints: { region: "centre", size: { width: 420, height: 440 } },
        },
        {
          type: "button",
          text: "Open in Browser",
          constraints: { region: "bottom" },
          events: [
            { triggers: "actioned", action: { type: "json", src: { open: { type: "url", src: url } } } },
          ],
        },
      ],
    });
  },

  delete: () => {
    const expense = expenseById(idOf(args[0] ?? "", "e"));
    if (!expense) return {};
    return sheet("deleteSheet", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 22,
      spacing: 10,
      components: [
        { type: "label", text: `Delete “${expense.description}”?`, font: { size: 15, weight: "semibold" } },
        {
          type: "label",
          text: `${money(expense.cost, expense.currency_code)} · ${longDate(expense.date)}. Splitwise can restore deleted expenses on its website.`,
          colour: "secondaryLabelColor",
          linebreak: "wordwrap",
          constraints: { size: { width: 340 } },
        },
        {
          type: "button",
          text: "Delete Expense  ⌘↩",
          shortcut: "⌘↩",
          constraints: { region: "bottom" },
          events: [
            {
              triggers: "actioned",
              action: [
                { type: "json", src: { sheet: { close: "deleteSheet" } } },
                run("delete-confirm", [String(expense.id)], true),
              ],
            },
          ],
        },
      ],
    });
  },

  "delete-confirm": async (s) => {
    const token = await api.readToken();
    if (!token) return failure("Not connected to Splitwise");
    try {
      await api.deleteExpense(token, Number(args[0]));
      return refresh(s, "Expense deleted");
    } catch (error) {
      return failure(`Couldn't delete: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /** The key arrives in the environment (`sw_key`), never as an argument. */
  "connect-save": async (s) => {
    const key = (process.env.sw_key ?? "").trim();
    if (!key) return failure("Paste your API key first");
    try {
      await api.currentUser(key);
    } catch (error) {
      return failure(
        error instanceof api.AuthError
          ? "Splitwise rejected this API key"
          : `Couldn't reach Splitwise: ${String(error)}`,
      );
    }
    await api.saveToken(key);
    s.stack = s.stack.filter((screen) => screen.kind !== "connect");
    if (!s.stack.length) s.stack.push({ kind: "people" });
    return refresh(s, "Connected to Splitwise");
  },

  disconnect: async (s) => {
    await api.deleteToken();
    rmSync(cacheDir(), { recursive: true, force: true });
    s.stack = [{ kind: "connect", message: "Disconnected. The API key was removed from your Keychain." }];
    return render(s);
  },

  post: () => {
    if (process.env.sw_out === "back")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application id "com.runningwithcrayons.Alfred" to search ""'],
        { timeout: 5000 },
      );
    return {};
  },
};

/** These save their own state (they run in the background and re-read it). */
const SELF_SAVING = ["post", "load", "reload", "delete-confirm", "add-submit", "edit-submit", "connect-save"];

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

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return emit(update({ statusLabel: { text: message, colour: "systemRedColor" } }));
  })
  .finally(() => process.exit(0));
