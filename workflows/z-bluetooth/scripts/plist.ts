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
  bundleid: "com.izsk.bluetooth",
  name: "Bluetooth",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-bluetooth",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Bluetooth",
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
      config: { path: "bluetooth.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/bluetooth post",
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
    text("kw_main", "Keyword", "bluetooth", "Open Bluetooth."),
    ...hyperConfiguration(),
    text(
      "refresh_seconds",
      "Refresh interval (seconds)",
      "10",
      "Poll only while this window is open; range 2–60 seconds.",
    ),
    text(
      "blueutil_path",
      "Optional blueutil executable",
      "",
      "Uses the native backend when blueutil is unavailable. Never installed automatically.",
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
    "Find and manage local development servers. Use Command-K for actions. Back (Hyper+B) returns one level or to Dev. Built with help from AI tools. See README for sources and limitations.",
};
