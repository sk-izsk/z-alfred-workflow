import { STANDARD_WIDTH } from "../../../shared/ui-profile.ts";
import { forecastCards } from "../src/forecast.ts";
import { type State } from "../src/state.ts";
import { summary, value, details } from "../src/model.ts";
export type Json = Record<string, unknown>;
export const run = (command: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/wthr",
  args: [command, "{var:weather_session}", ...args],
  async,
});
export const json = (src: Json): Json => ({ type: "json", src });
export const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
export const label = (id: string, text: string, extra: Json = {}): Json => ({
  id,
  type: "label",
  text,
  ...extra,
});
export const button = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});
const icon = (id: string, src: string, colour: string, size = 22): Json => ({
  id,
  type: "imageview",
  image: { type: "symbol", src, size: { width: size, height: size } },
  contenttintcolour: colour,
  constraints: { size: { width: size, height: size } },
});
const selected = "{value:items.selected.uid}";
const loading = json({
  update: { ids: { statusLabel: { text: "Loading weather…", colour: "secondaryLabelColor" } } },
});
const header = (content: Json, right?: Json): Json => ({
  type: "view",
  layout: "border",
  padding: 17,
  spacing: 14,
  constraints: { region: "top" },
  components: [
    button("headerBack", "‹", run("back", [], false), {
      font: { size: 27 },
      constraints: { region: "left", position: "centre" },
    }),
    { ...content, constraints: { region: "centre", stretch: "horizontal", position: "centre" } },
    ...(right ? [{ ...right, constraints: { region: "right", position: "centre" } }] : []),
  ],
});
const footer = (s: State): Json => ({
  type: "view",
  layout: "border",
  padding: 15,
  spacing: 12,
  constraints: { region: "bottom" },
  components: [
    label(
      "statusLabel",
      s.stale
        ? "Cached report · refresh failed"
        : s.mode === "details"
          ? `wttr.in · AQI: Open-Meteo / CAMS`
          : "Saved cities · type a city to look up",
      {
        font: { size: 11.5 },
        colour: s.stale ? "systemOrangeColor" : "secondaryLabelColor",
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
        button("footerBack", "Back  {var:back_shortcut}", run("back", [], false), {
          shortcut: "{var:back_shortcut}",
        }),
        ...(s.mode === "cities"
          ? [button("openButton", "Show Weather  ↩", [loading, run("open", [selected])])]
          : [button("hourlyButton", "Hourly Forecast", run("hourly"))]),
        button(
          "actionsButton",
          "Actions  {var:actions_shortcut}",
          run("menu", [s.mode === "cities" ? selected : ""]),
        ),
      ],
    },
  ],
});
const list = (s: State): Json[] => [
  header({
    id: "searchField",
    type: "textfield",
    text: s.query,
    placeholder: "Search saved cities or look up a location…",
    background: null,
    bordered: false,
    focusring: false,
    focus: true,
    font: { size: 23, weight: "light" },
    events: [
      on("changed", run("filter", ["{value:self.text}"], false)),
      on("actioned", [loading, run("open", [selected])]),
    ],
  }),
  {
    id: "items",
    type: "dataview",
    padding: 10,
    spacing: 3,
    placeholder: "No saved cities. Type a city to look it up.",
    data: { type: "basic", src: [] },
    constraints: { region: "centre" },
    events: [
      on("changed", run("select", [selected], false)),
      on("actioned", [loading, run("open", [selected])]),
    ],
    cell: {
      height: 63,
      init: {
        "row.background": null,
        "cityTitle.colour": "labelColor",
        "cityDesc.colour": "secondaryLabelColor",
      },
      selected: {
        "row.background": "alfredSelectedResultBackgroundColor",
        "cityTitle.colour": "alfredSelectedResultTextColor",
        "cityDesc.colour": "alfredSelectedResultTextColor",
      },
      root: {
        id: "row",
        type: "view",
        layout: "border",
        padding: 11,
        spacing: 13,
        cornerradius: 8,
        components: [
          {
            ...icon("cityIcon", "cloud.sun.fill", "systemOrangeColor", 28),
            constraints: { region: "left", position: "centre", size: { width: 28, height: 28 } },
          },
          {
            type: "view",
            layout: "border",
            spacing: 4,
            constraints: { region: "centre" },
            components: [
              label("cityTitle", "", {
                font: { size: 15, weight: "medium" },
                linebreak: "truncatetail",
                constraints: { region: "top" },
              }),
              label("cityDesc", "", {
                font: { size: 12 },
                linebreak: "truncatetail",
                colour: "secondaryLabelColor",
                constraints: { region: "bottom" },
              }),
            ],
          },
          label("cityTemp", "", {
            font: { size: 18, weight: "light" },
            constraints: { region: "right", position: "centre", size: { width: 80 } },
          }),
        ],
      },
    },
  },
  footer(s),
];
export const visibleDetails = (s: State) =>
  details(s.report!, s.day, s.imperial).filter(
    (d) => !["Sunrise / Sunset", "Sunshine", "Low / High"].includes(d.title),
  );
