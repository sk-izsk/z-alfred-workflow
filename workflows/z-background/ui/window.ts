import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.background",
  cli: "background",
  title: "Background Items",
  placeholder: "Search login items, agents and daemons…",
  primary: "Reveal  ↩",
});
const SELECTED = "{value:items.selected.uid}";
ui.window.window.root.shortcuts.push(
  { shortcut: "⌘S", action: ui.run("toggle-run", [SELECTED]) },
  { shortcut: "⌘D", action: ui.run("toggle-disable", [SELECTED]) },
  { shortcut: "⌘O", action: ui.run("open-plist", [SELECTED], false) },
  { shortcut: "⌘C", action: ui.run("copy", [SELECTED], false) },
);
export const FILTERS = [
  { text: "All Items", value: "all" },
  { text: "Login Items", value: "login" },
  { text: "Launch Agents", value: "agents" },
  { text: "Daemons", value: "daemons" },
  { text: "Leftovers", value: "leftovers" },
];
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = "", filter = "all"): Json[] => {
  const values = ui.components(query);
  values[0]!.components.push({
    id: "filter",
    type: "picker",
    selected: filter,
    items: FILTERS,
    constraints: { region: "right", size: { width: 160 } },
    events: [{ triggers: "changed", action: ui.run("filter", ["{value:self.selected.value}"]) }],
  });
  return values;
};
