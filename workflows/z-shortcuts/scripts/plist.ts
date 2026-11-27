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
const setVars = (variables: Record<string, string>) => ({
  argument: "",
  passthroughargument: false,
  variables,
});
// Router outputs (Conditional on shortcuts_out set by the window's finish).
const OUT = { run: "OUT-RUN", files: "OUT-FILES", view: "OUT-VIEW" };
const is = (uid: string, value: string) => ({
  uid,
  inputstring: "{var:shortcuts_out}",
  matchmode: 0,
  matchstring: value,
  matchcasesensitive: false,
  outputlabel: value,
});
const link = (b: string, output?: string) => ({
  destinationuid: b,
  modifiers: 0,
  modifiersubtext: "",
  vitoclose: false,
  ...(output && { sourceoutputuid: output }),
});
export const infoPlist = {
  bundleid: "com.izsk.shortcuts",
  name: "Shortcuts",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-shortcuts",
  objects: [
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Shortcuts",
      subtext: "Search, run and edit your macOS Shortcuts",
      argumenttype: 1,
      withspace: true,
    }),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object("UA", "alfred.workflow.trigger.universalaction", {
      name: "Run Shortcut",
      acceptstext: true,
      acceptsurls: true,
      acceptsfiles: false,
      acceptsmulti: 0,
    }),
    object("UA_VARS", "alfred.workflow.utility.argument", setVars({ shortcuts_input: "{query}" })),
    object("FILES", "alfred.workflow.trigger.action", {
      name: "Run Shortcut",
      filetypes: [],
      acceptsmulti: 1,
    }),
    object("FILE_VARS", "alfred.workflow.utility.argument", setVars({ shortcuts_paths: "{query}" })),
    object("MODE", "alfred.workflow.utility.json", {
      json: JSON.stringify({
        alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
      }),
    }),
    object("UI", "alfred.workflow.userinterface.alfredui", {
      path: "shortcuts.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object("ROUTE", "alfred.workflow.utility.conditional", {
      conditions: [is(OUT.run, "run"), is(OUT.files, "files"), is(OUT.view, "view")],
      elselabel: "Back",
      hideelse: false,
    }),
    // Several files arrive tab-separated; Run Shortcut takes them as a list.
    object("SPLIT", "alfred.workflow.utility.split", {
      delimiter: "\t",
      outputas: 1,
      trimarguments: true,
      discardemptyarguments: true,
      variableprefix: "split",
    }),
    object("CONFIG", "alfred.workflow.utility.json", {
      json: JSON.stringify({
        alfredworkflow: {
          arg: "{query}",
          config: { shortcut: "{var:shortcut}", inputmode: "{var:inputmode}", outputmode: 0 },
        },
      }),
    }),
    object("RUN", "alfred.workflow.automation.runshortcut", { shortcut: "", inputmode: -1, outputmode: 0 }),
    object("VIEW", "alfred.workflow.automation.task", {
      taskuid: "com.alfredapp.automation.core/shortcuts/shortcut.view",
      tasksettings: { target_shortcut: "{var:shortcut}" },
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/shortcuts post",
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
    UA: [link("UA_VARS")],
    UA_VARS: [link("MODE")],
    FILES: [link("FILE_VARS")],
    FILE_VARS: [link("MODE")],
    MODE: [link("UI")],
    UI: [link("ROUTE")],
    ROUTE: [link("CONFIG", OUT.run), link("SPLIT", OUT.files), link("VIEW", OUT.view), link("POST")],
    SPLIT: [link("CONFIG")],
    CONFIG: [link("RUN")],
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["TRIGGER", 0, 140],
      ["UA", 0, 280],
      ["FILES", 0, 420],
      ["UA_VARS", 200, 300],
      ["FILE_VARS", 200, 440],
      ["MODE", 380, 140],
      ["UI", 560, 140],
      ["ROUTE", 760, 140],
      ["SPLIT", 960, 120],
      ["CONFIG", 1120, 40],
      ["RUN", 1300, 40],
      ["VIEW", 960, 260],
      ["POST", 960, 400],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Keyword", "shortcuts", "Open Shortcuts."),
    {
      type: "textarea",
      variable: "ignored_folders",
      label: "Hidden folders",
      description:
        "Shortcuts folders to leave out, one per line. Use “No Folder” for shortcuts outside folders.",
      config: { default: "", required: false, trim: true, verticalsize: 3 },
    },
    {
      type: "checkbox",
      variable: "detect_input",
      label: "Input detection",
      description:
        "Ask Shortcuts which shortcuts accept input (macOS asks once to let Alfred control Shortcuts Events). Off: every shortcut is offered input.",
      config: { default: true, required: false, text: "Mark shortcuts that accept input" },
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
    "Search, run and edit your macOS Shortcuts in a native Alfred window. ↩ runs, ⌘↩ runs with text, ⌥↩ edits. Universal Action and File Action “Run Shortcut” pass text, URLs or files. Command-K for actions; Back (Hyper+B) returns one level or to Swiss. Built with help from AI tools.",
};
