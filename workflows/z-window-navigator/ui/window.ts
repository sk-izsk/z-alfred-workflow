import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.window-navigator",
  cli: "wnav",
  title: "Window Navigator",
  placeholder: "Search window titles or apps…",
  primary: "Switch  ↩",
});
export const toolWindow = ui.window;
export const components = (query = ""): Json[] => {
  const values = ui.components(query);
  values[0]!.components.push({
    id: "scope",
    type: "picker",
    selected: "all",
    items: [
      { text: "All desktops", value: "all" },
      { text: "Active app", value: "active" },
      { text: "Current desktop", value: "desktop" },
    ],
    constraints: { region: "right", size: { width: 175 } },
    events: [{ triggers: "changed", action: ui.run("scope", ["{value:self.selected.value}"]) }],
  });
  return values;
};
