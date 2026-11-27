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
  bundleid: "com.izsk.background",
  name: "Background Items",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-background",
  objects: [
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Background Items",
      subtext: "Login items, launch agents and daemons",
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
      path: "background.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/background post",
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
    text("kw_main", "Keyword", "bgitems", "Open Background Items."),
    {
      type: "popupbutton",
      variable: "start_filter",
      label: "Open on",
      description: "Which items the window shows first.",
      config: {
        default: "all",
        pairs: [
          ["All Items", "all"],
          ["Login Items", "login"],
          ["Launch Agents", "agents"],
          ["Daemons", "daemons"],
          ["Leftovers", "leftovers"],
        ],
      },
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
    "See and control what starts at login or runs in the background: login items, launch agents and daemons, with the app each belongs to, whether it runs, and leftovers whose app is gone. ↩ reveals it in Finder, ⌘S stops or starts, ⌘D disables or enables, ⌘O opens the plist. Daemons ask for your administrator password. Command-K for actions; Back (Hyper+B) returns to Swiss or Alfred's search. Built with help from AI tools.",
};
