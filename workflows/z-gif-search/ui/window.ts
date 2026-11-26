import { dashboard, type Json } from "../../../shared/dashboard.ts";
import type { State } from "../src/state.ts";
const ui = dashboard({
  bundle: "com.izsk.gif-search",
  cli: "gifsearch",
  title: "GIF Search",
  placeholder: "Search GIFs…",
  primary: "Copy GIF  ↩",
});
ui.window.window.root.shortcuts = ui.window.window.root.shortcuts.filter(
  (x) => !["↑", "↓"].includes(x.shortcut),
);
ui.window.window.root.shortcuts.push(
  ...["↑", "↓", "←", "→"].map((shortcut, i) => ({
    shortcut,
    action: {
      type: "function",
      src: "items",
      args: ["selectup", "selectdown", "selectleft", "selectright"][i],
    },
  })),
);
export const toolWindow = ui.window;
export const components = (s: State, layout: "list" | "grid"): Json[] => {
  const grid = layout === "grid",
    values = structuredClone(ui.components(s.query));
  values[0]!.spacing = 10;
  values[0]!.components.push({
    type: "view",
    layout: "inline",
    spacing: 8,
    constraints: { region: "right" },
    components: [
      {
        id: "source",
        type: "picker",
        selected: s.source,
        items: [
          ["GIPHY", "giphy"],
          ["Klipy", "klipy"],
          ["GIPHY · Your Key", "direct"],
          ["Finer GIFs Club", "finer"],
          ["★ Favorites", "favorites"],
          ["Recent", "recent"],
        ].map(([text, value]) => ({ text, value })),
        constraints: { size: { width: 170 } },
        events: [
          { triggers: "changed", action: ui.run("source", ["{value:self.selected.value}"]) },
        ],
      },
      {
        id: "layoutPicker",
        type: "picker",
        selected: layout,
        items: [
          { text: "List", value: "list" },
          { text: "Grid", value: "grid" },
        ],
        constraints: { size: { width: 90 } },
        events: [
          { triggers: "changed", action: ui.run("layout", ["{value:self.selected.value}"], false) },
        ],
      },
    ],
  });
  const list = values[1]!.components[0];
  list.cols = grid ? 4 : 1;
  list.spacing = grid ? 4 : 6;
  list.cell.root.padding = grid ? 5 : 8;
  list.cell.root.spacing = 3;
  list.cell.height = grid ? 142 : 88;
  list.cell.root.components[0] = {
    id: "rowIcon",
    type: "imageview",
    resize: "fit",
    image: { type: "file", src: "../icon.png" },
    constraints: {
      region: grid ? "top" : "left",
      position: "centre",
      size: grid ? { width: 160, height: 100 } : { width: 110, height: 70 },
    },
  };
  const text = list.cell.root.components[1];
  text.layout = "inline";
  text.direction = "vertical";
  text.constraints = {
    region: grid ? "bottom" : "centre",
    size: { height: 28 },
    stretch: "horizontal",
  };
  for (const label of text.components) {
    delete label.constraints;
    label.constraints = { size: { height: 14 } };
  }
  text.spacing = 0;
  text.components[0].font.size = 12;
  text.components[1].font.size = 10;
  return values;
};
