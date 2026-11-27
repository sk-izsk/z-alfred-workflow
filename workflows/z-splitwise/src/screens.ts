// Alfred UI component trees for each screen. One window; screens replace the root's components.
import {
  type Category,
  type Expense,
  type Friend,
  type Group,
  type User,
  fullName,
  picturePath,
} from "./api.ts";
import { ago, CURRENCIES, fieldDate, longDate, money, symbol } from "./format.ts";

export type Json = Record<string, unknown>;
const CLI = "../bin/sw";
export const run = (command: string, args: string[] = [], async = false): Json => ({
  type: "script",
  src: CLI,
  args: [command, ...args],
  ...(async && { async: true }),
});
const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
const MUTED = "secondaryLabelColor";
const GREEN = { light: "#1f7a3a", dark: "#5fd68a" };
const RED = { light: "#b3261e", dark: "#ff7b72" };
const GREEN_BG = { light: "#d9f2df", dark: "#1d3a28" };
const RED_BG = { light: "#fbe0dd", dark: "#43201d" };

const label = (id: string | undefined, text: string, extra: Json = {}): Json => ({
  ...(id && { id }),
  type: "label",
  text,
  ...extra,
});
const button = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});
const symbolImage = (src: string, size = 24) => ({
  type: "symbol",
  src,
  size: { width: size, height: size },
});
const picture = (url: string | undefined, fallback: string) => {
  const path = picturePath(url);
  return path ? { type: "file", src: path, size: { width: 26, height: 26 } } : symbolImage(fallback, 24);
};
const tag = (id: string, text: string, good: boolean | undefined): Json => ({
  id: `${id}Box`,
  type: "view",
  layout: "stack",
  padding: 4,
  cornerradius: 5,
  background: good === undefined ? null : good ? GREEN_BG : RED_BG,
  components: [
    label(id, text, {
      colour: good === undefined ? "labelColor" : good ? GREEN : RED,
      font: { size: 12.5, weight: "medium" },
    }),
  ],
});

/** Back, the screen's main action and Actions, together on the right (UI conventions). */
export const footer = (
  primary?: { text: string; action: Json | Json[]; shortcut?: string },
  status = "",
): Json => ({
  id: "footer",
  type: "view",
  layout: "border",
  padding: 14,
  spacing: 12,
  constraints: { region: "bottom" },
  components: [
    label("statusLabel", status, {
      colour: MUTED,
      font: { size: 11.5 },
      linebreak: "truncatetail",
      constraints: { region: "centre", stretch: "horizontal" },
    }),
    {
      type: "view",
      layout: "inline",
      spacing: 12,
      constraints: { region: "right" },
      components: [
        button("footerBack", "Back  {var:back_label}", run("back"), { shortcut: "{var:back_shortcut}" }),
        ...(primary
          ? [
              button(
                "primaryButton",
                primary.text,
                primary.action,
                primary.shortcut ? { shortcut: primary.shortcut } : {},
              ),
            ]
          : []),
        button("actionsButton", "Actions  {var:actions_label}", run("menu")),
      ],
    },
  ],
});

const header = (content: Json): Json => ({
  type: "view",
  layout: "border",
  padding: 14,
  spacing: 12,
  constraints: { region: "top" },
  components: [
    button("headerBack", "‹", run("back"), {
      font: { size: 24 },
      constraints: { region: "left", position: "centre" },
    }),
    { ...content, constraints: { region: "centre", stretch: "horizontal", position: "centre" } },
  ],
});
const search = (list: string, placeholder: string, text: string, enter: Json): Json => ({
  id: "query",
  type: "textfield",
  text,
  placeholder,
  focus: true,
  bordered: false,
  focusring: false,
  background: null,
  font: { size: 21, weight: "light" },
  events: [
    on("changed", { type: "function", src: list, args: ["filterdata", "selectfirst"] }),
    on("actioned", enter),
  ],
});
const title = (text: string): Json =>
  label("screenTitle", text, { font: { size: 17, weight: "semibold" }, linebreak: "truncatetail" });

