import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { groups } from "../src/emoji.ts";
const ui = dashboard({
  bundle: "com.izsk.emoji",
  cli: "emoji",
  title: "Emoji Picker",
  placeholder: "Search emoji, names or shortcodes…",
  primary: "Copy  ↩",
});
for (const [index, direction] of [
  [0, "selectup"],
  [1, "selectdown"],
] as const)
  ui.window.window.root.shortcuts[index]!.action.args = direction;
ui.window.window.root.shortcuts.push(
  ...["←", "→"].map((shortcut, i) => ({
    shortcut,
    action: { type: "function", src: "items", args: i ? "selectright" : "selectleft" },
  })),
);
export const toolWindow = ui.window;
export const components = (query = "", layout: "list" | "grid" = "list", category = "All"): Json[] => {
  const grid = layout === "grid";
  const values = structuredClone(ui.components(query));
  const visit = (object: Json): void => {
    if (object.id === "items") {
      object.cols = grid ? 6 : 1;
      object.spacing = grid ? 6 : 3;
      object.cell.height = grid ? 108 : 64;
    }
    if (grid && object.id === "row") object.spacing = 5;
    if (grid && object.id === "rowTitle") {
      object.font = { size: 10 };
      object.textalign = "centre";
    }
    if (grid && object.id === "rowDescription") {
      object.hidden = true;
    }
    if (object.id === "rowIcon") {
      delete object.image;
      object.type = "label";
      object.id = "emojiGlyph";
      object.text = "";
      object.font = { size: grid ? 42 : 30 };
      object.constraints = grid
        ? { region: "top", position: "centre", size: { height: 60 } }
        : { region: "left", position: "centre", size: { width: 42 } };
      object.textalign = "centre";
    }
    if (object.components) for (const child of object.components) visit(child);
    if (object.cell?.root) visit(object.cell.root);
  };
  values.forEach(visit);
  values[0]!.components.push({
    id: "category",
    type: "picker",
    selected: category,
    items: ["All", "Favorites", "Recent", ...groups].map((text) => ({ text, value: text })),
    constraints: { region: "right", size: { width: 175 } },
    events: [{ triggers: "changed", action: ui.run("category", ["{value:self.selected.value}"]) }],
  });
  values.splice(1, 0, {
    type: "view",
    layout: "border",
    padding: 8,
    constraints: { region: "top" },
    components: [
      {
        id: "layoutPicker",
        type: "picker",
        selected: layout,
        items: [
          { text: "List", value: "list" },
          { text: "Grid", value: "grid" },
        ],
        constraints: { region: "right", size: { width: 110 } },
        events: [{ triggers: "changed", action: ui.run("layout", ["{value:self.selected.value}"], false) }],
      },
    ],
  });
  const header = values.shift()!;
  const viewPicker = values.shift()!;
  values.unshift({
    type: "view",
    layout: "border",
    constraints: { region: "top" },
    components: [header, { ...viewPicker, constraints: { region: "bottom" } }],
  });
  return values;
};
