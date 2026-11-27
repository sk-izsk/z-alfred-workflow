import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.sound",
  cli: "sound",
  title: "Sound",
  placeholder: "Search sound devices…",
  primary: "Use as Output  ↩",
});
const SELECTED = "{value:items.selected.uid}";
ui.window.window.root.shortcuts.push(
  { shortcut: "⌘↩", action: ui.run("switch", [SELECTED], false) },
  { shortcut: "⌘1", action: ui.run("kind", ["output"]) },
  { shortcut: "⌘2", action: ui.run("kind", ["input"]) },
  { shortcut: "⌘L", action: ui.run("alert", [SELECTED], false) },
);
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = "", kind = "output"): Json[] => {
  const values = ui.components(query);
  values[0]!.components.push({
    id: "kind",
    type: "picker",
    selected: kind,
    items: [
      { text: "Output  ⌘1", value: "output" },
      { text: "Input  ⌘2", value: "input" },
    ],
    constraints: { region: "right", size: { width: 150 } },
    events: [{ triggers: "changed", action: ui.run("kind", ["{value:self.selected.value}"]) }],
  });
  return values;
};
