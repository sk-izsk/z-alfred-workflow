import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.weather",
  name: "Weather",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-weather",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Weather",
        subtext: "Saved cities, current conditions and forecasts",
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
      config: { path: "weather.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/wthr post",
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
    text("kw_main", "Weather keyword", "weather", "Open saved cities; append a city for its weather report."),
    text(
      "cities",
      "Predefined cities",
      "Toronto, Canada; London, United Kingdom",
      "Separate locations with semicolons; include countries to reduce ambiguity. More cities can be saved in the UI.",
    ),
    {
      type: "popupbutton",
      variable: "units",
      label: "Default units",
      description: "Can be changed in the details screen.",
      config: {
        default: "metric",
        pairs: [
          ["Metric (°C, km/h)", "metric"],
          ["Imperial (°F, mph)", "imperial"],
        ],
      },
    },
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open weather/location actions."),
    text(
      "back_shortcut",
      "Back shortcut",
      "⌘[",
      "Retrace city-list and details navigation; sheets return to their parent.",
    ),
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
  readme: `Type weather to browse saved cities, or weather London to open a report directly. Add multiple predefined cities in Workflow Configuration, separated by semicolons, or use Actions → Add City. Use the country name when cities share a name; the detail header shows the location actually returned by wttr.in.

Use arrows and Return, Command-K for actions, Command-R to refresh, and Command-[ to go Back one level. Details opened from the city list return to the same list/search; direct reports return to Alfred search. Sheets close to their parent. Back stays visible in every footer.

The left half shows current conditions and native Hourly/Daily forecast cards with left/right navigation arrows. The right half shows seven measurement rows with up/down arrows, without scrollbars. Details include AQI (US), feels-like temperature, humidity, cloud cover, wind, UV, pressure, visibility, precipitation, coordinates, sun/moon information and low/high temperatures. Choose another available date for a noon forecast; Hourly Forecast shows local forecast slots. Metric/imperial units are supported.

Weather comes from wttr.in (the provider used by the Raycast reference). Reports cache for ten minutes; refresh bypasses the cache. If refresh fails, a cached report is explicitly marked. Dates and observation times come from the service, and forecasts are estimates. City queries and your IP are visible to wttr.in. AQI comes from Open-Meteo / CAMS, uses a fifteen-minute cache and is modeled regional data. Resolved city coordinates and your IP are sent to Open-Meteo; no device location permission is requested.

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun, and an internet connection for new reports. No API key or runtime software installation is required.

The icon and inspiration come from Raycast Weather by tonka3000 and contributors (MIT). See THIRD_PARTY_NOTICES.md. This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
