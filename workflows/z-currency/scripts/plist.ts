import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.currency",
  name: "Currency Exchange",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-currency",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Currency Exchange",
        subtext: "Convert currencies, calculate amounts and pin favorites",
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
      config: { path: "currency.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/fx post",
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
      label: "Rates cache / refresh minutes",
      description:
        "1–10080 minutes. Manual Refresh bypasses cached results; provider publication frequency is independent.",
      config: { default: "60", required: false },
    },
    {
      type: "checkbox",
      variable: "auto_refresh",
      label: "Refresh while open",
      config: { default: true, text: "Refresh expired data while this window is open" },
    },

    text(
      "kw_main",
      "Currency Exchange keyword",
      "currency",
      "Convert an amount or arithmetic expression; optionally filter by currency/country.",
    ),
    {
      type: "popupbutton",
      variable: "provider",
      label: "Rate provider",
      description:
        "Open access covers 160+ currencies including BDT, with daily updates and no key. ECB covers about 30. History needs a supporting keyed plan.",
      config: {
        default: "open-er",
        pairs: [
          ["ExchangeRate-API Open — 160+ currencies (no key)", "open-er"],
          ["AllRatesToday — ECB reference (no key)", "allratestoday"],
          ["ExchangeRate-API", "exchangerate-api"],
          ["UniRateAPI", "unirate"],
        ],
      },
    },
    text(
      "api_key",
      "API key",
      "",
      "Key for the selected provider. Not required for Open Access or AllRatesToday. Stored in Alfred preferences; excluded from exports.",
    ),
    text(
      "base_currency",
      "Default base currency",
      "USD",
      "Three-letter currency code supported by your provider.",
    ),
    text(
      "secondary_currency",
      "Quick currency 2",
      "",
      "Three-letter code. Blank automatically chooses CAD when the primary is USD, otherwise USD. Shown as a pinned base button.",
    ),
    text(
      "third_currency",
      "Quick currency 3",
      "BDT",
      "Third pinned base currency. Choose a provider-supported three-letter code; duplicates are shown once.",
    ),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open currency actions."),
    text("back_shortcut", "Back shortcut", "⌘[", "Back to Alfred search; date sheet returns to conversion."),
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
  variablesdontexport: ["api_key"],
  readme: `Type currency, currency 100+24/12, or currency 100 in Canada. Choose a base with the compact searchable chooser or the three configured pinned buttons. The list shows only currencies supported by your provider; pinned targets appear first. Return copies the value, Command-K offers Copy, Pin/Unpin, Set Currency Date, Latest Rates, Refresh and Provider Documentation. Hyper+B is configurable Back and stays visible in all footers.

Default provider: ExchangeRate-API Open Access, no key, 160+ currencies including BDT, daily updates and no history. Rates By Exchange Rate API: https://www.exchangerate-api.com. ECB reference rates remain optional. Select ExchangeRate-API or UniRateAPI and supply your API key in Workflow Configuration for broader coverage. History depends on provider/plan and is never silently replaced by current rates. Keys are excluded from exports but stored in local Alfred preferences.

Arithmetic supports + - * / ^ % and parentheses without executing JavaScript. Use at YYYY/MM/DD for historical requests, or Actions → Set Currency Date. Rates are reference figures, not transaction quotes; the provider date is shown separately from fetch time. Cache lasts one hour and fallback is marked stale. Provider requests reveal your IP and selected date; conversion amounts are calculated locally.

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun. Icon/catalog/reference: Raycast Currency Exchange by xeric and contributors, MIT. See notices. Built with help from AI tools.`,
};
