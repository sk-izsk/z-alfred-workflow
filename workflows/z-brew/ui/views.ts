import {
  button,
  call,
  footer,
  header,
  hiddenKey,
  key,
  label,
  on,
  run,
  selected,
  selection,
  window,
  type Json,
} from "./shared.ts";
export const MODES = [
  "installed",
  "search",
  "upgrades",
  "adopt",
  "services",
  "taps",
  "doctor",
  "vulns",
  "maintenance",
] as const;
const act = (action: string) => run(["action", action, selected("items")]);
const refresh = (mode: string) => run(["load", mode, "refresh"], { async: true });

const cell: Json = {
  type: "view",
  id: "rowCell",
  layout: "border",
  padding: 9,
  spacing: 10,
  cornerradius: 7,
  events: [on("doubleclicked", run(["action", "primary", "{data:uid}"]))],
  components: [
    {
      id: "rowIcon",
      type: "imageview",
      image: { type: "symbol", src: "circle", size: { width: 23, height: 23 } },
      constraints: { region: "left", position: "centre", size: { width: 26, height: 26 } },
    },
    {
      type: "view",
      layout: "border",
      constraints: { region: "centre", position: "centre", stretch: "horizontal", size: { height: 38 } },
      components: [
        label("rowTitle", {
          font: { size: 14, weight: "medium" },
          linebreak: "truncatetail",
          constraints: { region: "top" },
        }),
        label("rowDesc", {
          font: { size: 11.5 },
          colour: "secondaryLabelColor",
          linebreak: "truncatetail",
          constraints: { region: "bottom" },
        }),
      ],
    },
    {
      type: "view",
      layout: "inline",
      spacing: 9,
      constraints: { region: "right", position: "centre" },
      components: [
        {
          id: "rowPin",
          type: "imageview",
          image: { type: "symbol", src: "pin.fill", size: { width: 11, height: 13 } },
          contenttintcolour: "secondaryLabelColor",
        },
        label("rowStatus", {
          font: { size: 11.5, weight: "semibold" },
          linebreak: "truncatetail",
          constraints: { size: { width: 86 } },
        }),
        label("rowVersion", {
          font: { size: 11.5 },
          linebreak: "truncatetail",
          textalign: "right",
          constraints: { size: { width: 120 } },
        }),
      ],
    },
  ],
};
const details: Json = {
  type: "view",
  layout: "border",
  spacing: 10,
  padding: 12,
  constraints: { region: "right", size: { width: 320 } },
  components: [
    { type: "view", background: "separatorColor", constraints: { region: "left", size: { width: 1 } } },
    {
      id: "details",
      type: "dataview",
      spacing: 3,
      padding: 4,
      placeholder: "Select a package to see its details",
      constraints: { region: "centre" },
      data: { type: "basic", src: [] },
      behaviour: { selection: { allowempty: true } },
      cell: {
        height: 56,
        root: {
          type: "view",
          layout: "border",
          spacing: 4,
          padding: 5,
          components: [
            label("detailCaption", {
              font: { size: 11 },
              colour: "secondaryLabelColor",
              constraints: { region: "top" },
            }),
            label("detailValue", {
              font: { size: 12 },
              linebreak: "truncatetail",
              constraints: { region: "centre" },
            }),
          ],
        },
      },
    },
  ],
};
const selectors = (mode: string): Json => ({
  type: "view",
  layout: "inline",
  spacing: 8,
  components: [
    {
      id: "typePicker",
      type: "picker",
      hidden: ["adopt", "services", "taps"].includes(mode),
      bordered: false,
      items: [
        { text: "All", value: "all" },
        { text: "Formulae", value: "formula" },
        { text: "Casks", value: "cask" },
      ],
      events: [
        on(
          "changed",
          run([
            "filter",
            "{value:typePicker.selected.value}",
            "{value:statusPicker.selected.value}",
            "{value:searchField.text}",
          ]),
        ),
      ],
    },
    {
      id: "statusPicker",
      type: "picker",
      bordered: false,
      hidden: ["services", "taps"].includes(mode),
      items:
        mode === "adopt"
          ? [
              { text: "Candidates", value: "all" },
              { text: "Ignored", value: "ignored" },
            ]
          : [
              { text: "Any status", value: "all" },
              { text: "Outdated", value: "outdated" },
              { text: "Pinned", value: "pinned" },
              { text: "Needs attention", value: "attention" },
            ],
      events: [
        on(
          "changed",
          run([
            "filter",
            "{value:typePicker.selected.value}",
            "{value:statusPicker.selected.value}",
            "{value:searchField.text}",
          ]),
        ),
      ],
    },
  ],
});
export const listWindow = (mode: string, title: string): Json =>
  window(
    title,
    {
      events: [on("launched", run(["load", mode], { async: true }))],
      shortcuts: [
        key("↑", call("items", "selectprevious")),
        key("↓", call("items", "selectnext")),
        key("{var:actions_shortcut}", act("menu")),
        key("⌘R", refresh(mode)),
        key("⌘F", { type: "json", src: { update: { ids: { searchField: { focus: true } } } } }),
      ],
      components: [
        header(
          {
            id: "searchField",
            type: "textfield",
            text: "{var:brew_query}",
            placeholder: mode === "search" ? "Search formulae or casks…" : "Filter packages…",
            background: null,
            bordered: false,
            focusring: false,
            focus: true,
            font: { size: 24, weight: "light" },
            events: [
              on(
                mode === "search" ? "typingstopped" : "changed",
                run([
                  "filter",
                  "{value:typePicker.selected.value}",
                  "{value:statusPicker.selected.value}",
                  "{value:self.text}",
                ]),
              ),
              on("actioned", act("primary")),
            ],
          },
          selectors(mode),
        ),
        {
          type: "view",
          layout: "border",
          padding: 6,
          constraints: { region: "centre" },
          components: [
            {
              id: "items",
              type: "dataview",
              padding: 4,
              spacing: 2,
              constraints: { region: "centre" },
              placeholder: "Loading Homebrew…",
              data: { type: "basic", src: [] },
              cell: {
                height: 58,
                root: cell,
                ...selection("rowCell", ["rowTitle", "rowDesc", "rowVersion"]),
              },
              events: [
                on("changed", [
                  run(["selected", selected("items")], { async: true }),
                  run(["hydrate", selected("items")], { async: true }),
                ]),
                on("actioned", act("primary")),
              ],
            },
            ...(mode === "search" ? [details] : []),
          ],
        },
        footer(
          [
            button(
              "primaryButton",
              mode === "upgrades" ? "Upgrade Selected" : "Show Details  ↩",
              act("primary"),
            ),
            button("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
            hiddenKey("previewKey", "⌥⌘I", act("preview")),
            hiddenKey("upgradeKey", "⇧⌘U", act("upgrade")),
            hiddenKey("pinKey", "⌘.", act("pin")),
            hiddenKey("selectKey", "⇧⌘X", act("toggle")),
            hiddenKey("refreshKey", "⇧⌘R", refresh(mode)),
          ],
          true,
        ),
      ],
    },
    {
      brew_window: { default: "", scriptenv: true },
      brew_type: { default: "all", scriptenv: true },
      brew_status: { default: "all", scriptenv: true },
      brew_search: { default: "", scriptenv: true },
    },
    { width: mode === "search" ? 1000 : 900, height: 580, minHeight: 420 },
  );

export const reportWindow = (mode: string, title: string): Json =>
  window(
    title,
    {
      events: [on("launched", run(["load", mode], { async: true }))],
      shortcuts: [key("⌘R", refresh(mode)), key("{var:actions_shortcut}", run(["report-menu"]))],
      components: [
        header(label("reportTitle", { text: title, font: { size: 23, weight: "medium" } })),
        {
          id: "reportText",
          type: "textarea",
          text: "Loading…",
          background: null,
          editable: false,
          selectable: true,
          font: { size: 13 },
          colour: "labelColor",
          constraints: { region: "centre", insets: { left: 20, right: 20, top: 8, bottom: 12 } },
        },
        footer(
          [
            ...(mode === "maintenance"
              ? [button("reviewAction", "Review Action", run(["maintenance-action"]))]
              : [button("copyReport", "Copy Report", run(["report-copy"]))]),
            button("actionsButton", "Actions  {var:actions_shortcut}", run(["report-menu"])),
          ],
          true,
        ),
      ],
    },
    { brew_window: { default: "", scriptenv: true } },
    { width: 900, height: 580, minHeight: 420 },
  );
export const packages = {
  "installed.alfredui": listWindow("installed", "Installed Packages"),
  "search.alfredui": listWindow("search", "Search Homebrew"),
  "upgrades.alfredui": listWindow("upgrades", "Available Upgrades"),
  "adopt.alfredui": listWindow("adopt", "Adopt Apps"),
  "services.alfredui": listWindow("services", "Homebrew Services"),
  "taps.alfredui": listWindow("taps", "Homebrew Taps"),
  "doctor.alfredui": reportWindow("doctor", "Homebrew Doctor"),
  "vulns.alfredui": reportWindow("vulns", "Vulnerability Scan"),
  "maintenance.alfredui": reportWindow("maintenance", "Homebrew Maintenance"),
};
