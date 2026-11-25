import type { State } from "../src/state.ts";
import { pinned } from "../src/state.ts";
import { currencyCode2Name as names, currencyCode2CountryAndRegion as countries } from "../src/catalog.ts";
export type Json = Record<string, any>;
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/fx",
  args: [cmd, "{var:fx_session}", ...args],
  async,
});
export const label = (id: string, text: string, extra: Json = {}): Json => ({
  id,
  type: "label",
  text,
  ...extra,
});
export const button = (id: string, text: string, action: Json, extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [{ triggers: "actioned", action }],
  ...extra,
});
export const flag = (code: string): string => {
  const region = code === "EUR" ? "EU" : code.slice(0, 2);
  return /^[A-WY-Z][A-Z]$/.test(region)
    ? [...region].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("")
    : "🌐";
};
export const converted = (s: State, code: string): number => {
  const rates = s.rates?.rates;
  if (!rates?.[s.base] || !rates[code])
    throw new Error("This currency is not available from the selected provider.");
  const result = (s.amount * rates[code]!) / rates[s.base]!;
  if (!Number.isFinite(result)) throw new Error("Converted amount is too large.");
  return result;
};
export const amountText = (n: number): string =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 4, minimumFractionDigits: 2 }).format(n);
export const rows = (s: State): Json[] => {
  if (!s.rates?.rates[s.base]) return [];
  const favorites = pinned();
  return Object.keys(s.rates.rates)
    .filter((code) =>
      `${code} ${names[code] || ""} ${countries[code] || ""}`.toLowerCase().includes(s.filter),
    )
    .toSorted((a, b) => Number(favorites.includes(b)) - Number(favorites.includes(a)) || a.localeCompare(b))
    .map((code) => ({
      uid: code,
      "rowFlag.text": flag(code),
      "rowTitle.text": `${code}  ${amountText(converted(s, code))}`,
      "rowDescription.text": `${favorites.includes(code) ? "📌  " : ""}${names[code] || code}`,
      "rowCountry.text": countries[code] || "",
    }));
};
export const components = (s: State): Json[] => [
  {
    type: "view",
    layout: "border",
    padding: 17,
    spacing: 14,
    constraints: { region: "top" },
    components: [
      {
        id: "query",
        type: "textfield",
        text: s.query,
        placeholder: "100+24/12 in Canada",
        background: null,
        bordered: false,
        focusring: false,
        focus: true,
        font: { size: 23, weight: "light" },
        events: [
          { triggers: "typingstopped", action: run("query", ["{value:self.text}"]) },
          { triggers: "actioned", action: run("copy", ["{value:items.selected.uid}"]) },
        ],
        constraints: { region: "centre" },
      },
      {
        id: "basePicker",
        type: "picker",
        bordered: false,
        items: Object.keys(s.rates?.rates || { [s.base]: 1 })
          .toSorted()
          .map((code) => ({
            text: `${flag(code)} ${code} — ${countries[code] || names[code] || code}`,
            value: code,
          })),
        selected: s.base,
        events: [{ triggers: "changed", action: run("base", ["{value:self.selected.value}"], false) }],
        constraints: { region: "right", size: { width: 290 } },
      },
      label(
        "sectionTitle",
        `${s.amount} ${s.base} · ${s.rates?.date || "Rate date unavailable"} · ${Object.keys(s.rates?.rates || {}).length} currencies · Pinned first`,
        {
          font: { size: 12 },
          colour: "secondaryLabelColor",
          constraints: { region: "bottom", insets: { left: 20, bottom: 8 } },
        },
      ),
    ],
  },

  {
    id: "items",
    type: "dataview",
    padding: 10,
    spacing: 4,
    data: { type: "basic", src: [] },
    placeholder:
      s.rates && !s.rates.rates[s.base]
        ? `${s.base} is unavailable from this provider. Choose a supported base.`
        : "No matching currency",
    constraints: { region: "centre" },
    events: [
      { triggers: "changed", action: run("select", ["{value:self.selected.uid}"], false) },
      { triggers: "actioned", action: run("copy", ["{value:self.selected.uid}"]) },
    ],
    cell: {
      height: 65,
      init: {
        "row.background": null,
        "rowTitle.colour": "labelColor",
        "rowDescription.colour": "secondaryLabelColor",
        "rowCountry.colour": "secondaryLabelColor",
      },
      selected: {
        "row.background": "alfredSelectedResultBackgroundColor",
        "rowTitle.colour": "alfredSelectedResultTextColor",
        "rowDescription.colour": "alfredSelectedResultTextColor",
        "rowCountry.colour": "alfredSelectedResultTextColor",
      },
      root: {
        id: "row",
        type: "view",
        layout: "border",
        padding: 10,
        spacing: 14,
        cornerradius: 8,
        components: [
          label("rowFlag", "", {
            font: { size: 25 },
            constraints: { region: "left", position: "centre", size: { width: 36 } },
          }),
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 4,
            constraints: { region: "centre", position: "left", stretch: "horizontal" },
            components: [
              label("rowTitle", "", { font: { size: 17, weight: "medium" }, linebreak: "truncatetail" }),
              label("rowDescription", "", { font: { size: 12 }, linebreak: "truncatetail" }),
            ],
          },
          label("rowCountry", "", {
            font: { size: 12 },
            linebreak: "truncatetail",
            textalign: "right",
            constraints: { region: "right", position: "centre", size: { width: 220 } },
          }),
        ],
      },
    },
  },
  {
    type: "view",
    layout: "border",
    padding: 15,
    spacing: 12,
    constraints: { region: "bottom" },
    components: [
      ...(s.rates?.provider === "open-er"
        ? [
            button("attribution", "Rates By Exchange Rate API", run("provider"), {
              font: { size: 11 },
              constraints: { region: "left", position: "centre" },
            }),
          ]
        : []),
      label(
        "statusLabel",
        s.rates?.stale
          ? "Cached rates · provider stale or refresh failed"
          : `${s.rates?.provider || "Rates"} · Reference rates`,
        {
          font: { size: 11 },
          tooltip: s.rates
            ? `Fetched ${new Date(s.rates.fetched).toISOString()} · Provider timestamp ${s.rates.asof}`
            : "",
          colour: s.rates?.stale ? "systemOrangeColor" : "secondaryLabelColor",
          linebreak: "truncatetail",
          constraints: { region: "centre", stretch: "horizontal" },
        },
      ),
      {
        type: "view",
        layout: "inline",
        spacing: 12,
        constraints: { region: "right" },
        components: [
          button("back", "Back  {var:back_shortcut}", run("back", [], false), {
            shortcut: "{var:back_shortcut}",
          }),
          button("copyButton", "Copy  ↩", run("copy", ["{value:items.selected.uid}"])),
          button(
            "actionsButton",
            "Actions  {var:actions_shortcut}",
            run("menu", ["{value:items.selected.uid}"]),
          ),
        ],
      },
    ],
  },
];
export const currencyWindow = {
  bundleid: "com.izsk.currency",
  variablesconfig: {
    swiss_return: { default: "" },
    fx_session: { default: "", scriptenv: true },
    fx_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌘[" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "Currency Exchange",
    size: { height: 600 },
    minsize: { width: 850, height: 550 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [
        { triggers: "preload", action: { type: "json", src: { window: { resize: { width: 900 } } } } },
        { triggers: "launched", action: [run("prepare-origin", [], false), run("launch")] },
      ],
      shortcuts: [
        { shortcut: "↑", action: { type: "function", src: "items", args: "selectprevious" } },
        { shortcut: "↓", action: { type: "function", src: "items", args: "selectnext" } },
        { shortcut: "{var:actions_shortcut}", action: run("menu", ["{value:items.selected.uid}"]) },
        { shortcut: "⌘R", action: run("refresh") },
      ],
      components: [
        label("statusLabel", "Loading rates…", { constraints: { region: "centre", position: "centre" } }),
        button(
          "initialBack",
          "Back  {var:back_shortcut}",
          {
            type: "json",
            src: { finish: { variables: { fx_out: "back", swiss_return: "{var:swiss_return}" } } },
          },
          {
            shortcut: "{var:back_shortcut}",
            constraints: { region: "bottom", position: "left", insets: { left: 16, bottom: 16 } },
          },
        ),
      ],
    },
  },
};
