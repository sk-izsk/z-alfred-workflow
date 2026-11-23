import {
  arrows,
  body,
  divider,
  footer,
  footerButton,
  inlineLabel,
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

const act = (action: string) => run(["ext", action, sel("items")]);

const hiddenKey = (id: string, shortcut: string, action: string) =>
  footerButton(id, "", act(action), { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });

const versionPill = pill("rowVersionPill", [
  inlineLabel("rowVersion", { colour: "secondaryLabelColor", font: { size: 11.5, monospaced: "digits" } }),
]);

export const extensions = window("Show Installed Extensions", {
  type: "view",
  layout: "border",
  events: [on("preload", [run(["ext-init"]), run(["chrome", "Open in {editor}  ↩"])])],
  shortcuts: [...arrows("items"), key("{var:actions_shortcut}", act("menu"))],
  components: [
    searchBar({ placeholder: "Search Installed Extensions", list: "items", enter: act("open") }),
    body(
      sectionTitle("sectionLabel", "Installed Extensions"),
      list(
        {
          ...selectionColours("rowCell", ["rowTitle", "rowDetail", "rowVersion"], ["rowIcon"]),
          root: row({
            doubleClick: run(["ext", "open", "{data:uid}"]),
            right: [symbol("rowPreRelease", "flask", { tooltip: "Pre-release" }), versionPill],
          }),
        },
        "No installed extensions",
      ),
    ),
    footer([
      footerButton("primaryButton", "Open in Code  ↩", act("open")),
      divider,
      footerButton("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
      hiddenKey("browserKey", "⇧⌘O", "browser"),
      hiddenKey("finderKey", "⇧⌘F", "reveal"),
      hiddenKey("copyIdKey", "⇧⌘C", "copy-id"),
    ]),
  ],
});
