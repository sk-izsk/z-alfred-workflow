import { hyperConfiguration } from "../../../shared/ui-profile.ts";
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.emoji",
  name: "Emoji Picker",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-emoji",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Emoji Picker",
        subtext: pkg.description,
        argumenttype: 1,
        withspace: true,
      },
    },
    {
      uid: "TRIGGER",
      type: "alfred.workflow.trigger.external",
      version: 1,
      config: { triggerid: "open", availableviaurlscheme: true },
    },
    {
      uid: "MODE",
      type: "alfred.workflow.utility.json",
      version: 1,
      config: {
        json: JSON.stringify({
          alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
        }),
      },
    },
    {
      uid: "UI",
      type: "alfred.workflow.userinterface.alfredui",
      version: 1,
      config: { path: "emoji.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/emoji post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
    },
  ],
  connections: Object.fromEntries(
    [
      ["KEYWORD", "MODE"],
      ["TRIGGER", "MODE"],
      ["MODE", "UI"],
      ["UI", "POST"],
    ].map(([a, b]) => [a, [{ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false }]]),
  ),
  uidata: Object.fromEntries(
    ["KEYWORD", "TRIGGER", "MODE", "UI", "POST"].map((id, i) => [
      id,
      { xpos: i * 190, ypos: id === "TRIGGER" ? 180 : 40 },
    ]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Keyword", "emoji", "Open Emoji Picker."),
    ...hyperConfiguration(),
    {
      type: "popupbutton",
      variable: "primary_action",
      label: "Return action",
      config: {
        default: "copy",
        pairs: [
          ["Copy", "copy"],
          ["Paste", "paste"],
        ],
      },
    },
    text(
      "max_version",
      "Maximum emoji version",
      "17",
      "Use an older version if your macOS font does not display newer emoji.",
    ),
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
    "Offline emoji search, favorites, recents and variants. Use Command-K for actions. Back (Hyper+B) returns one level or to Swiss. Built with help from AI tools. See README for sources and limitations.",
};
