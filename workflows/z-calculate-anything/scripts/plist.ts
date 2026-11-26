import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.calculate-anything",
  name: "Calculate Anything",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-calculate-anything",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Calculate Anything",
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
      config: { path: "calculate.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/calcany post",
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
    text(
      "kw_main",
      "Calculate Anything keyword",
      "calcany",
      "Calculate units, percentages, data storage, time and arithmetic.",
    ),
    text(
      "engine_path",
      "Calculate Anything folder",
      "",
      "Optional installed workflow folder; auto-detected by com.alfred.calculateanything.",
    ),
    text(
      "php_path",
      "PHP executable",
      "",
      "Optional absolute path to an installed PHP executable; the original engine requires PHP.",
    ),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open calculator actions."),
    text("back_shortcut", "Back shortcut", "⌘[", "Back to Alfred search or the Swiss launcher."),
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
  readme: `Type calcany 100 km in miles, calcany 2 GB in MB, calcany 100 + 16%, or calcany 100+24/12. Natural-language conversion uses your installed Calculate Anything workflow by biati digital, preserving its configuration. Plain arithmetic is local. This bridge does not duplicate or replace your original workflow, keywords or preferences.

Requires the original Calculate Anything workflow and PHP for unit/natural-language conversion. Select the installed workflow folder and PHP path in Workflow Configuration if automatic discovery fails. No software is installed at runtime. Engine cache is kept separately; original settings/API keys are read into the child environment and never logged or exported.

Return copies the selected result. Command-K includes formatted, raw and alternate copies, Recalculate and Documentation. Arrow keys navigate; configurable Command-[ Back is visible in the footer. Source engine currency/crypto requests use its configured providers; availability follows that engine.

Requires Alfred 6 Powerpack and Node.js 22+ or Bun. Calculate Anything icon/reference copyright 2020 biati digital, MIT. Built with help from AI tools.`,
};
