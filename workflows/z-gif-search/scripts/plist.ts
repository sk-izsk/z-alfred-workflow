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
  bundleid: "com.izsk.gif-search",
  name: "GIF Search",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-gif-search",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "GIF Search",
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
      config: { path: "gifsearch.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/gifsearch post",
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
    ].map(([a, b]) => [
      a,
      [{ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false }],
    ]),
  ),
  uidata: Object.fromEntries(
    ["KEYWORD", "TRIGGER", "MODE", "UI", "POST"].map((id, i) => [
      id,
      { xpos: i * 190, ypos: id === "TRIGGER" ? 180 : 40 },
    ]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Keyword", "gifsearch", "Open GIF Search."),
    ...hyperConfiguration(),
    {
      type: "popupbutton",
      variable: "default_provider",
      label: "GIF provider",
      config: {
        default: "giphy",
        pairs: [
          ["GIPHY (reference service)", "giphy"],
          ["Klipy (reference service)", "klipy"],
          ["GIPHY direct (your key)", "direct"],
          ["Finer GIFs Club", "finer"],
        ],
      },
    },
    text(
      "giphy_key",
      "GIPHY API key",
      "",
      "Only required for GIPHY direct. Kept in local workflow preferences; excluded from export.",
    ),
    text(
      "refresh_minutes",
      "Search cache (minutes)",
      "5",
      "0 always fetches; Command-R refreshes immediately. Maximum 60 minutes.",
    ),
    {
      type: "popupbutton",
      variable: "primary_action",
      label: "Return action",
      config: {
        default: "copyfile",
        pairs: [
          ["Copy GIF file", "copyfile"],
          ["Copy GIF link", "link"],
          ["Copy Markdown", "markdown"],
        ],
      },
    },
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
  variablesdontexport: ["giphy_key"],
  readme:
    "Search GIFs, favorites and recents with list/grid layouts. Use Command-K for actions. Back (Hyper+B) returns one level or to Swiss. Built with help from AI tools. See README for sources and limitations.",
};
