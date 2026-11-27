// Alfred UI component trees for each screen. One window; screens replace the root's components.
import { ago } from "./format.ts";
import type { DbProp, Option, Page, Prop, User } from "./notion.ts";
import { picturePath } from "./notion.ts";

export type Json = Record<string, unknown>;
export type Row = Record<string, unknown>;
const CLI = "../bin/nt";
export const run = (command: string, args: string[] = [], async = false): Json => ({
  type: "script",
  src: CLI,
  args: [command, ...args],
  ...(async && { async: true }),
});
/** Opens another screen, then loads its content in the background (pages, databases, forms). */
export const go = (command: string, args: string[] = []): Json[] => [
  run(command, args),
  run("load", [], true),
];
const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
const MUTED = "secondaryLabelColor";

/** Notion's option colours (light, dark), as measured in the Raycast extension. */
const NOTION: Record<string, [string, string]> = {
  default: ["#F1F0F0", "#373737"],
  gray: ["#E3E2E0", "#5A5A5A"],
  brown: ["#EEE0DA", "#603B2C"],
  orange: ["#FADEC9", "#854C1D"],
  yellow: ["#FDECC8", "#89632A"],
  green: ["#DBEDDB", "#2B593F"],
  blue: ["#D3E5EF", "#28456C"],
  purple: ["#E8DEEE", "#492F64"],
  pink: ["#F5E0E9", "#69314C"],
  red: ["#FFE2DD", "#6E3630"],
};
export const tint = (color = "default") => {
  const [light, dark] = NOTION[color] ?? (NOTION.default as [string, string]);
  return { light, dark };
};
const BADGE = { light: "#F2994A", dark: "#E07B2C" };

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
const symbol = (src: string, size = 18) => ({ type: "symbol", src, size: { width: size, height: size } });
const chip = (id: string, text: string, color?: string): Json => ({
  id: `${id}Box`,
  type: "view",
  layout: "stack",
  padding: 3,
  cornerradius: 5,
  background: color === undefined ? null : tint(color),
  components: [label(id, text, { font: { size: 12 }, linebreak: "truncatetail" })],
});
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
const badge = (id: string, text: string, size: number): Json => ({
  id: `${id}Box`,
  type: "view",
  layout: "stack",
  cornerradius: size / 2,
  background: BADGE,
  constraints: { size: { width: size, height: size }, position: "centre" },
  components: [
    label(id, text, {
      font: { size: size * 0.45, weight: "bold" },
      colour: "#ffffff",
      textalign: "centre",
      constraints: { position: "centre" },
    }),
  ],
});

const SELECTED = "{value:list.selected.uid}";

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
        button("actionsButton", "Actions  {var:actions_label}", run("menu", [SELECTED])),
      ],
    },
  ],
});

const header = (content: Json, right?: Json): Json => ({
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
    ...(right ? [{ ...right, constraints: { region: "right", position: "centre" } }] : []),
  ],
});
const searchField = (placeholder: string, text: string, typing: Json, enter: Json | Json[]): Json => ({
  id: "query",
  type: "textfield",
  text,
  placeholder,
  focus: true,
  bordered: false,
  focusring: false,
  background: null,
  font: { size: 21, weight: "light" },
  events: [on("typingstopped", typing), on("actioned", enter)],
});
const title = (text: string): Json =>
  label("screenTitle", text, { font: { size: 17, weight: "semibold" }, linebreak: "truncatetail" });
const listKeys: Json[] = [
  { shortcut: "↑", action: { type: "function", src: "list", args: "selectprevious" } },
  { shortcut: "↓", action: { type: "function", src: "list", args: "selectnext" } },
];

// ---- Page rows (search and databases) ----

const icon = (page: Page): Row => {
  if (page.emoji) return { "pEmoji.text": page.emoji, "pIcon.image": null };
  const path = picturePath(page.iconUrl);
  return {
    "pEmoji.text": "",
    "pIcon.image": path
      ? { type: "file", src: path, size: { width: 18, height: 18 } }
      : symbol(page.object === "database" ? "list.bullet.rectangle" : "doc.text"),
  };
};