const listShortcuts = (list: string): Json[] => [
  { shortcut: "↑", action: { type: "function", src: list, args: "selectprevious" } },
  { shortcut: "↓", action: { type: "function", src: list, args: "selectnext" } },
];

// ---- Friends and groups (Add Expense) ----

export type Row = Record<string, unknown>;
const personRow = (
  kind: "f" | "g",
  id: number,
  name: string,
  pic: string | undefined,
  balance: Friend["balance"][number] | undefined,
  updated: string,
): Row => ({
  uid: `${kind}-${id}`,
  search: name,
  "pPic.image": picture(pic, kind === "g" ? "person.2.circle.fill" : "person.crop.circle.fill"),
  "pName.text": name,
  "pName.colour": "labelColor",
  "pName.font": { size: 14 },
  "pBal.text": balance ? money(balance.amount, balance.currency_code) : "",
  "pBal.colour": balance && Number(balance.amount) < 0 ? RED : GREEN,
  "pBalBox.background": balance ? (Number(balance.amount) < 0 ? RED_BG : GREEN_BG) : null,
  "pWhen.text": ago(updated),
});
const sectionRow = (text: string): Row => ({
  uid: `h-${text}`,
  search: "",
  "pPic.image": null,
  "pName.text": text,
  "pName.colour": MUTED,
  "pName.font": { size: 11.5, weight: "semibold" },
  "pBal.text": "",
  "pBalBox.background": null,
  "pWhen.text": "",
});

type Entity = { kind: "f"; item: Friend } | { kind: "g"; item: Group };

/** Recent (three latest), then the other friends, then the other groups; newest first. */
export const peopleRows = (friends: Friend[], groups: Group[]): Row[] => {
  const newest = (a: { updated_at: string }, b: { updated_at: string }) =>
    Date.parse(b.updated_at) - Date.parse(a.updated_at);
  const all: Entity[] = [
    ...friends.map((item) => ({ kind: "f" as const, item })),
    ...groups.map((item) => ({ kind: "g" as const, item })),
  ];
  const recent = all.toSorted((a, b) => newest(a.item, b.item)).slice(0, 3);
  const isRecent = (e: Entity) => recent.some((r) => r.kind === e.kind && r.item.id === e.item.id);
  const row = (e: Entity) =>
    e.kind === "f"
      ? personRow(
          "f",
          e.item.id,
          fullName(e.item),
          e.item.picture.small,
          e.item.balance[0],
          e.item.updated_at,
        )
      : personRow("g", e.item.id, e.item.name, e.item.avatar.small, undefined, e.item.updated_at);
  const others = (kind: "f" | "g") =>
    all.filter((e) => e.kind === kind && !isRecent(e)).toSorted((a, b) => newest(a.item, b.item));
  const friendRows = others("f");
  const groupRows = others("g");
  return [
    ...(recent.length ? [sectionRow("Recent"), ...recent.map(row)] : []),
    ...(friendRows.length ? [sectionRow("Friends"), ...friendRows.map(row)] : []),
    ...(groupRows.length ? [sectionRow("Groups"), ...groupRows.map(row)] : []),
  ];
};

const filter = {
  args: ["search"],
  match: "{value:query.text}",
  matchmode: "wordmatchanyorder",
  matchempty: true,
};

