import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { groups } from "../src/emoji.ts";
const ui = dashboard({
  bundle: "com.izsk.emoji",
  cli: "emoji",
  title: "Emoji Picker",
  placeholder: "Search emoji, names or shortcodes…",
  primary: "Copy  ↩",
});
export const toolWindow = ui.window;
export const components = (query = ""): Json[] => {
  const values = ui.components(query);
  const visit = (object: Json): void => {
    if (object.id === "rowIcon") {
      delete object.image;
      object.type = "label";
      object.id = "emojiGlyph";
      object.text = "";
      object.font = { size: 30 };
      object.constraints = { region: "left", position: "centre", size: { width: 42 } };
    }
    if (object.components) for (const child of object.components) visit(child);
    if (object.cell?.root) visit(object.cell.root);
  };
  values.forEach(visit);
  values[0]!.components.push({
    id: "category",
    type: "picker",
    selected: "All",
    items: ["All", "Favorites", "Recent", ...groups].map((text) => ({ text, value: text })),
    constraints: { region: "right", size: { width: 175 } },
    events: [{ triggers: "changed", action: ui.run("category", ["{value:self.selected.value}"]) }],
  });
  return values;
};
