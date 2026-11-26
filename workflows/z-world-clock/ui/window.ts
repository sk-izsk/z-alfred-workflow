import type { State } from "../src/state.ts";
export type Json = Record<string, any>;
export const run = (command: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/wclock",
  args: [command, "{var:clock_session}", ...args],
  async,
});
export const label = (id: string, text: string, extra: Json = {}): Json => ({
  id,
  type: "label",
  text,
  ...extra,
});
export const button = (id: string, text: string, action: Json, extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [{ triggers: "actioned", action }],
  ...extra,
});
const selected = "{value:items.selected.uid}";
const cell = (grid: boolean): Json => ({
  height: grid ? 170 : 68,
  init: {
    "row.background": null,
    "clockTitle.colour": "labelColor",
    "clockTime.colour": "labelColor",
    "clockSubtitle.colour": "secondaryLabelColor",
    "clockMemo.colour": "secondaryLabelColor",
  },
  selected: {
    "row.background": "alfredSelectedResultBackgroundColor",
    "clockTitle.colour": "alfredSelectedResultTextColor",
    "clockTime.colour": "alfredSelectedResultTextColor",
    "clockSubtitle.colour": "alfredSelectedResultTextColor",
    "clockMemo.colour": "alfredSelectedResultTextColor",
  },
  root: {
    id: "row",
    type: "view",
    layout: "border",
    padding: grid ? 8 : 10,
    spacing: grid ? 4 : 12,
    cornerradius: 9,
    components: [
      {
        id: "clockImage",
        type: "imageview",
        image: { type: "file", src: "../icon.png" },
        constraints: {
          region: grid ? "top" : "left",
          position: "centre",
          size: { width: grid ? 85 : 42, height: grid ? 85 : 42 },
        },
      },
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 4,
        constraints: { region: "centre", position: grid ? "top" : "left", stretch: "horizontal" },
        components: [
          label("clockTitle", "", {
            font: { size: grid ? 12 : 15, weight: "medium" },
            textalign: grid ? "centre" : "left",
            linebreak: "truncatetail",
          }),
          ...(grid
            ? [
                label("clockTime", "", {
                  font: { size: 17, weight: "light" },
                  textalign: "centre",
                  linebreak: "truncatetail",
                }),
              ]
            : []),
          label("clockSubtitle", "", {
            font: { size: grid ? 10 : 12 },
            textalign: grid ? "centre" : "left",
            linebreak: "truncatetail",
          }),
          ...(grid ? [] : [label("clockMemo", "", { font: { size: 10 }, linebreak: "truncatetail" })]),
        ],
      },
      ...(grid
        ? []
        : [
            label("clockTime", "", {
              font: { size: 23, weight: "light" },
              textalign: "right",
              constraints: { region: "right", position: "centre", size: { width: 155 } },
            }),
          ]),
    ],
  },
});
const contents = (s: State): Json[] => [
  {
    type: "view",
    layout: "border",
    padding: 17,
    spacing: 14,
    constraints: { region: "top" },
    components: [
      {
        id: "search",
        type: "textfield",
        text: s.query,
        placeholder: "Search timezones, cities, countries or aliases…",
        background: null,
        bordered: false,
        focusring: false,
        focus: true,
        font: { size: 22, weight: "light" },
        constraints: { region: "centre" },
        events: [
          { triggers: "typingstopped", action: run("query", ["{value:self.text}"]) },
          { triggers: "actioned", action: run("copy", [selected]) },
        ],
      },
      {
        id: "filter",
        type: "picker",
        bordered: false,
        items: [
          { text: "All", value: "all" },
          { text: "★ Starred", value: "starred" },
          { text: "Other", value: "other" },
          ...[
            "Africa",
            "America",
            "Antarctica",
            "Asia",
            "Atlantic",
            "Australia",
            "Europe",
            "Indian",
            "Pacific",
          ].map((value) => ({ text: value, value })),
        ],
        selected: s.prefs.filter,
        constraints: { region: "right", size: { width: 150 } },
        events: [{ triggers: "changed", action: run("filter", ["{value:self.selected.value}"], false) }],
      },
    ],
  },
  {
    type: "view",
    layout: "border",
    padding: 12,
    constraints: { region: "top" },
    components: [
      label(
        "sectionTitle",
        `${s.prefs.stars.length} starred · ${s.prefs.layout === "grid" ? "Analog grid" : "World time"}`,
        {
          font: { size: 11, weight: "medium" },
          colour: "secondaryLabelColor",
          constraints: { region: "left" },
        },
      ),
      button("layoutButton", s.prefs.layout === "grid" ? "List View  ⌘L" : "Grid View  ⌘L", run("layout"), {
        font: { size: 11 },
        constraints: { region: "right" },
      }),
    ],
  },
  {
    id: "items",
    type: "dataview",
    cols: s.prefs.layout === "grid" ? s.prefs.columns : 1,
    padding: 10,
    spacing: s.prefs.layout === "grid" ? 8 : 3,
    data: { type: "basic", src: [] },
    placeholder: "No matching timezones",
    constraints: { region: "centre" },
    cell: cell(s.prefs.layout === "grid"),
    events: [
      { triggers: "changed", action: run("select", [selected], false) },
      { triggers: "actioned", action: run("copy", [selected]) },
    ],
  },
  {
    type: "view",
    layout: "border",
    padding: 15,
    spacing: 12,
    constraints: { region: "bottom" },
    components: [
      label("statusLabel", "Offline IANA timezones · starred first", {
        font: { size: 11 },
        colour: "secondaryLabelColor",
        linebreak: "truncatetail",
        constraints: { region: "centre", stretch: "horizontal" },
      }),
      {
        type: "view",
        layout: "inline",
        spacing: 12,
        constraints: { region: "right" },
        components: [
          button("back", "Back  {var:back_label}", run("back", [], false), {
            shortcut: "{var:back_shortcut}",
          }),
          button("copyButton", "Copy Time  ↩", run("copy", [selected])),
          button("actionsButton", "Actions  {var:actions_label}", run("menu", [selected])),
        ],
      },
    ],
  },
];
export const components = (s: State): Json[] => {
  const [header, section, items, footer] = contents(s);
  return [
    {
      type: "view",
      layout: "border",
      constraints: { region: "top" },
      components: [header, { ...section, constraints: { region: "bottom" } }],
    },
    items!,
    footer!,
  ];
};
export const clockShortcuts: Json[] = [
  ...["↑", "↓", "←", "→"].map((shortcut, i) => ({
    shortcut,
    action: {
      type: "function",
      src: "items",
      args: ["selectup", "selectdown", "selectleft", "selectright"][i],
    },
  })),
  { shortcut: "{var:actions_shortcut}", action: run("menu", [selected]) },
  { shortcut: "⌘L", action: run("layout") },
  { shortcut: "⌘R", action: run("refresh") },
];
export const clockWindow = {
  bundleid: "com.izsk.world-clock",
  variablesconfig: {
    swiss_return: { default: "" },
    clock_session: { default: "", scriptenv: true },
    clock_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "World Clock",
    size: { height: 650 },
    minsize: { width: 900, height: 600 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      shortcuts: clockShortcuts,
      events: [
        { triggers: "preload", action: { type: "json", src: { window: { resize: { width: 1000 } } } } },
        { triggers: "launched", action: [run("prepare-origin", [], false), run("launch")] },
      ],
      components: [
        label("statusLabel", "Loading world clocks…", {
          constraints: { region: "centre", position: "centre" },
        }),
        button(
          "initialBack",
          "Back  {var:back_label}",
          {
            type: "json",
            src: { finish: { variables: { clock_out: "back", swiss_return: "{var:swiss_return}" } } },
          },
          {
            shortcut: "{var:back_shortcut}",
            constraints: { region: "bottom", position: "left", insets: { left: 16, bottom: 16 } },
          },
        ),
      ],
    },
  },
};