const peopleList = (rows: Row[]): Json => ({
  id: "people",
  type: "dataview",
  padding: 8,
  spacing: 2,
  placeholder: "No friends or groups yet",
  constraints: { region: "centre" },
  // Start on the first person, not on the "Recent" heading.
  select: String(rows.find((r) => !String(r.uid).startsWith("h-"))?.uid ?? ""),
  data: { type: "basic", src: rows, filter },
  events: [on("actioned", run("open", ["{value:people.selected.uid}"]))],
  cell: {
    height: 40,
    init: { "pRow.background": null },
    selected: { "pRow.background": "alfredSelectedResultBackgroundColor" },
    root: {
      id: "pRow",
      type: "view",
      layout: "border",
      padding: 7,
      spacing: 10,
      cornerradius: 7,
      components: [
        {
          id: "pPic",
          type: "imageview",
          cornerradius: 13,
          contenttintcolour: MUTED,
          constraints: { region: "left", position: "centre", size: { width: 26, height: 26 } },
        },
        label("pName", "", {
          linebreak: "truncatetail",
          constraints: { region: "centre", position: "left", stretch: "horizontal" },
        }),
        {
          id: "pRight",
          type: "view",
          layout: "inline",
          spacing: 10,
          constraints: { region: "right", position: "centre" },
          components: [
            tag("pBal", "", undefined),
            label("pWhen", "", { colour: MUTED, font: { size: 12.5 }, constraints: { position: "centre" } }),
          ],
        },
      ],
    },
  },
});

export const peopleScreen = (rows: Row[], query: string, status: string) => ({
  components: [
    header(
      search(
        "people",
        "Search your favorite friend or group",
        query,
        run("open", ["{value:people.selected.uid}"]),
      ),
    ),
    peopleList(rows),
    footer({ text: "Add Expense  ↩", action: run("open", ["{value:people.selected.uid}"]) }, status),
  ],
  shortcuts: [
    ...listShortcuts("people"),
    { shortcut: "{var:actions_shortcut}", action: run("menu", ["{value:people.selected.uid}"]) },
    { shortcut: "⌘R", action: run("reload", [], true) },
    { shortcut: "⌘O", action: run("browser", ["{value:people.selected.uid}"]) },
  ],
});

// ---- Forms ----

const formField = (id: string, text: string, placeholder: string, extra: Json = {}): Json => ({
  id,
  type: "textfield",
  text,
  placeholder,
  constraints: { size: { width: 380 } },
  ...extra,
});
const formLabel = (text: string): Json => label(undefined, text, { colour: MUTED, textalign: "right" });
const note = (id: string, text: string): Json =>
  label(id, text, {
    colour: MUTED,
    font: { size: 11.5 },
    linebreak: "wordwrap",
    constraints: { size: { width: 380 } },
  });
const form = (components: Json[]): Json => ({
  type: "view",
  layout: "border",
  constraints: { region: "centre" },
  components: [
    {
      id: "form",
      type: "view",
      layout: "form",
      padding: 26,
      spacing: 11,
      constraints: { region: "top", position: "centre" },
      components,
    },
  ],
});

/** Leaf categories only (Splitwise assigns subcategories), as `Utilities › Electricity`. */
export const categoryItems = (categories: Category[]): { text: string; value: string }[] =>
  categories.flatMap((c) =>
    c.subcategories?.length
      ? c.subcategories.map((s) => ({ text: `${c.name} › ${s.name}`, value: String(s.id) }))
      : [{ text: c.name, value: String(c.id) }],
  );

const currencyItems = (preferred: string) =>
  [preferred, ...CURRENCIES.filter((c) => c !== preferred)].map((c) => ({
    text: symbol(c) === c ? c : `${c} (${symbol(c)})`,
    value: c,
  }));

const ADD_ARGS = [
  "{value:desc.text}",
  "{value:category.selected.value}",
  "{value:date.text}",
  "{value:currency.selected.value}",
  "{value:cost.text}",
];
const dateField = (date: Date) =>
  formField("date", fieldDate(date), "today, yesterday 18:30, 2026-01-04 12:00", {
    events: [on("typingstopped", run("date-hint", ["{value:date.text}"]))],
  });