/** Tags for the properties a database view shows (select, status, multi-select, checkbox, text…). */
export const propertyTags = (
  page: Page,
  visible: string[],
  users: User[],
): { text: string; color?: string }[] =>
  visible.flatMap((id) => {
    const p = page.properties.find((q) => q.id === id);
    if (!p) return [];
    switch (p.type) {
      case "select":
      case "status":
        return p.option ? [{ text: p.option.name, color: p.option.color }] : [];
      case "multi_select":
        return p.options.map((o) => ({ text: o.name, color: o.color }));
      case "checkbox":
        return [{ text: `${p.checked ? "☑" : "☐"} ${p.name}` }];
      case "people":
        return p.ids.map((uid) => ({ text: users.find((u) => u.id === uid)?.name ?? "Someone" }));
      case "relation":
        return p.ids.length ? [{ text: `${p.ids.length} linked` }] : [];
      case "date":
        return p.start ? [{ text: p.start.slice(0, 10) }] : [];
      case "title":
        return [];
      default:
        return p.text ? [{ text: p.text.slice(0, 30) }] : [];
    }
  });

export const pageRow = (page: Page, users: User[], visible: string[] = []): Row => {
  const editor = users.find((u) => u.id === page.lastEditedBy);
  const tags = propertyTags(page, visible, users).slice(0, 3);
  const row: Row = {
    uid: `p-${page.id}`,
    ...icon(page),
    "pTitle.text": page.title,
    "pTitle.colour": "labelColor",
    "pTitle.font": { size: 14 },
    "pUser.text": editor ? initials(editor.name) : "",
    "pUserBox.background": editor ? BADGE : null,
    "pWhen.text": page.lastEdited ? ago(new Date(page.lastEdited).toISOString()) : "",
  };
  for (let i = 0; i < 3; i++) {
    row[`t${i}.text`] = tags[i]?.text ?? "";
    row[`t${i}Box.background`] = tags[i] ? tint(tags[i]?.color) : null;
  }
  return row;
};
export const sectionRow = (text: string): Row => ({
  uid: `h-${text}`,
  "pEmoji.text": "",
  "pIcon.image": null,
  "pTitle.text": text,
  "pTitle.colour": MUTED,
  "pTitle.font": { size: 11.5, weight: "semibold" },
  "pUser.text": "",
  "pUserBox.background": null,
  "pWhen.text": "",
  "t0.text": "",
  "t0Box.background": null,
  "t1.text": "",
  "t1Box.background": null,
  "t2.text": "",
  "t2Box.background": null,
});

const pageList = (rows: Row[], placeholder: string, enter: Json | Json[]): Json => ({
  id: "list",
  type: "dataview",
  padding: 8,
  spacing: 2,
  placeholder,
  select: String(rows.find((r) => !String(r.uid).startsWith("h-"))?.uid ?? ""),
  constraints: { region: "centre" },
  data: { type: "basic", src: rows },
  events: [on("actioned", enter)],
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
          id: "pIconBox",
          type: "view",
          layout: "stack",
          constraints: { region: "left", position: "centre", size: { width: 22, height: 22 } },
          components: [
            { id: "pIcon", type: "imageview", contenttintcolour: MUTED },
            label("pEmoji", "", { font: { size: 16 }, textalign: "centre" }),
          ],
        },
        label("pTitle", "", {
          linebreak: "truncatetail",
          constraints: { region: "centre", position: "left", stretch: "horizontal" },
        }),
        {
          id: "pRight",
          type: "view",
          layout: "inline",
          spacing: 8,
          constraints: { region: "right", position: "centre" },
          components: [
            chip("t0", "", undefined),
            chip("t1", "", undefined),
            chip("t2", "", undefined),
            badge("pUser", "", 20),
            label("pWhen", "", { colour: MUTED, font: { size: 12.5 }, constraints: { position: "centre" } }),
          ],
        },
      ],
    },
  },
});

