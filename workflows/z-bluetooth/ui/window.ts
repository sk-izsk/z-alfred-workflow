import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.bluetooth",
  cli: "bluetooth",
  title: "Bluetooth",
  placeholder: "Search Bluetooth devices…",
  primary: "Connect  ↩",
});
ui.window.variablesconfig.dev_return = { default: "" };
delete (ui.window.variablesconfig as Json).swiss_return;
const initial = JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return");
export const toolWindow = JSON.parse(initial);
export const components = (query = ""): Json[] => {
  const values = structuredClone(ui.components(query));
  const row = values[1]!.components[0].cell.root;
  row.components.push({
    type: "view",
    layout: "inline",
    spacing: 10,
    constraints: { region: "right", position: "centre" },
    components: Array.from({ length: 3 }, (_, i) => ({
      id: `battery${i}`,
      type: "view",
      layout: "inline",
      spacing: 4,
      components: [
        {
          id: `batteryIcon${i}`,
          type: "imageview",
          image: { type: "symbol", src: "battery.100" },
          constraints: { size: { width: 17, height: 17 } },
        },
        { id: `batteryText${i}`, type: "label", text: "", font: { size: 12 }, colour: "secondaryLabelColor" },
      ],
    })),
  });
  values[0]!.spacing = 10;
  values[0]!.components.push({
    id: "filter",
    type: "picker",
    selected: "All",
    items: [{ text: "All Devices", value: "All" }],
    constraints: { region: "right", size: { width: 150 } },
    events: [{ triggers: "changed", action: ui.run("filter", ["{value:self.selected.value}"], false) }],
  });
  return values;
};
