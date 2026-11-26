import pkg from "../package.json" with { type: "json" };

const text = (variable: string, label: string, value: string, description: string, placeholder = value) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder, required: false },
});
const popup = (
  variable: string,
  label: string,
  value: string,
  pairs: [string, string][],
  description = "",
) => ({
  type: "popupbutton",
  variable,
  label,
  description,
  config: { default: value, pairs },
});
const check = (variable: string, label: string, value: boolean, caption: string, description = "") => ({
  type: "checkbox",
  variable,
  label,
  description,
  config: { default: value, text: caption },
});

export const infoPlist = {
  bundleid: "com.izsk.map",
  name: "Maps",
  createdby: "izsk",
  category: "Internet",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-map",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Maps",
        subtext: "Place, A > B route, or a copied address",
        argumenttype: 1,
        withspace: true,
      },
    },
    {
      uid: "TRIGGER",
      type: "alfred.workflow.trigger.external",
      version: 1,
      config: { triggerid: "route", availableviaurlhandler: false },
    },
    {
      uid: "UI",
      type: "alfred.workflow.userinterface.alfredui",
      version: 1,
      config: { path: "maps.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/zmap post",
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
      ["KEYWORD", "UI"],
      ["TRIGGER", "UI"],
      ["UI", "POST"],
    ].map(([a, b]) => [a, [{ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false }]]),
  ),
  uidata: {
    KEYWORD: { xpos: 30, ypos: 40 },
    TRIGGER: { xpos: 30, ypos: 180 },
    UI: { xpos: 230, ypos: 100 },
    POST: { xpos: 430, ypos: 100 },
  },
  userconfigurationconfig: [
    text(
      "kw_main",
      "Keyword",
      "maps",
      "Opens the map. Add a place, A > B, from A via B to C or von A über B nach C.",
    ),
    popup(
      "provider",
      "Routes and places",
      "open",
      [
        ["Open data (Transitous, OSRM), no key", "open"],
        ["Google (needs the Google key below)", "google"],
        ["HERE (needs the HERE key below)", "here"],
      ],
      "Google and HERE give car times with live traffic. Without the key, open data is used.",
    ),
    popup(
      "map_view",
      "Map",
      "auto",
      [
        ["Automatic (matches Routes and places)", "auto"],
        ["OpenFreeMap, no key", "openfreemap"],
        ["Google Maps (needs the Google key)", "google"],
        ["HERE (needs the HERE key)", "here"],
      ],
      "The map behind the routes. Each redraw of a Google map counts as one Google map load.",
    ),
    text(
      "google_api_key",
      "Google API key",
      "",
      "From console.cloud.google.com with billing on. Enable Maps JavaScript API, Routes API and Places API (New); restrict the key to those APIs (not to websites: the map is a local page). Never exported.",
      "optional",
    ),
    text(
      "here_api_key",
      "HERE API key",
      "",
      "A REST API key from platform.here.com. Stored in Alfred’s workflow preferences, never exported.",
      "optional",
    ),
    popup(
      "open_in",
      "Open in (⌘O)",
      "google",
      [
        ["Google Maps", "google"],
        ["Apple Maps", "apple"],
        ["OpenStreetMap", "osm"],
        ["HERE WeGo", "here"],
      ],
      "Opens the route with the addresses filled in. ⌘K offers the others.",
    ),
    popup("default_mode", "Default mode", "transit", [
      ["Transit", "transit"],
      ["Car", "car"],
      ["Bike", "bike"],
      ["Walk", "walk"],
    ]),
    text(
      "home_address",
      "Home address",
      "",
      "Used for “home” (also zuhause, daheim) and the Home button.",
      "optional",
    ),
    text(
      "work_address",
      "Work address",
      "",
      "Used for “work” (also office, arbeit, büro) and the Work button.",
      "optional",
    ),
    {
      type: "textarea",
      variable: "saved_places",
      label: "Saved places",
      description:
        "One per line: Label = address. Type the label instead of the address. ⌘K → Save Destination adds more.",
      config: { default: "", required: false, verticalsize: 4 },
    },
    check("show_quick", "Quick buttons", true, "Show Home, Work and saved places above the modes"),
    check(
      "clipboard_destination",
      "Clipboard",
      true,
      "Use a copied address as the destination",
      "When the keyword has no text and the clipboard holds one short address line, route from Home (if set) to it.",
    ),
    popup("language", "Language", "auto", [
      ["Automatic (macOS)", "auto"],
      ["English", "en"],
      ["Deutsch", "de"],
    ]),
    text(
      "start_region",
      "Search near",
      "",
      "City or region that place search prefers. Empty: the city of your time zone.",
      "e.g. Berlin",
    ),
    popup("map_style", "Map colours", "auto", [
      ["Automatic (light/dark)", "auto"],
      ["Dark", "dark"],
      ["Light", "light"],
    ]),
    text("map_scale", "Route line scale", "1", "0.85–1.3"),
    check("map_stop_names", "Stop names", true, "Show transfer stop names on the map"),
    text("font_fields", "Font: fields", "15", "Points"),
    text("font_duration", "Font: travel time", "32", "Points"),
    text("font_info", "Font: info line", "14", "Points"),
    text("window_width", "Window width", "1180", "700–2400 points; limited to the screen."),
    text("map_height", "Map height", "620", "300–1400 points."),
    text(
      "contact",
      "Contact e-mail",
      "",
      "Sent in the User-Agent so Transitous can reach you about heavy use, as they ask. Optional.",
      "optional",
    ),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Opens the Actions menu."),
    text("back_shortcut", "Back shortcut", "⌃⌥⇧⌘B", "Closes the map and returns to Alfred’s search."),
    text("node_path", "Node.js executable", "", "Optional absolute path if automatic discovery fails."),
  ],
  variablesdontexport: [
    "google_api_key",
    "here_api_key",
    "home_address",
    "work_address",
    "saved_places",
    "contact",
  ],
  readme: `Type maps and a place (maps Eiffel Tower) or a route: A > B, A > B > C, from A via B to C, or von A über B nach C. With nothing typed, a copied address becomes the destination. home and work use the addresses from Workflow Configuration; saved places work by their label.

While you type, suggestions appear under the modes (saved places first): Down/Up and Return, or a click, pick one. The Home, Work and saved-place buttons fill From while it is empty, otherwise To. Any field also takes coordinates like 45.4995, -73.5665.

Keys: Return routes; Return again or Command-O opens the route in Google Maps (or the app chosen in Configuration). Command-1 to Command-4 switch car, transit, bike and walk. Command-T swaps From and To. Command-U adds a stop (up to three); Shift-Command-U removes the last one. Command-K opens Actions: other map apps, copy link, save the destination as a place, clear. Back (Hyper+B by default) returns to Alfred’s search.

The map shows the route, stops and alternatives in light blue with their travel times; click one to choose it. Transit shows lines, platforms, transfers and delays.

Data: open data by default, no key: Transitous (transit, places), FOSSGIS OSRM (car, bike and walk alternatives, one request per second), Photon (place fallback) and OpenFreeMap with MapLibre GL. Optional Google (Places, Routes with live traffic, Google map) or HERE with your own API key. Places and routes are sent to these services. Results are cached (routes 10 minutes, places 7 days).

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun, and an internet connection. This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