export const searchScreen = (rows: Row[], query: string, status: string, primary: string) => ({
  components: [
    header(
      searchField(
        "Search pages…",
        query,
        run("search", ["{value:query.text}"], true),
        go("primary", [SELECTED]),
      ),
    ),
    pageList(
      rows,
      "No pages found. Share pages with your integration in Notion, then press ⌘R.",
      go("primary", [SELECTED]),
    ),
    footer({ text: `${primary}  ↩`, action: go("primary", [SELECTED]) }, status),
  ],
  shortcuts: [
    ...listKeys,
    { shortcut: "{var:actions_shortcut}", action: run("menu", [SELECTED]) },
    { shortcut: "⌘R", action: run("refresh", [], true) },
    { shortcut: "⌘O", action: run("open-app", [SELECTED]) },
    { shortcut: "⌘N", action: go("new-page", [SELECTED]) },
  ],
});

export const databaseScreen = (
  name: string,
  rows: Row[],
  query: string,
  sort: string,
  status: string,
  primary = "Open in Notion",
) => ({
  components: [
    header(
      searchField(
        `Filter ${name}…`,
        query,
        run("db-search", ["{value:query.text}"], true),
        go("primary", [SELECTED]),
      ),
      {
        id: "sort",
        type: "picker",
        bordered: false,
        selected: sort,
        items: [
          { text: "Last Edited At", value: "last_edited_time" },
          { text: "Last Created At", value: "created_time" },
        ],
        events: [on("changed", run("db-sort", ["{value:sort.selected.value}"], true))],
      },
    ),
    pageList(rows, "No pages found. ⌘N creates one.", go("primary", [SELECTED])),
    footer({ text: `${primary}  ↩`, action: go("primary", [SELECTED]) }, status),
  ],
  shortcuts: [
    ...listKeys,
    { shortcut: "{var:actions_shortcut}", action: run("menu", [SELECTED]) },
    { shortcut: "⌘R", action: run("refresh", [], true) },
    { shortcut: "⌘O", action: run("open-app", [SELECTED]) },
    { shortcut: "⌘N", action: go("new-page", [SELECTED]) },
  ],
});

// ---- Page preview ----

/** Name above value, both left-aligned (a vertical inline view would centre the value). */
const metaRow = (key: string, name: string, value: Json): Json => ({
  id: `m-${key}`,
  type: "view",
  layout: "border",
  spacing: 5,
  components: [
    label(`m-${key}-t`, name, {
      colour: MUTED,
      font: { size: 12.5 },
      constraints: { region: "top", position: "left" },
    }),
    { ...value, constraints: { region: "centre", position: "left" } },
  ],
});
const person = (key: string, user: User | undefined): Json => ({
  id: `m-${key}-p`,
  type: "view",
  layout: "inline",
  spacing: 6,
  components: [
    badge(`m-${key}-i`, initials(user?.name ?? "?"), 18),
    label(`m-${key}-n`, user?.name ?? "Unknown"),
  ],
});
const chips = (key: string, items: { text: string; color?: string }[]): Json => ({
  id: `m-${key}-c`,
  type: "view",
  layout: "inline",
  spacing: 6,
  components: items.map((item, i) => chip(`m-${key}-${i}`, item.text, item.color ?? "default")),
});

/** The right pane of a page preview: Last Edited, every property and Created By. */
export const metadata = (page: Page, users: User[]): Json[] => {
  const user = (id?: string) => users.find((u) => u.id === id);
  const rows: Json[] = [];
  if (page.lastEdited) {
    const editor = user(page.lastEditedBy);
    const when = ago(new Date(page.lastEdited).toISOString());
    rows.push(
      metaRow(
        "edited",
        "Last Edited",
        label("m-edited-v", `${when} ago${editor ? ` by ${editor.name}` : ""}`),
      ),
    );
  }
  page.properties.forEach((p: Prop, i) => {
    const key = `p${i}`;
    switch (p.type) {
      case "title":
        return;
      case "select":
      case "status":
        if (p.option)
          rows.push(metaRow(key, p.name, chips(key, [{ text: p.option.name, color: p.option.color }])));
        return;
      case "multi_select":
        if (p.options.length)
          rows.push(
            metaRow(
              key,
              p.name,
              chips(
                key,
                p.options.map((o: Option) => ({ text: o.name, color: o.color })),
              ),
            ),
          );
        return;
      case "people":
        if (p.ids.length)
          rows.push(
            metaRow(key, p.name, {
              id: `m-${key}-v`,
              type: "view",
              layout: "inline",
              spacing: 10,
              components: p.ids.map((id, j) => person(`${key}-${j}`, user(id))),
            }),
          );
        return;
      case "checkbox":
        rows.push(metaRow(key, p.name, label(`m-${key}-v`, p.checked ? "Checked" : "Unchecked")));
        return;
      case "date":
        if (p.start)
          rows.push(metaRow(key, p.name, label(`m-${key}-v`, p.end ? `${p.start} → ${p.end}` : p.start)));
        return;
      case "relation":
        if (p.ids.length)
          rows.push(
            metaRow(
              key,
              p.name,
              label(`m-${key}-v`, `${p.ids.length} linked page${p.ids.length === 1 ? "" : "s"}`),
            ),
          );
        return;
      default:
        if (p.text) rows.push(metaRow(key, p.name, label(`m-${key}-v`, p.text, { linebreak: "wordwrap" })));
    }
  });
  const creator = user(page.createdBy);
  if (creator) rows.push(metaRow("created", "Created By", person("created", creator)));
  return rows;
};

