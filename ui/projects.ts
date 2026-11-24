import {
  arrows,
  body,
  divider,
  footer,
  footerButton,
  hiddenKey,
  inlineLabel,
  json,
  key,
  list,
  on,
  pill,
  row,
  run,
  searchBar,
  sectionTitle,
  sel,
  selectionColours,
  symbol,
  window,
} from "./shared.ts";

const act = (action: string) => run(["project", action, sel("items")]);

const cell = row({
  doubleClick: run(["project", "open", "{data:uid}"]),
  right: [
    symbol("rowPin", "pin.fill", { tooltip: "Pinned", contenttintcolour: "systemOrangeColor" }),
    symbol("rowDirty", "circle.fill", {
      tooltip: "Uncommitted changes",
      image: { type: "symbol", src: "circle.fill", size: { height: 7 } },
      contenttintcolour: "systemOrangeColor",
    }),
    inlineLabel("rowSync", { colour: "secondaryLabelColor", font: { size: 12, monospaced: "digits" } }),
    pill(
      "rowBranchPill",
      [
        symbol("rowBranchIcon", "arrow.triangle.branch", {
          image: { type: "symbol", src: "arrow.triangle.branch", size: { height: 11 } },
          contenttintcolour: "systemGreenColor",
        }),
        inlineLabel("rowBranch", { colour: "systemGreenColor", font: { size: 12, weight: "medium" } }),
      ],
      "#34c7591f",
    ),
  ],
});

export const projects = window(
  "Search Recent Projects",
  {
    type: "view",
    layout: "border",
    events: [
      on("launched", [
        run(["projects-init"]),
        run(["projects-picker"]),
        run(["chrome", "Open in {editor}  ↩"]),
        // Folder scan + git status in the background; rows are re-sent only if something changed.
        run(["projects-refresh"], { async: true }),
      ]),
    ],
    shortcuts: [
      ...arrows("items"),
      key("{var:actions_shortcut}", act("menu")),
      key("⌘P", json({ update: { ids: { typePicker: { focus: true } } } })),
      key("⌘F", json({ update: { ids: { searchField: { focus: true } } } })),
      key("⌘O", act("open-with")),
    ],
    components: [
      searchBar({
        placeholder: "Search recent projects...",
        list: "items",
        enter: act("open"),
        right: {
          id: "typePicker",
          type: "picker",
          bordered: false,
          tooltip: "Filter by type ⌘P",
          items: [{ text: "All Types", value: "all" }],
          events: [on("changed", run(["projects-filter", "{value:self.selected.value}"]))],
        },
      }),
      body(
        sectionTitle("sectionLabel", "Recent Projects"),
        list(
          {
            ...selectionColours("rowCell", ["rowTitle", "rowDetail", "rowSync"], ["rowIcon"]),
            root: cell,
          },
          "No recent projects",
        ),
      ),
      footer([
        footerButton("primaryButton", "Open in Code  ↩", act("open")),
        divider,
        footerButton("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
        hiddenKey("closeOthersKey", "⇧⌘↩", act("open-close")),
        hiddenKey("finderKey", "⇧⌘F", act("reveal")),
        hiddenKey("terminalKey", "⇧⌘T", act("terminal")),
        hiddenKey("webKey", "⇧⌘G", act("web")),
        hiddenKey("copyNameKey", "⇧⌘C", act("copy-name")),
        hiddenKey("copyPathKey", "⇧⌘.", act("copy-path")),
        hiddenKey("pinKey", "⇧⌘P", act("pin")),
        hiddenKey("removeKey", "⌃X", act("remove")),
      ]),
    ],
  },
  { variablesconfig: { type_filter: { persist: true, scriptenv: true, default: "all" } } },
);
