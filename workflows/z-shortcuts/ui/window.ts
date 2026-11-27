import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.shortcuts",
  cli: "shortcuts",
  title: "Shortcuts",
  placeholder: "Search shortcuts…",
  primary: "Run  ↩",
});
// Input handed over by the Universal Action (text, URLs) or File Action (paths, tab-separated).
ui.window.variablesconfig.shortcuts_input = { src: "variable", default: "", scriptenv: true };
ui.window.variablesconfig.shortcuts_paths = { src: "variable", default: "", scriptenv: true };
// Text typed into the input sheet reaches the script as env, never argv.
ui.window.variablesconfig.shortcuts_text = { default: "", scriptenv: true };
const SELECTED = "{value:items.selected.uid}";
ui.window.window.root.shortcuts.push(
  { shortcut: "⌘↩", action: ui.run("ask-input", [SELECTED], false) },
  { shortcut: "⌥↩", action: ui.run("edit", [SELECTED], false) },
  { shortcut: "⌘E", action: ui.run("edit", [SELECTED], false) },
);
export const toolWindow = ui.window;
export const run = ui.run;
export const components = (query = "", folder = "all", folders: string[] = []): Json[] => {
  const values = ui.components(query);
  values[0]!.components.push({
    id: "folder",
    type: "picker",
    selected: folder,
    items: [
      { text: "All Shortcuts", value: "all" },
      ...folders.map((name) => ({ text: name, value: name })),
      { text: "No Folder", value: "none" },
    ],
    constraints: { region: "right", size: { width: 190 } },
    events: [{ triggers: "changed", action: ui.run("folder", ["{value:self.selected.value}"]) }],
  });
  return values;
};
