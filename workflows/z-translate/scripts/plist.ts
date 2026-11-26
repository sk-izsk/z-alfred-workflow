import languages from "../assets/languages.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.translate",
  name: "Translate",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-translate",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Translate",
        subtext: "Translate typed or clipboard text with auto-detection",
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
      config: { path: "trns.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/trns post",
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
    text("kw_main", "Keyword", "translate", "Translate typed text or the clipboard."),
    {
      type: "popupbutton",
      variable: "source_language",
      label: "Initial source language",
      config: { default: "auto", pairs: languages.map((l) => [l.title, l.value]) },
    },
    {
      type: "popupbutton",
      variable: "target_language",
      label: "Initial target language",
      config: {
        default: "en",
        pairs: languages.filter((l) => l.value !== "auto").map((l) => [l.title, l.value]),
      },
    },
    {
      type: "checkbox",
      variable: "use_clipboard",
      label: "Clipboard",
      config: { default: true, text: "Read clipboard text when invoked without text" },
    },
    text(
      "cache_minutes",
      "Translation cache (minutes)",
      "0",
      "0 disables response caching; 1–10080 caches translations locally. Language choices persist separately.",
    ),
    text("back_shortcut", "Back shortcut", "⌘[", "Return one navigation level."),
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
    "Type translate to translate clipboard text, or add text after the keyword. Original text is editable on the left; translation appears on the right. Choose From/To languages at the top. Supports 50,000 characters through sequential requests. Command-K offers copy/paste, pronunciation, clipboard input, swap, continue, refresh, Google Translate and configuration. Copy is Command-Return; Swap is Command-L. Back (Command-[) returns to Swiss or Alfred search. The public Google endpoint requires no key and can rate limit requests. Built with help from AI tools; see README and bundled MIT notices for credits.",
};