export const pageScreen = (
  page: Page,
  markdown: string,
  users: User[],
  showMeta: boolean,
  status: string,
) => ({
  components: [
    header(title(`${page.emoji ? `${page.emoji} ` : ""}${page.title}`)),
    {
      id: "preview",
      type: "view",
      layout: "border",
      constraints: { region: "centre" },
      components: [
        {
          id: "markdownBox",
          type: "view",
          layout: "stack",
          padding: 14,
          constraints: { region: "centre" },
          components: [
            {
              id: "markdown",
              type: "markdownarea",
              background: null,
              text: `# ${page.title}\n\n${markdown}`,
            },
          ],
        },
        ...(showMeta
          ? [
              {
                id: "metaDivider",
                type: "view",
                background: "separatorColor",
                constraints: { region: "right", size: { width: 1 } },
              },
              {
                id: "meta",
                type: "view",
                layout: "border",
                constraints: { region: "right", size: { width: 260 } },
                components: [
                  {
                    id: "metaBody",
                    type: "view",
                    layout: "inline",
                    direction: "vertical",
                    spacing: 14,
                    padding: 16,
                    constraints: { region: "top" },
                    components: metadata(page, users),
                  },
                ],
              },
            ]
          : []),
      ],
    },
    footer({ text: "Open in Notion  ↩", action: run("open-app", [`p-${page.id}`]) }, status),
  ],
  shortcuts: [
    { shortcut: "{var:actions_shortcut}", action: run("menu", [`p-${page.id}`]) },
    { shortcut: "⌘O", action: run("open-app", [`p-${page.id}`]) },
    { shortcut: "⌘R", action: run("refresh", [], true) },
  ],
});

// ---- Forms ----

const WIDTH = 420;
const formField = (id: string, text: string, placeholder: string, extra: Json = {}): Json => ({
  id,
  type: "textfield",
  text,
  placeholder,
  constraints: { size: { width: WIDTH } },
  ...extra,
});
const formLabel = (text: string): Json => label(undefined, text, { colour: MUTED, textalign: "right" });
const note = (id: string, text: string): Json =>
  label(id, text, {
    colour: MUTED,
    font: { size: 11.5 },
    linebreak: "wordwrap",
    constraints: { size: { width: WIDTH } },
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
      padding: 22,
      spacing: 9,
      constraints: { region: "top", position: "centre" },
      components,
    },
  ],
});
const picker = (
  id: string,
  items: { text: string; value: string }[],
  selected: string,
  extra: Json = {},
): Json => ({
  id,
  type: "picker",
  selected: items.some((i) => i.value === selected) ? selected : (items[0]?.value ?? ""),
  items: items.length ? items : [{ text: "Nothing found", value: "" }],
  constraints: { size: { width: WIDTH } },
  ...extra,
});
const checkbox = (id: string, text: string, checked: boolean): Json => ({
  id,
  type: "checkbox",
  text,
  checked,
});
export const pageItems = (pages: Page[]) =>
  pages.map((p) => ({ text: `${p.emoji ? `${p.emoji} ` : ""}${p.title}`, value: p.id }));
