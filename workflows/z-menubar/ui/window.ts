import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.menubar",
  cli: "menubar",
  title: "Menu Bar",
  placeholder: "Search menus…",
  primary: "Click  ↩",
});
ui.window.window.root.shortcuts.push({
  shortcut: "⌘C",
  action: ui.run("copy", ["{value:items.selected.uid}"], false),
});
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = ""): Json[] => ui.components(query);
