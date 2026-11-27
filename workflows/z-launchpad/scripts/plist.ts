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
const link = (to: string) => [{ destinationuid: to, modifiers: 0, modifiersubtext: "", vitoclose: false }];
export const infoPlist = {
  bundleid: "com.izsk.launchpad",
  name: "Launchpad",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-launchpad",
  objects: [
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Launchpad",
      subtext: "Grid of apps: swipe or scroll for pages, drag apps together for folders",
      argumenttype: 2,
      withspace: false,
      skipuniversalaction: true,
    }),
    // Like the original: assign a key in Alfred Preferences for faster opening.
    object(
      "HOTKEY",
      "alfred.workflow.trigger.hotkey",
      {
        action: 0,
        relatedAppsMode: 0,
        argument: 0,
        focusedappvariable: false,
        focusedappvariablename: "",
        leftcursor: false,
        modsmode: 2,
      },
      2,
    ),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object("MODE", "alfred.workflow.utility.json", {
      json: JSON.stringify({ alfredworkflow: { arg: "", config: { launchmode: "{var:launch_external}" } } }),
    }),
    object("UI", "alfred.workflow.userinterface.alfredui", {
      path: "launchpad.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/launchpad post",
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
    KEYWORD: link("MODE"),
    HOTKEY: link("MODE"),
    TRIGGER: link("MODE"),
    MODE: link("UI"),
    UI: link("POST"),
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["HOTKEY", 0, 130],
      ["TRIGGER", 0, 260],
      ["MODE", 200, 130],
      ["UI", 380, 130],
      ["POST", 580, 130],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    text(
      "kw_main",
      "Keyword",
      "launchpad",
      "Open the grid. The original Launchpad workflow uses the same keyword: disable it, or change one.",
    ),
    text("page_cols", "Columns", "7", "Apps per row (3–12)."),
    text("page_rows", "Rows", "5", "Rows per page (2–10)."),
    text("window_width", "Window width", "1100", "Points; fitted to the display (600–3000)."),
    text("window_height", "Window height", "850", "Points (400–2000)."),
    {
      type: "textarea",
      variable: "extra_dirs",
      label: "More app folders",
      description: "Also list apps from these folders, one per line (for example ~/Applications).",
      config: { default: "", required: false, trim: true, verticalsize: 3 },
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
    "A Launchpad-style grid of your apps. Swipe with the trackpad or scroll the mouse wheel to change pages, drag an app onto another to make a folder, click a folder title to rename it, right-click to delete it. ⌘? shows every shortcut. Built with help from AI tools.",
};
