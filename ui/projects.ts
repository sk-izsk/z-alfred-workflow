import {
  arrows,
  body,
  divider,
  footer,
  footerButton,
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

/** Modifier combos go on invisible buttons: as root shortcuts they swallow other ⌘ keys. */
const hiddenKey = (id: string, shortcut: string, action: string) =>
  footerButton(id, "", act(action), { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });

const cell = row({
  doubleClick: run(["project", "open", "{data:uid}"]),
  right: [
    symbol("rowPin", "pin.fill", { tooltip: "Pinned", contenttintcolour: "systemOrangeColor" }),
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
      on("preload", [run(["projects-init", "{var:type_filter}"]), run(["chrome", "Open in {editor}  ↩"])]),
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
            ...selectionColours("rowCell", ["rowTitle", "rowDetail"], ["rowIcon"]),
            root: cell,
          },
          "No recent projects",
        ),
      ),
      footer([
        footerButton("primaryButton", "Open in Code  ↩", act("open")),
        divider,
        footerButton("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
        hiddenKey("closeOthersKey", "⇧⌘↩", "open-close"),
        hiddenKey("finderKey", "⇧⌘F", "reveal"),
        hiddenKey("terminalKey", "⇧⌘T", "terminal"),
        hiddenKey("copyNameKey", "⇧⌘C", "copy-name"),
        hiddenKey("copyPathKey", "⇧⌘.", "copy-path"),
        hiddenKey("pinKey", "⇧⌘P", "pin"),
      ]),
    ],
  },
  { variablesconfig: { type_filter: { persist: true, scriptenv: true, default: "all" } } },
);