/** A search box above a page picker: pickers can't be searched, so typing refreshes its items. */
const pageSearch = (): Json =>
  formField("pageSearch", "", "Search Notion pages…", {
    events: [on("typingstopped", run("page-search", ["{value:pageSearch.text}"], true))],
  });

export type FieldSpec = { prop: DbProp; field: string; read: string };
/** One control per database property; `read` is the placeholder that reads its value. */
export const fieldSpecs = (props: DbProp[]): FieldSpec[] =>
  props
    .filter((p) => p.type !== "formula")
    .map((prop, i) => {
      const field = `f${i}`;
      const read =
        prop.type === "checkbox"
          ? `{value:${field}.checked}`
          : prop.type === "select" || prop.type === "status"
            ? `{value:${field}.selected.value}`
            : ["multi_select", "people", "relation"].includes(prop.type)
              ? "" // kept in state by the ticked menu
              : `{value:${field}.text}`;
      return { prop, field, read };
    });

export const multiText = (options: { id: string; name: string }[], chosen: string[]) =>
  `${
    options
      .filter((o) => chosen.includes(o.id))
      .map((o) => o.name)
      .join(", ") || "None"
  }  ▾`;

export type MultiOptions = Record<string, { id: string; name: string }[]>;

export const createScreen = (
  databases: Page[],
  database: string,
  specs: FieldSpec[],
  multi: Record<string, string[]>,
  options: MultiOptions,
  prefill: { title?: string; content?: string },
  closeAfter: boolean,
) => {
  const args = [
    "{value:database.selected.value}",
    ...specs.map((s) => s.read),
    "{value:content.text}",
    "{value:divider.checked}",
  ];
  const submit = run("create-submit", args, true);
  const control = ({ prop, field }: FieldSpec): Json => {
    if (prop.type === "checkbox") return checkbox(field, prop.name, false);
    if (prop.type === "select" || prop.type === "status")
      return picker(
        field,
        [
          { text: "No Selection", value: "_none_" },
          ...(prop.options ?? []).map((o) => ({ text: o.name, value: o.id })),
        ],
        "_none_",
      );
    if (["multi_select", "people", "relation"].includes(prop.type))
      return button(
        field,
        multiText(options[prop.id] ?? [], multi[prop.id] ?? []),
        run("multi-menu", [prop.id]),
        {
          bordered: true,
        },
      );
    const placeholder =
      prop.type === "date" ? "today 9:00, tomorrow, 2026-10-12 09:00" : prop.type.replace(/_/g, " ");
    return formField(field, prop.type === "title" ? (prefill.title ?? "") : "", placeholder, {
      ...(prop.type === "title" && { focus: true }),
    });
  };
  return {
    components: [
      header(title("Create Database Page")),
      form([
        formLabel("Database"),
        picker("database", pageItems(databases), database, {
          events: [on("changed", run("pick-database", ["{value:database.selected.value}"]))],
        }),
        ...specs.flatMap((spec) => [formLabel(spec.prop.name), control(spec)]),
        formLabel("Page Content"),
        {
          id: "content",
          type: "textarea",
          text: prefill.content ?? "",
          constraints: { size: { width: WIDTH, height: 80 } },
        },
        {},
        checkbox("divider", "Append with a date divider", false),
      ]),
      footer({
        text: `${closeAfter ? "Create Page and Close" : "Create Page"}  ⌘↩`,
        action: submit,
        shortcut: "⌘↩",
      }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const captureScreen = (pages: Page[], url: string, as: string, target: string) => {
  const submit = run(
    "capture-submit",
    [
      "{value:url.text}",
      "{value:captureAs.selected.value}",
      "{value:divider.checked}",
      "{value:target.selected.value}",
    ],
    true,
  );
  return {
    components: [
      header(title("Quick Capture")),
      form([
        formLabel("URL"),
        formField("url", url, "https://example.com/articles/building-better-tools", { focus: true }),
        {},
        note("urlHint", "Copy a URL before opening Quick Capture and it is filled in."),
        formLabel("Capture As"),
        picker(
          "captureAs",
          [
            { text: "Bookmark", value: "url" },
            { text: "Full Page", value: "full" },
            { text: "Link", value: "link" },
          ],
          as,
        ),
        {},
        checkbox("divider", "Append with a date divider", false),
        formLabel("Notion Page"),
        pageSearch(),
        {},
        picker("target", pageItems(pages), target),
      ]),
      footer({ text: "Capture  ⌘↩", action: submit, shortcut: "⌘↩" }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const addTextScreen = (pages: Page[], text: string, target: string, heading = "Add Text to Page") => {
  const submit = run(
    "text-submit",
    [
      "{value:target.selected.value}",
      "{value:content.text}",
      "{value:prepend.checked}",
      "{value:divider.checked}",
    ],
    true,
  );
  return {
    components: [
      header(title(heading)),
      form([
        formLabel("Notion Page"),
        pageSearch(),
        {},
        picker("target", pageItems(pages), target),
        formLabel("Content"),
        {
          id: "content",
          type: "textarea",
          text,
          focus: true,
          constraints: { size: { width: WIDTH, height: 110 } },
        },
        {},
        note("mdHint", "Markdown works: **bold**, - lists, [links](https://…), # headings."),
        {},
        checkbox("prepend", "Append at the top", false),
        {},
        checkbox("divider", "Append with a date divider", false),
      ]),
      footer({ text: "Add Text  ⌘↩", action: submit, shortcut: "⌘↩" }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const noteScreen = (
  pages: Page[],
  text: string,
  destination: string,
  rootName: string,
  parent: string,
) => {
  const submit = run("note-submit", ["{value:content.text}", "{value:target.selected.value}"], true);
  return {
    components: [
      header(title("Add Note")),
      form([
        formLabel("Note"),
        {
          id: "content",
          type: "textarea",
          text,
          focus: true,
          constraints: { size: { width: WIDTH, height: 100 } },
        },
        formLabel("Destination"),
        label("destination", destination, { font: { weight: "medium" } }),
        formLabel("Parent Page"),
        pageSearch(),
        {},
        picker(
          "target",
          [{ text: `None — “${rootName}” already exists`, value: "" }, ...pageItems(pages)],
          parent,
        ),
        {},
        note(
          "parentHint",
          `Only used the first time: Notion can't create top-level pages, so “${rootName}” is created inside this page if it doesn't exist yet.`,
        ),
      ]),
      footer({ text: "Add Note  ⌘↩", action: submit, shortcut: "⌘↩" }),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const connectScreen = (connected: string | undefined, message: string) => {
  // The secret travels as a script environment variable, never in argv.
  const save = {
    type: "script",
    src: CLI,
    args: ["connect-save"],
    variables: { nt_key: "{value:secret.text}" },
  };
  return {
    components: [
      header(title("Manage Notion Connection")),
      form([
        formLabel("Status"),
        label("connState", connected ? `Connected to ${connected}` : "Not connected", {
          colour: connected ? "systemGreenColor" : "systemOrangeColor",
          font: { weight: "medium" },
        }),
        {},
        note(
          "howTo",
          "1. Create an internal integration at notion.so/my-integrations and copy its Internal Integration Secret.  2. Paste it below; it is kept in your macOS Keychain.  3. In Notion, open each page or database you want here: ⋯ → Connections → add the integration.",
        ),
        formLabel("Integration Secret"),
        {
          id: "secret",
          type: "passwordfield",
          focus: !connected,
          constraints: { size: { width: WIDTH } },
          events: [on("actioned", save)],
        },
        {},
        button("openIntegrations", "Open notion.so/my-integrations  ↗", {
          type: "json",
          src: { open: { type: "url", src: "https://www.notion.so/my-integrations" } },
        }),
        {},
        button("testConnection", "Test Connection", run("test-connection", [], true)),
      ]),
      footer({ text: "Save Secret  ⌘↩", action: save, shortcut: "⌘↩" }, message),
    ],
    shortcuts: [{ shortcut: "{var:actions_shortcut}", action: run("menu") }],
  };
};

export const loadingScreen = (text: string) => ({
  components: [
    header(title("Notion")),
    label("loading", text, { colour: MUTED, constraints: { region: "centre", position: "centre" } }),
    footer(undefined, ""),
  ],
  shortcuts: [],
});