export const addScreen = (
  target: { type: "friend" | "group"; name: string },
  user: User | undefined,
  categories: Category[],
) => {
  const currency = user?.default_currency || "USD";
  const items = categoryItems(categories);
  const submit = run("add-submit", ADD_ARGS, true);
  const general = items.find((i) => /^general/i.test(i.text))?.value ?? items[0]?.value ?? "";
  return {
    components: [
      header(title("Add Expense")),
      form([
        formLabel(target.type === "friend" ? "Friend" : "Group"),
        label("targetName", target.name, { font: { size: 14, weight: "medium" } }),
        formLabel("Description"),
        formField("desc", "", "Pizza", { focus: true, events: [on("actioned", submit)] }),
        formLabel("Category"),
        {
          id: "category",
          type: "picker",
          selected: general,
          items: items.length ? items : [{ text: "General", value: "" }],
        },
        formLabel("Date of Expense"),
        dateField(new Date()),
        {},
        note("dateHint", longDate(new Date())),
        formLabel("Currency Code"),
        { id: "currency", type: "picker", selected: currency, items: currencyItems(currency) },
        formLabel("Cost"),
        formField("cost", "", "10.00", { events: [on("actioned", submit)] }),
        {},
        note(
          "costInfo",
          target.type === "friend"
            ? "Split equally; assumes you are the payer."
            : "Split equally among the group; assumes you are the payer.",
        ),
      ]),
      footer({ text: "Add Expense  ⌘↩", action: submit, shortcut: "⌘↩" }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export type Person = { id: number; name: string };
export const owesText = (people: Person[], owes: number[]) =>
  `${
    people
      .filter((p) => owes.includes(p.id))
      .map((p) => p.name)
      .join(", ") || "Nobody"
  }  ▾`;

export const editScreen = (expense: Expense, people: Person[], paid: number, owes: number[]) => {
  const submit = run(
    "edit-submit",
    ["{value:desc.text}", "{value:date.text}", "{value:cost.text}", "{value:paid.selected.value}"],
    true,
  );
  return {
    components: [
      header(title(`Change values of '${expense.description}'`)),
      form([
        formLabel("Description"),
        formField("desc", expense.description, "Description", {
          focus: true,
          events: [on("actioned", submit)],
        }),
        formLabel("Date of Expense"),
        dateField(new Date(expense.date)),
        {},
        note("dateHint", longDate(expense.date)),
        formLabel(`Cost in ${symbol(expense.currency_code)}`),
        formField("cost", Number(expense.cost).toFixed(2), "10.00", { events: [on("actioned", submit)] }),
        formLabel("Who paid?"),
        {
          id: "paid",
          type: "picker",
          selected: String(paid),
          items: people.map((p) => ({ text: p.name, value: String(p.id) })),
        },
        formLabel("Who owes?"),
        button("owesButton", owesText(people, owes), run("owes-menu"), { bordered: true }),
        {},
        note("owesInfo", "Expense will be split equally among the involved people."),
      ]),
      footer({ text: "Submit changes  ⌘↩", action: submit, shortcut: "⌘↩" }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

// ---- Expenses (List Expenses) ----

const netFor = (expense: Expense, me: number | undefined) =>
  Number(expense.users.find((u) => u.user.id === me)?.net_balance ?? 0);

export const expenseRows = (expenses: Expense[], me: number | undefined): Row[] =>
  expenses.map((e) => {
    const net = netFor(e, me);
    return {
      uid: `e-${e.id}`,
      search: `${e.description} ${e.users.map((u) => u.user.first_name).join(" ")}`,
      "eTitle.text": e.description,
      // Icon first, then the name: payment, group expense, or an expense with one friend.
      "eIcon.image": symbolImage(e.payment ? "banknote" : e.group_id ? "person.2.fill" : "person.fill", 16),
      "eAmt.text": money(e.cost, e.currency_code),
      "eAmt.colour": net > 0 ? GREEN : net < 0 ? RED : "labelColor",
      "eAmtBox.background": net > 0 ? GREEN_BG : net < 0 ? RED_BG : null,
    };
  });

const expenseList = (rows: Row[], selected: string): Json => ({
  id: "expenses",
  type: "dataview",
  padding: 8,
  spacing: 2,
  placeholder: "No expenses",
  select: selected,
  constraints: { region: "left", size: { width: 330 } },
  data: { type: "basic", src: rows, filter },
  events: [
    on("changed", run("select", ["{value:expenses.selected.uid}"])),
    on("actioned", run("browser", ["{value:expenses.selected.uid}"])),
  ],
  cell: {
    height: 40,
    init: { "eRow.background": null },
    selected: { "eRow.background": "alfredSelectedResultBackgroundColor" },
    root: {
      id: "eRow",
      type: "view",
      layout: "border",
      padding: 7,
      spacing: 8,
      cornerradius: 7,
      components: [
        {
          id: "eIcon",
          type: "imageview",
          contenttintcolour: MUTED,
          constraints: { region: "left", position: "centre", size: { width: 20, height: 20 } },
        },
        label("eTitle", "", {
          linebreak: "truncatetail",
          constraints: { region: "centre", position: "left", stretch: "horizontal" },
        }),
        { ...tag("eAmt", "", undefined), constraints: { region: "right", position: "centre" } },
      ],
    },
  },
});

const detailRow = (text: string, value: Json, key: string): Json => ({
  id: `d-${key}`,
  type: "view",
  layout: "border",
  spacing: 10,
  components: [
    label(`d-${key}-t`, text, {
      colour: MUTED,
      linebreak: "truncatetail",
      constraints: { region: "left", position: "topleft" },
    }),
    { ...value, constraints: { region: "right", position: "topright" } },
  ],
});
const separator = (key: string): Json => ({
  id: `d-sep-${key}`,
  type: "view",
  background: "separatorColor",
  constraints: { size: { height: 1 } },
});
const column = (key: string, items: Json[]): Json => ({
  id: `d-${key}-v`,
  type: "view",
  layout: "inline",
  direction: "vertical",
  spacing: 4,
  components: items,
});

/** The right half of List Expenses: what Raycast shows in its detail metadata. */
export const detailView = (expense: Expense | undefined, me: number | undefined, groups: Group[]): Json => {
  if (!expense)
    return {
      id: "detail",
      type: "view",
      layout: "stack",
      padding: 18,
      constraints: { region: "centre" },
      components: [
        label("d-empty", "Select an expense", { colour: MUTED, constraints: { position: "centre" } }),
      ],
    };
  const net = netFor(expense, me);
  const cur = expense.currency_code;
  const group = groups.find((g) => g.id === expense.group_id);
  const who = (person: { id: number; first_name: string } | null) =>
    person ? (person.id === me ? "You" : person.first_name) : "Unknown";
  const payers = expense.users.filter((u) => Number(u.paid_share) > 0);
  const debtors = expense.users.filter((u) => Number(u.net_balance) < 0);
  const rows: Json[] = [
    detailRow(
      expense.description,
      tag("d-amount", money(expense.cost, cur), net === 0 ? undefined : net > 0),
      "title",
    ),
    separator("1"),
    ...(group
      ? [
          detailRow(
            "Group Expense",
            button("d-group-open", `Open '${group.name}'  ↗`, run("browser", [`g-${group.id}`])),
            "group",
          ),
        ]
      : []),
    detailRow(
      `Created by ${who(expense.created_by)}`,
      label("d-created-v", longDate(expense.date)),
      "created",
    ),
    ...(expense.updated_by
      ? [
          detailRow(
            `Last updated by ${who(expense.updated_by)}`,
            label("d-updated-v", longDate(expense.updated_at)),
            "updated",
          ),
        ]
      : []),
    separator("2"),
    detailRow(
      "Paid by",
      column(
        "paid",
        payers.map((u, i) =>
          tag(
            `d-paid-${i}`,
            Number(u.owed_share) === 0
              ? `${u.user.first_name} paid ${money(u.paid_share, cur)}`
              : `${u.user.first_name} paid ${money(u.paid_share, cur)} and owes ${money(u.owed_share, cur)}`,
            true,
          ),
        ),
      ),
      "paid",
    ),
    separator("3"),
    detailRow(
      expense.payment ? "Received by" : "Owed by",
      column(
        "owed",
        debtors.map((u, i) =>
          tag(
            `d-owed-${i}`,
            `${u.user.first_name} ${expense.payment ? "received" : "owes"} ${money(-Number(u.net_balance), cur)}`,
            false,
          ),
        ),
      ),
      "owed",
    ),
    ...(expense.repeats
      ? [
          separator("4"),
          detailRow("Repeating Expense", label("d-repeat-v", expense.repeat_interval ?? ""), "repeat"),
        ]
      : []),
    ...(expense.receipt.original
      ? [
          separator("5"),
          detailRow(
            "Receipt",
            button("d-receipt-open", "View Receipt  ⌘Y", run("receipt", [`e-${expense.id}`])),
            "receipt",
          ),
        ]
      : []),
  ];
  return {
    id: "detail",
    type: "view",
    layout: "border",
    constraints: { region: "centre" },
    components: [
      {
        id: "d-body",
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 10,
        padding: 18,
        constraints: { region: "top" },
        components: rows,
      },
    ],
  };
};

export const expensesScreen = (
  rows: Row[],
  selected: string,
  detail: Json,
  query: string,
  status: string,
) => ({
  components: [
    header(search("expenses", "Search Expenses", query, run("browser", ["{value:expenses.selected.uid}"]))),
    {
      id: "split",
      type: "view",
      layout: "border",
      constraints: { region: "centre" },
      components: [
        expenseList(rows, selected),
        {
          id: "divider",
          type: "view",
          background: "separatorColor",
          constraints: { region: "left", size: { width: 1 } },
        },
        detail,
      ],
    },
    footer(
      { text: "Open Expense in Splitwise  ↩", action: run("browser", ["{value:expenses.selected.uid}"]) },
      status,
    ),
  ],
  shortcuts: [
    ...listShortcuts("expenses"),
    { shortcut: "{var:actions_shortcut}", action: run("menu", ["{value:expenses.selected.uid}"]) },
    { shortcut: "⌘R", action: run("reload", [], true) },
    { shortcut: "⌘O", action: run("browser", ["{value:expenses.selected.uid}"]) },
    { shortcut: "⌘E", action: run("edit", ["{value:expenses.selected.uid}"]) },
    { shortcut: "⌘Y", action: run("receipt", ["{value:expenses.selected.uid}"]) },
    { shortcut: "⌃X", action: run("delete", ["{value:expenses.selected.uid}"]) },
  ],
});

// ---- Connect (API key) ----

export const connectScreen = (message: string) => {
  // The key travels as a script environment variable, never in argv.
  const save = {
    type: "script",
    src: CLI,
    args: ["connect-save"],
    variables: { sw_key: "{value:apiKey.text}" },
  };
  return {
    components: [
      header(title("Connect Splitwise")),
      form([
        {},
        note(
          "howTo",
          "Register an app at secure.splitwise.com/apps (name e.g. “Alfred”), then paste its API key here. It is kept in your macOS Keychain.",
        ),
        formLabel("API Key"),
        {
          id: "apiKey",
          type: "passwordfield",
          focus: true,
          constraints: { size: { width: 380 } },
          events: [on("actioned", save)],
        },
        {},
        button("getKey", "Open secure.splitwise.com/apps  ↗", {
          type: "json",
          src: { open: { type: "url", src: "https://secure.splitwise.com/apps" } },
        }),
      ]),
      footer({ text: "Save Key  ⌘↩", action: save, shortcut: "⌘↩" }, message),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const loadingScreen = (text: string) => ({
  components: [
    header(title("Splitwise")),
    label("loading", text, { colour: MUTED, constraints: { region: "centre", position: "centre" } }),
    footer(undefined, ""),
  ],
  shortcuts: [],
});
