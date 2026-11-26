import {
  arrows,
  body,
  divider,
  footer,
  footerButton,
  hiddenKey,
  inlineLabel,
  key,
  list,
  on,
  pill,
  picker,
  row,
  run,
  searchBar,
  sectionTitle,
  sel,
  selectionColours,
  symbol,
  window,
} from "./shared.ts";

const act = (action: string) => run(["ext", action, sel("items")]);
const refilter = run(["ext-filter", "{value:kindPicker.selected.value}"]);

const versionPill = pill("rowVersionPill", [
  inlineLabel("rowVersion", { colour: "secondaryLabelColor", font: { size: 11.5, monospaced: "digits" } }),
]);

export const extensions = window(
  "Show Installed Extensions",
  {
    type: "view",
    layout: "border",
    events: [
      on("launched", [run(["ext-init"]), run(["ext-pickers"]), run(["chrome", "Open in {editor}  ↩"])]),
    ],
    shortcuts: [...arrows("items"), key("{var:actions_shortcut}", act("menu"))],
    components: [
      searchBar({
        placeholder: "Search Installed Extensions",
        list: "items",
        enter: act("open"),
        right: picker("kindPicker", "Themes or other extensions", "All Extensions", refilter),
      }),
      body(
        sectionTitle("sectionLabel", "Installed Extensions"),
        list(
          {
            ...selectionColours("rowCell", ["rowTitle", "rowDetail", "rowVersion"], ["rowIcon", "rowTheme"]),
            root: row({
              doubleClick: run(["ext", "open", "{data:uid}"]),
              right: [
                symbol("rowTheme", "paintpalette", { tooltip: "Color theme" }),
                symbol("rowPreRelease", "flask", { tooltip: "Pre-release" }),
                versionPill,
              ],
            }),
          },
          "No installed extensions",
        ),
      ),
      footer([
        footerButton("primaryButton", "Open in Code  ↩", act("open")),
        divider,
        footerButton("actionsButton", "Actions  {var:actions_label}", act("menu")),
        hiddenKey("previewKey", "⌘Y", act("preview")),
        hiddenKey("browserKey", "⇧⌘O", act("browser")),
        hiddenKey("finderKey", "⇧⌘F", act("reveal")),
        hiddenKey("copyIdKey", "⇧⌘C", act("copy-id")),
      ]),
    ],
  },
  {
    variablesconfig: {
      ext_kind: { persist: true, scriptenv: true, default: "all" },
    },
  },
);
