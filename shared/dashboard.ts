import { STANDARD_WIDTH, DEFAULT_BACK, BACK_LABEL } from "./ui-profile.ts";
export type Json = Record<string, any>;
export type Dashboard = {
  bundle: string;
  cli: string;
  title: string;
  placeholder: string;
  details?: boolean;
  primary?: string;
};
export const dashboard = (d: Dashboard) => {
  const run = (cmd: string, args: string[] = [], async = true): Json => ({
    type: "script",
    src: `../bin/${d.cli}`,
    args: [cmd, `{var:${d.cli}_session}`, ...args],
    async,
  });
  const row = {
    height: 64,
    init: {
      "row.background": null,
      "rowTitle.colour": "labelColor",
      "rowDescription.colour": "secondaryLabelColor",
    },
    selected: {
      "row.background": "alfredSelectedResultBackgroundColor",
      "rowTitle.colour": "alfredSelectedResultTextColor",
      "rowDescription.colour": "alfredSelectedResultTextColor",
    },
    root: {
      id: "row",
      type: "view",
      layout: "border",
      padding: 10,
      spacing: 10,
      cornerradius: 8,
      components: [
        {
          id: "rowIcon",
          type: "imageview",
          image: { type: "symbol", src: "square.grid.2x2" },
          constraints: { region: "left", position: "centre", size: { width: 24, height: 24 } },
        },
        {
          type: "view",
          layout: "border",
          constraints: { region: "centre" },
          components: [
            {
              id: "rowTitle",
              type: "label",
              text: "",
              font: { size: 15, weight: "medium" },
              linebreak: "truncatetail",
              constraints: { region: "top" },
            },
            {
              id: "rowDescription",
              type: "label",
              text: "",
              font: { size: 11 },
              linebreak: "truncatetail",
              constraints: { region: "bottom" },
            },
          ],
        },
      ],
    },
  };
  const list: Json = {
    id: "items",
    type: "dataview",
    padding: 8,
    spacing: 3,
    data: { type: "basic", src: [] },
    placeholder: "Loading…",
    constraints: d.details ? { region: "left", size: { width: 225 } } : { region: "centre" },
    cell: row,
    events: [
      { triggers: "changed", action: run("select", ["{value:self.selected.uid}"], false) },
      { triggers: "actioned", action: run("open", ["{value:self.selected.uid}"]) },
    ],
  };
  const components = (query = ""): Json[] => [
    {
      type: "view",
      layout: "border",
      padding: 16,
      constraints: { region: "top" },
      components: [
        {
          id: "query",
          type: "textfield",
          text: query,
          placeholder: d.placeholder,
          focus: true,
          bordered: false,
          focusring: false,
          background: null,
          font: { size: 23, weight: "light" },
          constraints: { region: "centre" },
          events: [
            { triggers: "typingstopped", action: run("query", ["{value:self.text}"]) },
            { triggers: "actioned", action: run("open", ["{value:items.selected.uid}"]) },
          ],
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      spacing: 12,
      constraints: { region: "centre" },
      components: [
        list,
        ...(d.details
          ? [
              {
                id: "details",
                type: "dataview",
                padding: 10,
                spacing: 4,
                constraints: { region: "centre" },
                data: { type: "basic", src: [] },
                cell: {
                  height: 45,
                  root: {
                    type: "view",
                    layout: "border",
                    padding: 7,
                    spacing: 12,
                    components: [
                      {
                        id: "detailName",
                        type: "label",
                        text: "",
                        font: { size: 12 },
                        colour: "secondaryLabelColor",
                        linebreak: "truncatetail",
                        constraints: { region: "left", size: { width: 125 } },
                      },
                      {
                        id: "detailValue",
                        type: "label",
                        text: "",
                        font: { size: 13 },
                        textalign: "right",
                        linebreak: "truncatetail",
                        constraints: { region: "centre" },
                      },
                    ],
                  },
                },
              },
            ]
          : []),
      ],
    },
    {
      type: "view",
      layout: "border",
      padding: 12,
      spacing: 8,
      constraints: { region: "bottom" },
      components: [
        {
          id: "statusLabel",
          type: "label",
          text: d.title,
          font: { size: 10 },
          colour: "secondaryLabelColor",
          linebreak: "truncatetail",
          constraints: { region: "centre", stretch: "horizontal" },
        },
        {
          type: "view",
          layout: "inline",
          spacing: 10,
          constraints: { region: "right" },
          components: [
            {
              id: "back",
              type: "button",
              text: "Back  {var:back_label}",
              shortcut: "{var:back_shortcut}",
              bordered: false,
              events: [{ triggers: "actioned", action: run("back", [], false) }],
            },
            {
              id: "primary",
              type: "button",
              text: d.primary || "Open  ↩",
              bordered: false,
              events: [{ triggers: "actioned", action: run("open", ["{value:items.selected.uid}"]) }],
            },
            {
              id: "actionsButton",
              type: "button",
              text: "Actions  {var:actions_label}",
              bordered: false,
              events: [{ triggers: "actioned", action: run("menu", ["{value:items.selected.uid}"]) }],
            },
          ],
        },
      ],
    },
  ];
  return {
    run,
    components,
    window: {
      bundleid: d.bundle,
      variablesconfig: {
        swiss_return: { default: "" },
        [`${d.cli}_session`]: { default: "", scriptenv: true },
        [`${d.cli}_query`]: { src: "args[0]", default: "", scriptenv: true },
        back_shortcut: { src: "variable", default: DEFAULT_BACK },
        back_label: { default: BACK_LABEL },
        actions_label: { default: "⌘K" },
        actions_shortcut: { src: "variable", default: "⌘K" },
      },
      window: {
        title: d.title,
        size: { width: STANDARD_WIDTH, height: 540 },
        minsize: { width: 560, height: 380 },
        root: {
          id: "root",
          type: "view",
          layout: "border",
          events: [{ triggers: "launched", action: [run("prepare-origin", [], false), run("launch")] }],
          shortcuts: [
            { shortcut: "↑", action: { type: "function", src: "items", args: "selectprevious" } },
            { shortcut: "↓", action: { type: "function", src: "items", args: "selectnext" } },
            { shortcut: "{var:actions_shortcut}", action: run("menu", ["{value:items.selected.uid}"]) },
            { shortcut: "⌘R", action: run("refresh") },
          ],
          components: [
            {
              id: "statusLabel",
              type: "label",
              text: `Loading ${d.title}…`,
              constraints: { region: "centre", position: "centre" },
            },
            {
              id: "initialBack",
              type: "button",
              text: "Back  {var:back_label}",
              shortcut: "{var:back_shortcut}",
              bordered: false,
              constraints: { region: "bottom", position: "left", insets: { left: 12, bottom: 12 } },
              events: [
                {
                  triggers: "actioned",
                  action: {
                    type: "json",
                    src: {
                      finish: { variables: { [`${d.cli}_out`]: "back", swiss_return: "{var:swiss_return}" } },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };
};
export const detailRows = (rows: [string, string][]): Json[] =>
  rows.map(([name, value], i) => ({
    uid: String(i),
    "detailName.text": name,
    "detailValue.text": value,
    "detailValue.tooltip": value,
  }));