const arrowButton = (id: string, text: string, action: Json, enabled = true): Json => ({
  type: "view",
  layout: "stack",
  cornerradius: 16,
  border: { width: 1, colour: "separatorColor" },
  constraints: { size: { width: 32, height: 32 } },
  components: [button(id, text, action, { font: { size: 19 }, enabled })],
});
export const detailPageSize = 11;
export const detailPane = (s: State): Json[] => {
  const all = visibleDetails(s),
    page = detailPageSize,
    offset = Math.max(0, Math.min(s.detailOffset || 0, Math.max(0, all.length - page)));
  return [
    label("detailHeading", "WEATHER DETAILS", {
      font: { size: 11, weight: "semibold" },
      colour: "secondaryLabelColor",
      constraints: { region: "top", insets: { left: 8, top: 4 } },
    }),
    {
      id: "detailRows",
      type: "view",
      layout: "grid",
      rows: Math.min(page, all.length),
      cols: 1,
      spacing: 3,
      constraints: { region: "centre" },
      components: all.slice(offset, offset + page).map((d, i) => ({
        type: "view",
        layout: "border",
        spacing: 10,
        padding: 8,
        constraints: { stretch: "horizontal", size: { height: 43 } },
        components: [
          {
            ...icon(`detailIcon${i}`, d.icon, d.colour, 22),
            constraints: { region: "left", position: "centre", size: { width: 22, height: 22 } },
          },
          label(`detailTitle${i}`, d.title, {
            font: { size: 14 },
            textalign: "left",
            constraints: { region: "centre", position: "left", stretch: "horizontal" },
          }),
          label(`detailValue${i}`, d.value, {
            font: { size: 13 },
            colour: "secondaryLabelColor",
            tooltip: d.tooltip || d.value,
            textalign: "right",
            linebreak: "truncatetail",
            constraints: { region: "right", position: "centre", size: { width: 138 } },
          }),
        ],
      })),
    },
    ...(all.length > page
      ? [
          {
            type: "view",
            layout: "border",
            padding: 8,
            constraints: { region: "bottom" },
            components: [
              label("detailRange", `${offset + 1}–${Math.min(all.length, offset + page)} of ${all.length}`, {
                font: { size: 10 },
                colour: "secondaryLabelColor",
                constraints: { region: "left", position: "centre" },
              }),
              {
                type: "view",
                layout: "inline",
                spacing: 9,
                constraints: { region: "right" },
                components: [
                  arrowButton("detailsUp", "↑", run("detail-scroll", ["-1"], false), offset > 0),
                  arrowButton(
                    "detailsDown",
                    "↓",
                    run("detail-scroll", ["1"], false),
                    offset + page < all.length,
                  ),
                ],
              },
            ],
          },
        ]
      : []),
  ];
};
export const forecastPanel = (s: State): Json => {
  const mode = s.forecastMode || "hourly",
    cards = forecastCards(s.report!, s.day, s.imperial, mode),
    offset = Math.max(0, Math.min(s.forecastOffset || 0, Math.max(0, cards.length - 4)));
  return {
    id: "forecastPanel",
    type: "view",
    layout: "border",
    padding: 4,
    spacing: 10,
    constraints: { region: "bottom" },
    components: [
      {
        type: "view",
        layout: "inline",
        spacing: 16,
        constraints: { region: "top", position: "left" },
        components: ["hourly", "daily"].map((tab) =>
          button(`${tab}Tab`, tab === "hourly" ? "Hourly" : "Daily", run("forecast-mode", [tab], false), {
            font: { size: 12, weight: mode === tab ? "semibold" : "regular" },
            contenttintcolour: mode === tab ? "labelColor" : "secondaryLabelColor",
          }),
        ),
      },
      {
        id: "forecastCards",
        type: "view",
        layout: "grid",
        rows: 1,
        cols: 4,
        spacing: 6,
        constraints: { region: "centre", size: { height: 124 } },
        components: cards.slice(offset, offset + 4).map((card, i) => ({
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 5,
          tooltip: `${card.date} ${card.time} · ${card.description}`,
          constraints: { position: "top" },
          components: [
            label(
              `forecastDate${i}`,
              new Date(`${card.date}T12:00:00Z`).toLocaleDateString("en", {
                timeZone: "UTC",
                month: "short",
                day: "numeric",
              }),
              { font: { size: 10 }, colour: "secondaryLabelColor" },
            ),
            label(`forecastTime${i}`, card.time, { font: { size: 11 } }),
            label(`forecastIcon${i}`, card.emoji, { font: { size: 25 } }),
            label(
              `forecastTemp${i}`,
              card.temperature === null
                ? "—"
                : `${Math.round(card.temperature)}°${card.low === null ? "" : ` / ${Math.round(card.low)}°`}`,
              { font: { size: 15, weight: "medium" } },
            ),
            label(`forecastRain${i}`, card.rain === null ? "—" : `💧 ${Math.round(card.rain)}%`, {
              font: { size: 10 },
              colour: "secondaryLabelColor",
            }),
          ],
        })),
      },
      {
        type: "view",
        layout: "border",
        constraints: { region: "bottom" },
        components: [
          label("forecastCaption", `Local times · ${s.imperial ? "°F" : "°C"}`, {
            font: { size: 10 },
            colour: "secondaryLabelColor",
            constraints: { region: "left", position: "centre" },
          }),
          {
            type: "view",
            layout: "inline",
            spacing: 8,
            constraints: { region: "right" },
            components: [
              arrowButton("forecastPrevious", "←", run("forecast-scroll", ["-4"], false), offset > 0),
              arrowButton(
                "forecastNext",
                "→",
                run("forecast-scroll", ["4"], false),
                offset + 4 < cards.length,
              ),
            ],
          },
        ],
      },
    ],
  };
};
const detail = (s: State): Json[] => {
  const r = s.report!,
    hero = summary(r, s.day, s.imperial);
  return [
    header(
      label("locationTitle", hero.title, {
        font: { size: 20, weight: "semibold" },
        tooltip: hero.title,
        linebreak: "truncatetail",
      }),
      {
        type: "view",
        layout: "inline",
        spacing: 12,
        components: [
          {
            id: "dayPicker",
            type: "picker",
            bordered: false,
            constraints: { size: { width: 190 } },
            items: r.days.map((d, i) => ({
              text: `${d.date}${i === 0 ? " · Current" : " · Noon forecast"}`,
              value: String(i),
            })),
            selected: String(s.day),
            events: [on("changed", run("day", ["{value:self.selected.value}"], false))],
          },
          {
            id: "unitPicker",
            type: "picker",
            bordered: false,
            constraints: { size: { width: 70 } },
            items: [
              { text: "°C", value: "metric" },
              { text: "°F", value: "imperial" },
            ],
            selected: s.imperial ? "imperial" : "metric",
            events: [on("changed", run("units", ["{value:self.selected.value}"], false))],
          },
        ],
      },
    ),
    {
      id: "weatherColumns",
      type: "view",
      layout: "grid",
      rows: 1,
      cols: 2,
      padding: 16,
      spacing: 18,
      constraints: { region: "centre" },
      components: [
        {
          id: "weatherOverview",
          type: "view",
          layout: "border",
          padding: 10,
          spacing: 20,
          components: [
            forecastPanel(s),
            {
              type: "view",
              layout: "inline",
              direction: "vertical",
              spacing: 9,
              constraints: { region: "centre", position: "centre" },
              components: [
                icon("conditionIcon", hero.icon, hero.colour, 88),
                label("temperature", hero.temperature, {
                  font: { size: 64, weight: "ultralight" },
                  textalign: "centre",
                }),
                label("conditionDescription", hero.description, {
                  font: { size: 23, weight: "medium" },
                  textalign: "centre",
                  linebreak: "truncatetail",
                  tooltip: hero.description,
                  constraints: { size: { width: 280 } },
                }),
                label("overviewCity", r.query, {
                  font: { size: 17 },
                  colour: "secondaryLabelColor",
                  textalign: "centre",
                  linebreak: "truncatetail",
                  tooltip: hero.title,
                  constraints: { size: { width: 280 } },
                }),
                label(
                  "overviewRange",
                  `H ${value(hero.day[s.imperial ? "maxtempF" : "maxtempC"], s.imperial ? "°F" : "°C")}    L ${value(hero.day[s.imperial ? "mintempF" : "mintempC"], s.imperial ? "°F" : "°C")}`,
                  { font: { size: 16 }, textalign: "centre" },
                ),
                {
                  type: "view",
                  layout: "inline",
                  spacing: 20,
                  components: [
                    {
                      type: "view",
                      layout: "inline",
                      spacing: 6,
                      components: [
                        icon("overviewSunriseIcon", "sunrise.fill", "systemOrangeColor", 18),
                        label("overviewSunrise", hero.day.astronomy?.[0]?.sunrise || "—", {
                          font: { size: 13 },
                        }),
                      ],
                    },
                    {
                      type: "view",
                      layout: "inline",
                      spacing: 6,
                      components: [
                        icon("overviewSunsetIcon", "sunset.fill", "systemOrangeColor", 18),
                        label("overviewSunset", hero.day.astronomy?.[0]?.sunset || "—", {
                          font: { size: 13 },
                        }),
                      ],
                    },
                  ],
                },
                label("overviewSunshine", `${value(hero.day.sunHour, "hours", 1)} of sunshine`, {
                  font: { size: 12 },
                  colour: "secondaryLabelColor",
                  textalign: "centre",
                }),
                label(
                  "observed",
                  hero.current
                    ? `Observed ${r.current.observation_time || "—"} UTC · ${hero.day.date}`
                    : `${hero.day.date} · Forecast at 12:00 local time`,
                  {
                    font: { size: 11 },
                    colour: "secondaryLabelColor",
                    textalign: "centre",
                    linebreak: "wordwrap",
                    constraints: { size: { width: 280 } },
                  },
                ),
              ],
            },
          ],
        },
        {
          type: "view",
          layout: "border",
          spacing: 14,
          components: [
            {
              type: "view",
              background: "separatorColor",
              constraints: { region: "left", size: { width: 1 } },
            },
            {
              id: "details",
              type: "view",
              layout: "border",
              spacing: 10,
              padding: 3,
              constraints: { region: "centre" },
              components: detailPane(s),
            },
          ],
        },
      ],
    },
    footer(s),
  ];
};
export const components = (s: State): Json[] => (s.mode === "cities" ? list(s) : detail(s));
export const shortcuts = (s: State): Json[] => [
  ...(s.mode === "details"
    ? [
        { shortcut: "←", action: run("forecast-scroll", ["-4"], false) },
        { shortcut: "→", action: run("forecast-scroll", ["4"], false) },
      ]
    : []),
  {
    shortcut: "↑",
    action:
      s.mode === "cities"
        ? { type: "function", src: "items", args: "selectprevious" }
        : run("detail-scroll", ["-1"], false),
  },
  {
    shortcut: "↓",
    action:
      s.mode === "cities"
        ? { type: "function", src: "items", args: "selectnext" }
        : run("detail-scroll", ["1"], false),
  },
  { shortcut: "{var:actions_shortcut}", action: run("menu", [s.mode === "cities" ? selected : ""]) },
  { shortcut: "⌘R", action: [loading, run("refresh")] },
];
export const weatherWindow = {
  bundleid: "com.izsk.weather",
  log: { level: "error", internal: true },
  variablesconfig: {
    swiss_return: { default: "" },
    weather_session: { default: "", scriptenv: true },
    weather_query: { src: "args[0]", default: "", scriptenv: true },
    actions_shortcut: { src: "variable", default: "⌘K" },
    back_shortcut: { src: "variable", default: "⌘[" },
  },
  window: {
    title: "Weather",
    size: { height: 800 },
    minsize: { width: 560, height: 540 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [
        on("preload", json({ window: { resize: { width: STANDARD_WIDTH } } })),
        on("launched", [run("prepare-origin", [], false), run("launch")]),
      ],
      shortcuts: [
        { shortcut: "↑", action: { type: "function", src: "items", args: "selectprevious" } },
        { shortcut: "↓", action: { type: "function", src: "items", args: "selectnext" } },
        { shortcut: "{var:actions_shortcut}", action: run("menu", [selected]) },
        { shortcut: "⌘R", action: [loading, run("refresh")] },
      ],
      components: [
        label("initialTitle", "Weather", {
          font: { size: 24, weight: "semibold" },
          constraints: { region: "centre", position: "centre" },
        }),
        label("statusLabel", "Loading weather…", {
          colour: "secondaryLabelColor",
          constraints: { region: "top", position: "centre", insets: { top: 24 } },
        }),
        button(
          "initialBack",
          "Back  {var:back_shortcut}",
          {
            type: "json",
            src: { finish: { variables: { weather_out: "back", swiss_return: "{var:swiss_return}" } } },
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
