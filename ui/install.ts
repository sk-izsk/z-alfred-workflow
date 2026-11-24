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
  picker,
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

const act = (action: string) => run(["gallery", action, sel("items")]);

/** Installing takes a few seconds: say so, then run it without freezing the window. */
const installNow = [
  json({ update: { ids: { statusLabel: { text: "Installing…" } } } }),
  run(["gallery", "install", sel("items")], { async: true }),
];

const search = run(["gallery-search", "{value:searchField.text}", "{value:categoryPicker.selected.value}"], {
  async: true,
});

export const install = window(
  "Install Extension",
  {
    type: "view",
    layout: "border",
    events: [on("launched", [run(["gallery-init"]), run(["gallery-pickers"]), search])],
    shortcuts: [...arrows("items"), key("{var:actions_shortcut}", act("menu"))],
    components: [
      searchBar({
        placeholder: "Search extensions…",
        list: "items",
        enter: installNow,
        // Search once typing pauses: every keystroke would hit the Marketplace.
        events: [on("typingstopped", search), on("actioned", installNow)],
        right: picker("categoryPicker", "Category", "All Categories", search),
      }),
      body(
        sectionTitle("sectionLabel", "Extensions"),
        list(
          {
            ...selectionColours(
              "rowCell",
              ["rowTitle", "rowDetail", "rowInstalls", "rowVersion"],
              ["rowIcon", "rowDownload"],
            ),
            root: row({
              doubleClick: run(["gallery", "install", "{data:uid}"]),
              right: [
                pill(
                  "rowInstalledPill",
                  [
                    inlineLabel("rowInstalled", {
                      text: "Installed",
                      colour: "systemBlueColor",
                      font: { size: 11.5, weight: "medium" },
                    }),
                  ],
                  "#0a84ff26",
                ),
                symbol("rowDownload", "arrow.down.to.line", {
                  image: { type: "symbol", src: "arrow.down.to.line", size: { height: 11 } },
                }),
                inlineLabel("rowInstalls", { colour: "secondaryLabelColor", font: { size: 12 } }),
                pill("rowVersionPill", [
                  inlineLabel("rowVersion", {
                    colour: "secondaryLabelColor",
                    font: { size: 11.5, monospaced: "digits" },
                  }),
                ]),
              ],
            }),
          },
          "Loading the most installed extensions…",
          false,
        ),
      ),
      footer([
        footerButton("primaryButton", "Install Extension  ↩", installNow),
        divider,
        footerButton("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
        hiddenKey("previewKey", "⌘Y", act("preview")),
        hiddenKey("browserKey", "⇧⌘O", act("browser")),
        hiddenKey("copyIdKey", "⇧⌘C", act("copy-id")),
      ]),
    ],
  },
  { variablesconfig: { gallery_category: { persist: true, scriptenv: true, default: "" } } },
);
