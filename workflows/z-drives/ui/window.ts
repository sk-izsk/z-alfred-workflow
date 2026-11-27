import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.drives",
  cli: "drives",
  title: "Drives",
  placeholder: "Search drives…",
  primary: "Eject  ↩",
});
const SELECTED = "{value:items.selected.uid}";
ui.window.window.root.shortcuts.push(
  { shortcut: "⌘O", action: ui.run("reveal", [SELECTED], false) },
  { shortcut: "⌘E", action: ui.run("eject", [SELECTED]) },
  { shortcut: "⌘C", action: ui.run("copy", [SELECTED], false) },
);
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = ""): Json[] => ui.components(query);
