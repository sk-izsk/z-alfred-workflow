import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.displays",
  cli: "displays",
  title: "Displays",
  placeholder: "Search displays…",
  primary: "Resolutions  ↩",
});
const SELECTED = "{value:items.selected.uid}";
ui.window.window.root.shortcuts.push(
  { shortcut: "⌘Z", action: ui.run("undo", [], false) },
  { shortcut: "⌘M", action: ui.run("main", [SELECTED], false) },
  { shortcut: "⌘D", action: ui.run("dark", [], false) },
);
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = ""): Json[] => ui.components(query);
