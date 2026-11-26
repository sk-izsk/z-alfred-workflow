import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { referenceCell } from "../../../shared/reference-rows.ts";
const ui = dashboard({
  bundle: "com.izsk.dev-servers",
  cli: "devservers",
  title: "Dev Servers",
  placeholder: "Filter projects, servers or ports…",
  primary: "Open in Browser  ↩",
});
ui.window.variablesconfig.dev_return = { default: "" };
delete (ui.window.variablesconfig as Json).swiss_return;
const initial = JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return");
export const toolWindow = JSON.parse(initial);
export const components = (query = ""): Json[] => {
  const values = structuredClone(ui.components(query));
  values[1]!.components[0].cell = referenceCell("server", 46);
  values[1]!.components[0].cell.root.components[0].components[2].components[1].constraints.size.width = 0;
  const accessories = values[1]!.components[0].cell.root.components[0].components[1].components;
  accessories.reverse();
  values[0]!.spacing = 10;
  values[0]!.components.push({
    id: "filter",
    type: "picker",
    selected: "All",
    items: [{ text: "All Tools", value: "All" }],
    constraints: { region: "right", size: { width: 150 } },
    events: [{ triggers: "changed", action: ui.run("filter", ["{value:self.selected.value}"], false) }],
  });
  return values;
};
