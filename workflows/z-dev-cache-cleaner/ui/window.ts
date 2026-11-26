import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { referenceCell } from "../../../shared/reference-rows.ts";
const ui = dashboard({
  bundle: "com.izsk.dev-cache-cleaner",
  cli: "devcache",
  title: "Dev Cache Cleaner",
  placeholder: "Search caches…",
  primary: "Clean Selected Cache  ↩",
  details: true,
});
export const toolWindow = JSON.parse(JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return"));
export const components = (query = ""): Json[] => {
  const values = structuredClone(ui.components(query));
  values[0]!.spacing = 10;
  values[0]!.components.unshift({
    type: "button",
    text: "‹",
    bordered: false,
    font: { size: 24 },
    constraints: { region: "left", size: { width: 20 } },
    events: [{ triggers: "actioned", action: ui.run("back", [], false) }],
  });
  values[0]!.components.push({
    id: "filter",
    type: "picker",
    selected: "All",
    items: [{ text: "All (0)", value: "All" }],
    constraints: { region: "right", size: { width: 180 } },
    events: [{ triggers: "changed", action: ui.run("filter", ["{value:self.selected.value}"], false) }],
  });
  const list = values[1]!.components[0];
  list.constraints.size.width = 285;
  list.cell = referenceCell("cache", 46);
  list.spacing = 2;
  list.padding = 6;
  const cell = list.cell;
  delete cell.init["cacheSubtitle.colour"];
  delete cell.selected["cacheSubtitle.colour"];
  cell.root.components[0].components[2].components.pop();
  cell.root.components[0].components[0].constraints.size = { width: 15, height: 15 };
  cell.root.components[1] = {
    id: "cacheHeader",
    type: "view",
    layout: "border",
    padding: 6,
    spacing: 6,
    components: [
      {
        id: "cacheGroupTitle",
        type: "label",
        text: "",
        font: { size: 11, weight: "medium" },
        colour: "secondaryLabelColor",
        linebreak: "truncatemiddle",
        constraints: { region: "centre" },
      },
      {
        id: "cacheGroupTotal",
        type: "label",
        text: "",
        font: { size: 11 },
        colour: "secondaryLabelColor",
        constraints: { region: "right" },
      },
    ],
  };
  values[1]!.components[1] = {
    id: "cacheDetails",
    type: "markdownarea",
    text: "Select a cache to inspect its description and cleanup command.",
    font: { size: 15 },
    background: null,
    urischemes: [],
    constraints: { region: "centre", size: { height: 320 } },
  };
  values[2]!.components.unshift({
    id: "activity",
    type: "progress",
    style: "round",
    progress: 0,
    opacity: 0,
    constraints: { region: "left", size: { width: 16, height: 16 } },
  });
  return values;
};
