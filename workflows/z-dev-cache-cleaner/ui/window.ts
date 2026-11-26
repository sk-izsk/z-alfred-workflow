import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.dev-cache-cleaner",
  cli: "devcache",
  title: "Dev Cache Cleaner",
  placeholder: "Search caches…",
  primary: "Review Cleanup  ↩",
  details: true,
});
export const toolWindow = JSON.parse(JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return"));
export const components = (query = ""): Json[] => {
  const values = structuredClone(ui.components(query));
  values[0]!.spacing = 10;
  values[0]!.components.push({
    id: "filter",
    type: "picker",
    selected: "All",
    items: [
      "All",
      "Safe",
      "Review",
      "Large > 1 GB",
      "Package Managers",
      "Xcode",
      "Languages",
      "Project Artifacts",
    ].map((value) => ({ text: value, value })),
    constraints: { region: "right", size: { width: 180 } },
    events: [{ triggers: "changed", action: ui.run("filter", ["{value:self.selected.value}"], false) }],
  });
  values[1]!.components[0].constraints.size.width = 275;
  return values;
};
