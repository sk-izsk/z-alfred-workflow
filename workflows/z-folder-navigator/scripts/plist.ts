import { terminalConfiguration } from "../../../shared/terminal.ts";
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
  bundleid: "com.izsk.folder-navigator",
  name: "Folder Navigator",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-folder-navigator",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Folder Navigator",
        subtext: "Find folders and browse their structure",
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
      config: { path: "folders.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/folders post",
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
    text("kw_main", "Keyword", "folders", "Open Folder Navigator."),
    text(
      "search_roots",
      "Search locations (including external drives)",
      "~;/Volumes",
      "Separate locations with semicolons, e.g. ~;/Volumes/My SSD/Projects. /Volumes searches mounted drives. Spotlight must index the locations.",
    ),
    text(
      "favorite_folders",
      "Starting folders",
      "~;~/Desktop;~/Documents;~/Downloads;/Applications;/Volumes",
      "Shown before a folder search is entered.",
    ),
    {
      type: "checkbox",
      variable: "show_hidden",
      label: "Dotfiles",
      config: { default: false, text: "Show dot-prefixed files initially" },
    },
    {
      type: "checkbox",
      variable: "show_volumes",
      label: "Mounted drives",
      config: { default: true, text: "Show external/mounted drives in the starting list" },
    },
    ...hyperConfiguration(),
    ...terminalConfiguration(),
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
    "Type folders to search indexed folders or enter an absolute path. Return browses folders and opens files; application/document packages open normally unless Show Package Contents is chosen. Search filters the current directory while browsing. Back (Command-[) restores each previous folder/search with its query and selected item, or returns to Swiss. Command-K offers Finder, path, Terminal, native Alfred File Actions, dotfiles and refresh. Initial search locations and folders are configurable. Built with help from AI tools; see README and notices.",
};
