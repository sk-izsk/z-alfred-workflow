import {
  arrows,
  body,
  footer,
  footerButton,
  inlineLabel,
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

const KIND = "{value:kindPicker.selected.value}";
const apply = run(["theme", "apply", sel("items")]);
const refilter = run(["theme-filter", KIND]);

export const themes = window(
  "Change Theme",
  {
    type: "view",
    layout: "border",
    events: [
      on("launched", [run(["theme-init"]), run(["theme-pickers"])]),
      // ⎋ or closing the window undoes a live preview that wasn't applied with ↩.
      on("quit", run(["theme-restore"])),
    ],
    shortcuts: [...arrows("items")],
    components: [
      searchBar({
        placeholder: "Search themes...",
        list: "items",
        enter: apply,
        right: picker("kindPicker", "Light or dark", "All Themes", refilter),
      }),
      body(
        sectionTitle("sectionLabel", "Installed Themes"),
        list(
          {
            ...selectionColours("rowCell", ["rowTitle", "rowDetail", "rowKind"], ["rowIcon", "rowCurrent"]),
            root: row({
              doubleClick: run(["theme", "apply", "{data:uid}"]),
              right: [
                symbol("rowCurrent", "checkmark", {
                  tooltip: "Current theme",
                  contenttintcolour: "systemGreenColor",
                }),
                pill("rowKindPill", [
                  inlineLabel("rowKind", { colour: "secondaryLabelColor", font: { size: 11.5 } }),
                ]),
              ],
            }),
          },
          "No themes in this profile",
          true,
          // Live preview: each selection change applies the theme (ignored unless enabled in settings).
          [on("changed", run(["theme", "preview", sel("items")], { async: true }))],
        ),
      ),
      footer([footerButton("primaryButton", "Apply Theme  ↩", apply)]),
    ],
  },
  {
    variablesconfig: {
      theme_kind: { persist: true, scriptenv: true, default: "all" },
    },
  },
);
