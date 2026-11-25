import { type Field, type FormState, type Json, type Row, type Session, type View } from "../src/model.ts";
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/gith",
  args: [cmd, "{var:g_session}", ...args],
  async,
});
export const json = (src: Json): Json => ({ type: "json", src });
export const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
export const button = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});
const label = (id: string, text: string, extra: Json = {}): Json => ({ id, type: "label", text, ...extra });
const chosen = "{value:items.selected.uid}";
const act = (name: string) => run("action", [name, chosen]);
const hidden = (id: string, shortcut: string, action: Json): Json =>
  button(id, "", action, { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });
export const rowData = (r: Row): Json => ({
  uid: r.id,
  match: `${r.title} ${r.subtitle}`,
  "rowTitle.text": r.title,
  "rowSubtitle.text": r.subtitle,
  "rowAccessory.text": r.accessory,
  "rowIcon.image": {
    type: r.icon.includes("/") ? "file" : "symbol",
    src: r.icon.includes("/") ? `../assets/${r.icon}` : r.icon,
    size: { width: 23, height: 23 },
  },
  "rowIcon.contenttintcolour": r.colour || "labelColor",
});
const statusOptions = (v: View): { text: string; value: string }[] => {
  const values =
    v.mode === "local"
      ? ["all", "repo", "worktree", "submodule"]
      : v.mode === "notifications"
        ? ["all", "unread"]
        : v.mode === "packages"
          ? ["all", "container", "npm", "maven", "docker", "nuget", "rubygems"]
          : v.mode.endsWith("prs")
            ? ["all", "open", "draft", "merged", "closed"]
            : ["all", "open", "closed"];
  return values.map((value) => ({ text: value[0]!.toUpperCase() + value.slice(1), value }));
};
export const listComponents = (s: Session, repos: { text: string; value: string }[] = []): Json[] => {
  const v = s.view,
    options = statusOptions(v);
  const selected = options.some((o) => o.value === v.status) ? v.status : options[0]!.value;
  return [
    {
      type: "view",
      layout: "border",
      padding: 16,
      spacing: 12,
      constraints: { region: "top" },
      components: [
        button("backButton", "‹", run("back", [], false), {
          font: { size: 28 },
          tooltip: "Back {var:back_shortcut}",
          constraints: { region: "left", position: "centre" },
        }),
        {
          id: "search",
          background: null,
          type: "textfield",
          text: v.query,
          placeholder:
            v.mode === "runs"
              ? "Filter by title, branch, or commit…"
              : v.mode === "local"
                ? "Search repositories…"
                : "Search…",
          focus: true,
          bordered: false,
          focusring: false,
          font: { size: 21 },
          constraints: { region: "centre" },
          events: [
            on("typingstopped", run("search", ["{value:search.text}"])),
            on("actioned", act("primary")),
          ],
        },
        {
          id: "repoPicker",
          type: "picker",
          bordered: false,
          selected: v.repo,
          items: [{ text: "All Repositories", value: "" }, ...repos],
          constraints: { region: "right", position: "centre" },
          events: [on("changed", run("repository", ["{value:repoPicker.selected.value}"]))],
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      padding: 12,
      spacing: 12,
      constraints: { region: "centre" },
      components: [
        {
          type: "view",
          layout: "border",
          constraints: { region: "top" },
          components: [
            label("sectionTitle", `${v.title}  ${v.rows.length}`, {
              colour: "secondaryLabelColor",
              font: { size: 12 },
              constraints: { region: "left", position: "centre" },
            }),
            {
              type: "view",
              layout: "inline",
              spacing: 12,
              constraints: { region: "right" },
              components: [
                {
                  id: "statusPicker",
                  type: "picker",
                  bordered: false,
                  selected,
                  items: options,
                  events: [on("changed", run("status", ["{value:statusPicker.selected.value}"]))],
                },
                ...(v.mode.startsWith("my-")
                  ? [
                      {
                        id: "relationPicker",
                        type: "picker",
                        bordered: false,
                        selected: v.relation,
                        items: [
                          ["Created by me", "created"],
                          ["Assigned to me", "assigned"],
                          ["Mentioning me", "mentioned"],
                          ["Review requested", "review"],
                          ["Reviewed by me", "reviewed"],
                          ["Involving me", "involved"],
                        ].map(([text, value]) => ({ text, value })),
                        events: [on("changed", run("relation", ["{value:relationPicker.selected.value}"]))],
                      },
                    ]
                  : []),
                {
                  id: "sortPicker",
                  type: "picker",
                  bordered: false,
                  selected: v.sort,
                  items: [
                    { text: "Updated", value: "updated" },
                    { text: "Created", value: "created" },
                    { text: "Comments / stars", value: v.mode === "repos" ? "stars" : "comments" },
                  ],
                  events: [on("changed", run("sort", ["{value:sortPicker.selected.value}"]))],
                },
              ],
            },
          ],
        },
        {
          id: "items",
          type: "dataview",
          padding: 2,
          spacing: 3,
          select: v.selected || v.rows[0]?.id || "",
          placeholder: "No results. Change the search or filters.",
          constraints: { region: "centre" },
          data: { type: "basic", src: v.rows.map(rowData) },
          events: [on("changed", run("selected", [chosen], false)), on("actioned", act("primary"))],
          cell: {
            height: 56,
            init: {
              "row.background": null,
              "rowTitle.colour": "labelColor",
              "rowSubtitle.colour": "secondaryLabelColor",
              "rowAccessory.colour": "secondaryLabelColor",
            },
            selected: {
              "row.background": "alfredSelectedResultBackgroundColor",
              "rowTitle.colour": "alfredSelectedResultTextColor",
              "rowSubtitle.colour": "alfredSelectedResultTextColor",
              "rowAccessory.colour": "alfredSelectedResultTextColor",
            },
            root: {
              id: "row",
              type: "view",
              layout: "border",
              padding: 9,
              spacing: 10,
              cornerradius: 9,
              components: [
                {
                  id: "rowIcon",
                  type: "imageview",
                  image: { type: "symbol", src: "circle", size: { width: 23, height: 23 } },
                  constraints: { region: "left", position: "centre" },
                },
                {
                  type: "view",
                  layout: "border",
                  constraints: { region: "centre", position: "centre", stretch: "horizontal" },
                  components: [
                    label("rowTitle", "", {
                      font: { size: 14, weight: "medium" },
                      constraints: { region: "top" },
                    }),
                    label("rowSubtitle", "", { font: { size: 11.5 }, constraints: { region: "bottom" } }),
                  ],
                },
                label("rowAccessory", "", {
                  font: { size: 12 },
                  textalign: "right",
                  constraints: { region: "right", position: "centre", size: { width: 150 } },
                }),
              ],
            },
          },
        },
      ],
    },
    {
      type: "view",
      layout: "stack",
      constraints: { region: "bottom" },
      components: [
        {
          type: "view",
          layout: "border",
          padding: 13,
          components: [
            label("statusLabel", v.notice || "GitHub", {
              font: { size: 11.5 },
              colour: "secondaryLabelColor",
              constraints: { region: "centre", position: "left", stretch: "horizontal" },
            }),
            {
              type: "view",
              layout: "inline",
              spacing: 12,
              constraints: { region: "right" },
              components: [
                button("footerBack", "Back  {var:back_shortcut}", run("back", [], false), {
                  shortcut: "{var:back_shortcut}",
                }),
                ...(v.more ? [button("moreButton", "Load More", run("more"))] : []),
                button(
                  "primaryButton",
                  v.mode === "local" ? "Open  ↩" : "Open in Browser  ↩",
                  act("primary"),
                  { shortcut: "↩" },
                ),
                button("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
              ],
            },
          ],
        },
        hidden("copyKey", "⌘C", act("copy-url")),
        hidden("detailKey", "⌘D", act("detail")),
      ],
    },
  ];
};
const control = (f: Field, form: FormState): Json => {
  const common = {
    id: `f_${f.name}`,
    constraints: { region: "centre" },
    ...(f === visibleFields(form)[0] ? { focus: true } : {}),
  };
  const value = form.values[f.name] || "";
  if (f.type === "picker")
    return {
      ...common,
      type: "picker",
      items: f.options || [],
      selected: value,
      ...(f.name === "repository" ? { events: [on("changed", run("form-repository", formArgs(form)))] } : {}),
    };
  if (f.type === "check")
    return { ...common, type: "checkbox", text: f.title, checked: value === "1" || value === "true" };
  if (f.type === "area")
    return {
      ...common,
      type: "textarea",
      text: value,
      editable: true,
      selectable: true,
      bordertype: "bezel",
      disableallsubstitutions: true,
      constraints: { region: "centre", size: { width: 520, height: 110 } },
    };
  return { ...common, type: "textfield", text: value, placeholder: f.placeholder || "", bordered: true };
};
export const visibleFields = (form: FormState): Field[] =>
  form.fields.slice(Number(form.values.formPage || 0) * 7, Number(form.values.formPage || 0) * 7 + 7);
export const formArgs = (form: FormState): string[] =>
  visibleFields(form).flatMap((f) => [
    f.name,
    `{value:f_${f.name}.${f.type === "picker" ? "selected.value" : f.type === "check" ? "checked" : "text"}}`,
  ]);
export const formSheet = (form: FormState): Json => {
  const page = Number(form.values.formPage || 0),
    pages = Math.max(1, Math.ceil(form.fields.length / 7));
  return {
    sheet: {
      id: "formSheet",
      closeonescape: true,
      root: {
        id: "formRoot",
        type: "view",
        layout: "border",
        padding: 24,
        spacing: 18,
        components: [
          label("formTitle", `${form.title}${pages > 1 ? ` · ${page + 1}/${pages}` : ""}`, {
            font: { size: 20, weight: "semibold" },
            constraints: { region: "top" },
          }),
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 15,
            constraints: { region: "centre" },
            components: visibleFields(form).map((f) => ({
              type: "view",
              layout: "border",
              spacing: 16,
              constraints: { size: { width: 720 } },
              components: [
                label(`label_${f.name}`, f.type === "check" ? "" : f.title, {
                  textalign: "right",
                  colour: "secondaryLabelColor",
                  constraints: { region: "left", position: "centre", size: { width: 140 } },
                }),
                control(f, form),
              ],
            })),
          },
          {
            type: "view",
            layout: "border",
            constraints: { region: "bottom" },
            components: [
              label("formError", "", {
                colour: "systemRedColor",
                font: { size: 12 },
                constraints: { region: "top" },
              }),
              button("formCancel", "Back  {var:back_shortcut}", run("form-back", formArgs(form), false), {
                shortcut: "{var:back_shortcut}",
                constraints: { region: "left" },
              }),
              {
                type: "view",
                layout: "inline",
                spacing: 14,
                constraints: { region: "right" },
                components: [
                  ...(page
                    ? [button("formPrevious", "Previous", run("form-page", ["-1", ...formArgs(form)]))]
                    : []),
                  button(
                    "formSubmit",
                    page < pages - 1 ? "Next" : form.title,
                    [
                      json({ update: { ids: { formSubmit: { enabled: false } } } }),
                      run(page < pages - 1 ? "form-page" : "submit", [
                        ...(page < pages - 1 ? ["1"] : []),
                        ...formArgs(form),
                      ]),
                    ],
                    { shortcut: "⌘↩", bordered: true },
                  ),
                ],
              },
            ],
          },
        ],
      },
    },
  };
};
export const detailSheet = (title: string, markdown: string): Json => ({
  sheet: {
    id: "detailSheet",
    closeonescape: true,
    root: {
      type: "view",
      layout: "border",
      padding: 18,
      spacing: 12,
      components: [
        label("detailTitle", title, {
          font: { size: 18, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          id: "detailContent",
          type: "markdownarea",
          text: markdown,
          constraints: { region: "centre", size: { width: 800, height: 460 } },
        },
        button("detailClose", "Back  {var:back_shortcut}", json({ sheet: { close: "detailSheet" } }), {
          shortcut: "{var:back_shortcut}",
          constraints: { region: "bottom" },
        }),
      ],
    },
  },
});
export const githubWindow = {
  bundleid: "com.izsk.github",
  log: { level: "error", internal: true },
  variablesconfig: {
    g_session: { default: "", scriptenv: true },
    g_mode: { src: "variable", default: "repos", scriptenv: true },
    g_form: { src: "variable", default: "", scriptenv: true },
    g_query: { src: "args[0]", default: "", scriptenv: true },
    actions_shortcut: { src: "variable", default: "⌘K" },
    back_shortcut: { src: "variable", default: "⌘[" },
  },
  window: {
    title: "GitHub",
    size: { height: 630 },
    minsize: { width: 760, height: 520 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [on("preload", json({ window: { resize: { width: 1040 } } })), on("launched", run("launch"))],
      shortcuts: [
        { shortcut: "{var:actions_shortcut}", action: act("menu") },
        { shortcut: "⌘R", action: run("refresh") },
        { shortcut: "↓", action: { type: "function", src: "items", args: "selectnext" } },
        { shortcut: "↑", action: { type: "function", src: "items", args: "selectprevious" } },
      ],
      components: [
        {
          type: "view",
          layout: "border",
          padding: 20,
          constraints: { region: "top" },
          components: [
            button("initialBack", "‹", json({ finish: { variables: { github_out: "back" } } }), {
              font: { size: 26 },
              tooltip: "Back to Alfred Search",
              constraints: { region: "left", position: "centre" },
            }),
            label("loadingHeading", "GitHub", {
              font: { size: 20, weight: "medium" },
              constraints: { region: "centre", position: "centre" },
            }),
          ],
        },
        {
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 14,
          padding: 24,
          constraints: { region: "centre", position: "centre", size: { width: 420, height: 130 } },
          components: [
            {
              type: "imageview",
              image: { type: "symbol", src: "arrow.triangle.2.circlepath", size: { width: 30, height: 30 } },
              contenttintcolour: "systemBlueColor",
            },
            label("statusLabel", "Loading GitHub…", {
              font: { size: 16, weight: "medium" },
              textalign: "centre",
              constraints: { size: { width: 380 } },
            }),
          ],
        },
        {
          type: "view",
          layout: "border",
          padding: 16,
          constraints: { region: "bottom" },
          components: [
            button(
              "loadingBack",
              "Back  {var:back_shortcut}",
              json({ finish: { variables: { github_out: "back" } } }),
              { shortcut: "{var:back_shortcut}", constraints: { region: "right" } },
            ),
            label("loadingHint", "Connecting with GitHub CLI", {
              colour: "secondaryLabelColor",
              font: { size: 12 },
              constraints: { region: "left" },
            }),
          ],
        },
      ],
    },
  },
};

export const updateForm = (form: FormState): Json => ({
  update: {
    relayout: true,
    ids: { formRoot: { components: ((formSheet(form).sheet as Json).root as Json).components } },
  },
});
