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

const act = (action: string) => run(["gallery", action, sel("items")]);

const hiddenKey = (id: string, shortcut: string, action: string) =>
  footerButton(id, "", act(action), { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });

/** Installing takes a few seconds: say so, then run it without freezing the window. */
const installNow = [
  json({ update: { ids: { statusLabel: { text: "Installing…" } } } }),
  run(["gallery", "install", sel("items")], { async: true }),
];

const search = run(["gallery-search", "{value:searchField.text}"], { async: true });

export const install = window("Install Extension", {
  type: "view",
  layout: "border",
  events: [on("preload", run(["gallery-init"])), on("launched", search)],
  shortcuts: [...arrows("items"), key("{var:actions_shortcut}", act("menu"))],
  components: [
    searchBar({
      placeholder: "Search extensions…",
      list: "items",
      enter: installNow,
      // Search once typing pauses: every keystroke would hit the Marketplace.
      events: [on("typingstopped", search), on("actioned", installNow)],
    }),
    body(
      sectionTitle("sectionLabel", "Found Extensions"),
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
        "Type to search the Marketplace",
        false,
      ),
    ),
    footer([
      footerButton("primaryButton", "Install Extension  ↩", installNow),
      divider,
      footerButton("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
      hiddenKey("browserKey", "⇧⌘O", "browser"),
      hiddenKey("copyIdKey", "⇧⌘C", "copy-id"),
    ]),
  ],
});
