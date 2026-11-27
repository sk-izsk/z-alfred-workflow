import { hyperConfiguration } from "../../../shared/ui-profile.ts";
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
const object = (uid: string, type: string, config: object, version = 1) => ({ uid, type, version, config });
const link = (b: string) => ({ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false });
export const infoPlist = {
  bundleid: "com.izsk.menubar",
  name: "Menu Bar",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-menubar",
  objects: [
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Menu Bar",
      subtext: "Search and click the menus of the app you are using",
      argumenttype: 1,
      withspace: true,
    }),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object("MODE", "alfred.workflow.utility.json", {
      json: JSON.stringify({
        alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
      }),
    }),
    object("UI", "alfred.workflow.userinterface.alfredui", {
      path: "menubar.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/menubar post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
      2,
    ),
  ],
  connections: {
    KEYWORD: [link("MODE")],
    TRIGGER: [link("MODE")],
    MODE: [link("UI")],
    UI: [link("POST")],
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["TRIGGER", 0, 140],
      ["MODE", 200, 70],
      ["UI", 380, 70],
      ["POST", 560, 70],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Keyword", "m", "Open Menu Bar for the app in front. Type a search after it."),
    {
      type: "checkbox",
      variable: "show_disabled",
      label: "Unavailable items",
      description: "Also list menu items that are greyed out right now (they can't be clicked).",
      config: { default: false, required: false, text: "Show unavailable items" },
    },
    {
      type: "checkbox",
      variable: "show_apple_menu",
      label: "Apple menu",
      description: "Also list the Apple menu, which is the same in every app.",
      config: { default: false, required: false, text: "Include the Apple menu" },
    },
    ...hyperConfiguration(),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open actions."),
    text("node_path", "Node.js executable", "", "Optional absolute executable path."),
    {
      type: "popupbutton",
      variable: "launch_external",
      label: "Open window",
      config: {
        default: "0",
        pairs: [
          ["Inside Alfred", "0"],
          ["Separate window", "1"],
        ],
      },
    },
  ],
  variablesdontexport: [],
  readme:
    "Search and click the menu bar items of the app you are using, in a native Alfred window. Type m (and a search) to list every menu item with its menu and shortcut; words or initials match (nt finds New Tab). ↩ closes Alfred and clicks the item; ⌘C copies its menu path. Needs Alfred's Accessibility access. Command-K for actions; Back (Hyper+B) returns to Swiss or Alfred's search. Built with help from AI tools.",
};
