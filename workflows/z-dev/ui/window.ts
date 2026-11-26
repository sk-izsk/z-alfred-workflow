import type { State } from "../src/state.ts";
export type Json = Record<string, any>;
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/dev",
  args: [cmd, "{var:dev_session}", ...args],
  async,
});
export const components = (s: State): Json[] => [
  {
    type: "view",
    layout: "border",
    padding: 18,
    spacing: 12,
    constraints: { region: "top" },
    components: [
      {
        id: "query",
        type: "textfield",
        text: s.query,
        placeholder: "Search tools…",
        background: null,
        bordered: false,
        focusring: false,
        focus: true,
        font: { size: 23, weight: "light" },
        constraints: { region: "centre" },
        events: [
          { triggers: "changed", action: run("query", ["{value:self.text}"], false) },
          { triggers: "actioned", action: run("open", ["{value:items.selected.uid}"]) },
        ],
      },
    ],
  },
  {
    id: "items",
    type: "dataview",
    padding: 10,
    spacing: 4,
    data: { type: "basic", src: [] },
    placeholder: "No matching tools",
    constraints: { region: "centre" },
    events: [
      { triggers: "changed", action: run("select", ["{value:self.selected.uid}"], false) },
      { triggers: "actioned", action: run("open", ["{value:self.selected.uid}"]) },
    ],
    cell: {
      height: 72,
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
        padding: 12,
        spacing: 14,
        cornerradius: 8,
        components: [
          {
            id: "rowFlag",
            type: "imageview",
            image: { type: "file", src: "../icon.png" },
            constraints: { region: "left", position: "centre", size: { width: 40 } },
          },
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 6,
            constraints: { region: "centre", position: "left", stretch: "horizontal" },
            components: [
              {
                id: "rowTitle",
                type: "label",
                text: "",
                font: { size: 19, weight: "medium" },
                linebreak: "truncatetail",
              },
              {
                id: "rowDescription",
                type: "label",
                text: "",
                font: { size: 12 },
                linebreak: "truncatetail",
              },
            ],
          },
        ],
      },
    },
  },
  {
    type: "view",
    layout: "border",
    padding: 15,
    spacing: 12,
    constraints: { region: "bottom" },
    components: [
      {
        id: "statusLabel",
        type: "label",
        text: "Independent tools · open one to begin",
        font: { size: 11 },
        colour: "secondaryLabelColor",
        linebreak: "truncatetail",
        constraints: { region: "centre", stretch: "horizontal" },
      },
      {
        type: "view",
        layout: "inline",
        spacing: 12,
        constraints: { region: "right" },
        components: [
          {
            id: "back",
            type: "button",
            text: "Back  {var:back_label}",
            bordered: false,
            shortcut: "{var:back_shortcut}",
            events: [{ triggers: "actioned", action: run("back", [], false) }],
          },
          {
            id: "copyButton",
            type: "button",
            text: "Open  ↩",
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
export const devWindow = {
  bundleid: "com.izsk.dev",
  variablesconfig: {
    dev_session: { default: "", scriptenv: true },
    dev_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "Dev",
    size: { height: 580 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [{ triggers: "launched", action: run("launch") }],
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
          text: "Loading Dev…",
          constraints: { region: "centre", position: "centre" },
        },
        {
          id: "initialBack",
          type: "button",
          text: "Back  {var:back_label}",
          bordered: false,
          shortcut: "{var:back_shortcut}",
          constraints: { region: "bottom", position: "right", insets: { right: 16, bottom: 16 } },
          events: [
            {
              triggers: "actioned",
              action: { type: "json", src: { finish: { variables: { dev_out: "back" } } } },
            },
          ],
        },
      ],
    },
  },
};
