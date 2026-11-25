import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.world-clock",
  name: "World Clock",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-world-clock",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "World Clock",
        subtext: "Search timezones, star locations and compare local times",
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
      config: { path: "clock.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/wclock post",
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
      "World Clock keyword",
      "wclock",
      "Search cities, countries, timezones and saved aliases.",
    ),
    text(
      "starred_zones",
      "Initial starred timezones",
      "UTC; Europe/London; Asia/Dhaka; Asia/Tokyo; America/New_York",
      "Semicolon-separated IANA zones. Used before you customize stars in the UI.",
    ),
    {
      type: "popupbutton",
      variable: "layout",
      label: "Initial layout",
      config: {
        default: "list",
        pairs: [
          ["List", "list"],
          ["Analog grid", "grid"],
        ],
      },
    },
    {
      type: "checkbox",
      variable: "hour24",
      label: "Clock format",
      config: { default: true, text: "Use 24-hour time" },
    },
    {
      type: "popupbutton",
      variable: "date_format",
      label: "Date format",
      config: {
        default: "iso",
        pairs: [
          ["YYYY-MM-DD", "iso"],
          ["MM/DD/YYYY", "us"],
          ["DD/MM/YYYY", "eu"],
        ],
      },
    },
    {
      type: "popupbutton",
      variable: "columns",
      label: "Grid columns",
      config: {
        default: "5",
        pairs: [
          ["3", "3"],
          ["4", "4"],
          ["5", "5"],
          ["6", "6"],
        ],
      },
    },
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open clock actions."),
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
  readme: `Type wclock to search world timezones, representative cities, countries and custom aliases. Use the All/Starred/Other/region filter. Starred zones appear first. Command-L switches native list/analog grid, arrows navigate and Return copies the selected time.

Command-K includes Copy Time, Copy All Info, Timezone Details, Star/Unstar, Edit alias/avatar/memo, Duplicate and Move Up/Down for starred entries, List/Grid, Preferences and Refresh. Back is configurable (Command-[), visible outside Actions in every footer; sheets close to their parent. Swiss launches return to the launcher search/selection; direct launch Back returns to Alfred search.

Times and DST use the runtime’s IANA timezone data through Intl. No API, city location request or network dependency. Day/night icons indicate local clock hours (06:00–17:59 versus night), not sunrise/sunset. Times refresh at minute changes while open. Initial stars/layout/format come from Configuration; UI changes persist separately and override initial defaults.

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun. Icon/reference: Raycast World Clock by koinzhang and contributors, MIT. No menubar component. Built with help from AI tools.`,
};
