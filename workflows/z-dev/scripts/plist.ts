import { tools } from "../src/tools.ts";
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.dev",
  name: "Dev",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-dev",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Dev",
        subtext: "Speed Test, processes, weather, Adhan, currency and calculations",
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
      config: { path: "dev.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/dev post",
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
    text("kw_main", "Dev keyword", "dev", "Find and open your independent tools."),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open launcher actions."),
    text("back_shortcut", "Back shortcut", "⌃⌥⇧⌘B", "Back to Alfred search or the Dev launcher."),
    {
      type: "popupbutton",
      variable: "launch_external",
      label: "Open window",
      description: "Choose Alfred’s window or a separate window.",
      config: {
        default: "0",
        pairs: [
          ["Inside Alfred", "0"],
          ["Separate window", "1"],
        ],
      },
    },
    text("node_path", "Node.js executable", "", "Optional absolute path if automatic discovery fails."),
  ],
  variablesdontexport: [],
  readme: `Type dev to search ${tools.map((t) => t.name).join(", ")}. Each tool stays a separate installed workflow and keeps its direct keyword. Dev does no polling, network requests or camera/process work in the launcher. Camera is deferred.

Return opens a tool. Back from that tool returns to the same Dev query and selection, after its own child screens. Direct tool launches keep their original Back behavior. Dev Back (configurable Hyper+B) returns to Alfred search; Back is visible outside Actions.

Command-K: Open Tool, Copy Default Shortcut, Refresh Installed Tools and Download Workflows. Install the matching tools separately; Speed Test 0.1.3+ is required for return navigation. No workflows are downloaded or installed automatically.

Requires Alfred 6 Powerpack, Node.js 22+ or Bun. Original Dev icon uses SF Symbols; tool icon notices are included. Built with help from AI tools.`,
};
