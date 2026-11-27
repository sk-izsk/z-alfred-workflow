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
  bundleid: "com.izsk.sound",
  name: "Sound",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-sound",
  objects: [
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Sound",
      subtext: "Choose the sound output or input device",
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
      path: "sound.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/sound post",
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
    text("kw_main", "Keyword", "sound", "Open Sound. Type “in” after it for input devices."),
    {
      type: "popupbutton",
      variable: "start_kind",
      label: "Open on",
      description: "Which devices the window shows first. ⌘1 and ⌘2 switch.",
      config: {
        default: "output",
        pairs: [
          ["Output devices", "output"],
          ["Input devices", "input"],
        ],
      },
    },
    {
      type: "checkbox",
      variable: "alerts_follow",
      label: "Alert sounds",
      description: "Off: alerts stay on their own device (⌘L sets it).",
      config: { default: true, required: false, text: "Move alert sounds with the output" },
    },
    {
      type: "textarea",
      variable: "hidden_devices",
      label: "Hidden devices",
      description: "Device names to leave out, one per line (a hidden device still shows while in use).",
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
    "Choose the sound output or input device in a native Alfred window. ↩ switches and closes, ⌘↩ switches and stays open, ⌘1/⌘2 show output or input devices, ⌘L sets the alert sound device. Command-K for actions; Back (Hyper+B) returns to Swiss or Alfred's search. Built with help from AI tools.",
};
