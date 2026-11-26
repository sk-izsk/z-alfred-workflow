import { methods } from "../src/methods.ts";
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.adhan-time",
  name: "Adhan Time",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-adhan-time",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Adhan Time",
        subtext: "City-local prayer times and next-prayer countdown",
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
      config: { path: "adhan.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/adhan post",
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
    {
      type: "textfield",
      variable: "cache_minutes",
      label: "Calendar cache minutes",
      description:
        "1–10080 minutes. Manual Refresh bypasses cached results; provider publication frequency is independent.",
      config: { default: "1440", required: false },
    },

    text("kw_main", "Adhan Time keyword", "adhan", "View prayer times; optionally append City, Country."),
    text("city", "City", "", "City whose prayer times you want; can also be set in the window."),
    text("country", "Country", "", "Country for city disambiguation."),
    {
      type: "popupbutton",
      variable: "method",
      label: "Calculation method",
      description: "Choose the method used by your mosque. Provider method IDs are verified against Aladhan.",
      config: { default: "2", pairs: methods },
    },
    {
      type: "popupbutton",
      variable: "school",
      label: "Asr school",
      config: {
        default: "0",
        pairs: [
          ["Standard (Shafi / Maliki / Hanbali)", "0"],
          ["Hanafi", "1"],
        ],
      },
    },
    {
      type: "checkbox",
      variable: "twelve",
      label: "12-hour clock",
      config: { default: true, text: "Use AM / PM" },
    },
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open prayer time actions."),
    text("back_shortcut", "Back shortcut", "⌘[", "Back to Alfred; sheets return to the prayer calendar."),
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
  readme: `Type adhan to view your configured city, or adhan Toronto, Canada for another location. First launch opens Settings if city/country are missing. Choose the calculation method and Asr school used locally. In-window Settings are saved in Alfred workflow data and override Configuration defaults.

The native window shows next prayer/countdown, city timezone, Gregorian/Hijri dates, Fajr, Sunrise, Dhuhr, Asr, Maghrib and Isha. Sunrise is not counted as a prayer. Browse dates with arrows or Today. Command-K offers copying, calculation details, settings and refresh. Command-[ is configurable Back, visible in all footers; sheets return to their parent.

Aladhan supplies calculated times. Monthly calendars cache for 24 hours; refresh bypasses cache, failed refresh is marked cached. City/country and your IP are visible to Aladhan. Verify times/method with your mosque. No automatic audio/alarms or background service. Node.js 22+ or Bun and Alfred 6 Powerpack required.

Icon/reference: Raycast Adhan Time by mzaien and contributors, MIT. See THIRD_PARTY_NOTICES.md. Built with help from AI tools.`,
};
