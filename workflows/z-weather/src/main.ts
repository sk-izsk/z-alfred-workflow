import { launchInput, backVariables, performBack } from "./navigation.ts";
import { forecastCards } from "./forecast.ts";
import { loadAirQuality, airForDate, airCategory } from "./air-quality.ts";
import { randomUUID } from "node:crypto";
import { report, cached, key } from "./api.ts";
import { create, read, save, cities, addCity, removeCity, type State } from "./state.ts";
import { summary, details, first, temperature, condition, hourLabel, cityQuery } from "./model.ts";
import {
  components,
  shortcuts,
  run,
  label,
  button,
  detailPane,
  detailPageSize,
  forecastPanel,
  visibleDetails,
} from "../ui/window.ts";
import {
  type Action,
  print,
  merge,
  errorStatus,
  update,
  vars,
  finish,
  status,
  sheet,
  popup,
  menuItem,
  separator,
  copy,
  open,
} from "./ui.ts";
const cityRows = (s: State): Action[] => {
  const q = s.query.trim().toLowerCase();
  const saved = cities().filter((c) => q.split(/\s+/).every((w) => c.query.toLowerCase().includes(w)));
  const rows = saved.map((c) => {
    const old = cached(c.query),
      h = old ? summary(old, 0, s.imperial) : null;
    return {
      uid: c.id,
      "cityTitle.text": c.query,
      "cityDesc.text": h
        ? `${h.description} · Cached ${new Date(old!.fetched).toLocaleTimeString()}`
        : "Saved city · Open weather report",
      "cityTemp.text": h?.temperature || "",
      "cityIcon.image.src": h?.icon || "cloud.sun.fill",
      "cityIcon.contenttintcolour": h?.colour || "systemOrangeColor",
    };
  });
  if (s.query.trim().length >= 2 && !cities().some((c) => c.query.toLowerCase() === q))
    rows.push({
      uid: `lookup:${encodeURIComponent(s.query.trim())}`,
      "cityTitle.text": `Look up “${s.query.trim()}”`,
      "cityDesc.text": "Search wttr.in for this location",
      "cityTemp.text": "",
      "cityIcon.image.src": "magnifyingglass",
      "cityIcon.contenttintcolour": "systemBlueColor",
    });
  return rows;
};
const render = (s: State): Action =>
  merge(
    vars({ weather_session: s.id }),
    update({ root: { components: components(s), shortcuts: shortcuts(s) } }, true),
  );
const populate = (s: State): Action =>
  s.mode === "cities"
    ? update({ items: { data: { src: cityRows(s) }, select: s.selected || cityRows(s)[0]?.uid || "" } })
    : merge(
        update({ details: { components: detailPane(s) } }, true),
        s.report?.air === undefined
          ? { pulse: { src: "../bin/wthr", args: ["air-quality", s.id], interval: 0, now: true } }
          : {},
      );
const screen = (s: State): Action => {
  const action = render(s);
  return merge(action, { pulse: { src: "../bin/wthr", args: ["populate", s.id], interval: 0, now: true } });
};
const openWeather = async (s: State, query: string, fresh = false): Promise<Action> => {
  const ticket = randomUUID();
  s.request = ticket;
  save(s);
  const result = await report(query, fresh),
    latest = read(s.id);
  if (latest.request !== ticket) return {};
  latest.forceAir = fresh;
  if (!fresh) {
    latest.forecastOffset = 0;
    latest.detailOffset = 0;
  }
  latest.city = query;
  latest.report = result.report;
  latest.stale = result.stale;
  latest.mode = "details";
  latest.day = fresh ? Math.min(latest.day, result.report.days.length - 1) : 0;
  save(latest);
  return screen(latest);
};
const resolveCity = (s: State, id: string): string => {
  const chosen = id || s.selected;
  if (chosen.startsWith("lookup:")) return cityQuery(decodeURIComponent(chosen.slice(7)));
  return cities().find((c) => c.id === chosen)?.query || cityQuery(s.query);
};
const addSheet = (): Action =>
  sheet("citySheet", {
    type: "view",
    layout: "border",
    padding: 20,
    spacing: 15,
    components: [
      label("citySheetTitle", "Add a saved city", {
        font: { size: 20, weight: "semibold" },
        constraints: { region: "top" },
      }),
      {
        id: "cityField",
        type: "textfield",
        text: "",
        placeholder: "City, country — e.g. Toronto, Canada",
        focus: true,
        constraints: { region: "centre", size: { width: 560 } },
      },
      label("cityError", "", { colour: "systemRedColor", constraints: { region: "top" } }),
      button("saveCity", "Save City", run("save-city", ["{value:cityField.text}"]), {
        shortcut: "↩",
        bordered: true,
        constraints: { region: "bottom", position: "right" },
      }),
    ],
  });
const hourly = (s: State): Action => {
  if (!s.report) throw new Error("Open a city first.");
  const day = s.report.days[s.day]!;
  return sheet("hourlySheet", {
    type: "view",
    layout: "border",
    padding: 18,
    spacing: 12,
    components: [
      label("hourlyTitle", `${s.report.city} · ${day.date} · Local time`, {
        font: { size: 19, weight: "semibold" },
        constraints: { region: "top" },
      }),
      {
        type: "dataview",
        data: {
          type: "basic",
          src: day.hourly.map((h: Record<string, unknown>) => ({
            "hourTime.text": hourLabel(h.time),
            "hourCondition.text": `${temperature(h, s.imperial)} · ${first(h.weatherDesc)}`,
            "hourRain.text": `Rain ${h.chanceofrain || "—"}%`,
            "hourIcon.image.src": condition(h.weatherCode).icon,
            "hourIcon.contenttintcolour": condition(h.weatherCode).colour,
          })),
        },
        constraints: { region: "centre", size: { width: 740, height: 360 } },
        cell: {
          height: 43,
          root: {
            type: "view",
            layout: "border",
            spacing: 14,
            padding: 7,
            components: [
              label("hourTime", "", {
                font: { size: 13, weight: "medium" },
                constraints: { region: "left", size: { width: 55 } },
              }),
              {
                type: "view",
                layout: "border",
                spacing: 12,
                constraints: { region: "centre" },
                components: [
                  {
                    id: "hourIcon",
                    type: "imageview",
                    image: { type: "symbol", src: "cloud.sun.fill", size: { width: 22, height: 22 } },
                    constraints: { region: "left", size: { width: 22, height: 22 } },
                  },
                  label("hourCondition", "", {
                    font: { size: 13 },
                    linebreak: "truncatetail",
                    constraints: { region: "centre" },
                  }),
                ],
              },
              label("hourRain", "", {
                font: { size: 12 },
                colour: "secondaryLabelColor",
                constraints: { region: "right", size: { width: 100 } },
              }),
            ],
          },
        },
      },
    ],
  });
};
const menu = (s: State, id: string): Action => {
  const location = s.mode === "details" ? s.city : resolveCity(s, id);
  const saved = cities().find((c) => c.id === key(location));
  return popup("actionsButton", [
    ...(s.mode === "cities"
      ? [menuItem("Show Weather", ["open", s.id, id], "↩")]
      : [
          menuItem("Hourly Forecast", ["hourly", s.id]),
          menuItem("Air Quality Details", ["air-details", s.id]),
          menuItem("Copy Weather Summary", ["copy", s.id]),
          menuItem("Show Location in Maps", ["maps", s.id]),
          menuItem("Open wttr.in", ["website", s.id]),
          menuItem("Saved Cities", ["cities", s.id]),
        ]),
    separator,
    ...(saved
      ? [menuItem("Remove Saved City", ["remove-city", s.id, saved.id])]
      : [menuItem("Save This City", ["save-current", s.id, location])]),
    menuItem("Add City…", ["add-city", s.id]),
    menuItem("Refresh", ["refresh", s.id], "⌘R"),
  ]);
};
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", ...args] = process.argv.slice(2);
  if (command === "prepare-origin") return vars(backVariables("weather_out", process.env.weather_query));
  if (command === "post") {
    if (process.env.weather_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (command === "launch") {
    const s = create(launchInput(process.env.weather_query).query);
    if (s.query) {
      s.fromList = false;
      save(s);
      return openWeather(s, s.query);
    }
    return screen(s);
  }
  const s = read(id);
  if (command === "air-quality") {
    if (s.mode !== "details" || !s.report) return {};
    const request = s.request,
      air = await loadAirQuality(s.report.latitude, s.report.longitude, !!s.forceAir),
      latest = read(id);
    if (latest.mode !== "details" || !latest.report || latest.request !== request) return {};
    latest.report.air = air;
    latest.forceAir = false;
    save(latest);
    return populate(latest);
  }
  if (command === "detail-scroll") {
    s.detailOffset = Math.max(
      0,
      Math.min(
        (s.detailOffset || 0) + Number(args[0] || 0),
        Math.max(0, visibleDetails(s).length - detailPageSize),
      ),
    );
    save(s);
    return update({ details: { components: detailPane(s) } }, true);
  }
  if (command === "forecast-scroll") {
    const count = forecastCards(s.report!, s.day, s.imperial, s.forecastMode || "hourly").length;
    s.forecastOffset = Math.max(
      0,
      Math.min((s.forecastOffset || 0) + Number(args[0] || 0), Math.max(0, count - 4)),
    );
    save(s);
    return update({ forecastPanel: { components: forecastPanel(s).components } }, true);
  }
  if (command === "forecast-mode") {
    s.forecastOffset = 0;
    s.forecastMode = args[0] === "daily" ? "daily" : "hourly";
    save(s);
    return update({ forecastPanel: { components: forecastPanel(s).components } }, true);
  }
  if (command === "populate") return populate(s);
  if (command === "filter") {
    s.query = args[0] || "";
    save(s);
    return populate(s);
  }
  if (command === "select") {
    s.selected = args[0] || "";
    save(s);
    return {};
  }
  if (command === "open") {
    s.fromList = true;
    save(s);
    return openWeather(s, resolveCity(s, args[0] || ""));
  }
  if (command === "back") {
    if (s.mode === "details" && s.fromList) {
      s.mode = "cities";
      save(s);
      return screen(s);
    }
    return finish(backVariables("weather_out", process.env.weather_query));
  }
  if (command === "cities") {
    s.mode = "cities";
    s.query = "";
    s.fromList = true;
    save(s);
    return screen(s);
  }
  if (command === "day") {
    const n = Number(args[0]);
    if (!Number.isInteger(n) || !s.report || n < 0 || n >= s.report.days.length)
      throw new Error("Choose an available forecast date.");
    s.day = n;
    s.forecastOffset = 0;
    save(s);
    return screen(s);
  }
  if (command === "units") {
    s.imperial = args[0] === "imperial";
    save(s);
    return screen(s);
  }
  if (command === "refresh") return s.mode === "details" ? openWeather(s, s.city, true) : screen(s);
  if (command === "add-city") return addSheet();
  if (command === "save-city" || command === "save-current") {
    addCity(args[0] || "");
    return merge(
      command === "save-city" ? { sheet: { close: "citySheet" } } : {},
      s.mode === "cities" ? screen(s) : status("City saved."),
    );
  }
  if (command === "remove-city") {
    removeCity(args[0] || "");
    return s.mode === "cities" ? screen(s) : status("City removed from saved locations.");
  }
  if (command === "air-details") {
    const r = s.report!,
      air = r.air,
      sample = air ? airForDate(air, r.days[s.day]!.date, s.day === 0) : null;
    const text =
      air && sample
        ? `US AQI: ${sample.index ?? "Unavailable"} · ${airCategory(sample.index).label}\nModeled for: ${sample.time} (${air.timezone})\nFetched: ${new Date(air.fetched).toLocaleString()}${air.stale ? " · Cached after failed refresh" : ""}\n${s.day === 0 ? `\nCurrent European AQI: ${air.current.european ?? "Unavailable"}\nCurrent PM2.5: ${air.current.pm25 ?? "Unavailable"} µg/m³\nCurrent PM10: ${air.current.pm10 ?? "Unavailable"} µg/m³\n` : ""}\nSource: Open-Meteo / CAMS atmospheric forecasts. This is model data, not a local sensor measurement.`
        : "Air-quality data is loading or unavailable. Unavailable does not mean clean air.\nSource: Open-Meteo / CAMS.";
    return sheet("airSheet", {
      type: "view",
      layout: "border",
      padding: 20,
      spacing: 12,
      components: [
        label("airTitle", `Air Quality · ${r.city}`, {
          font: { size: 20, weight: "semibold" },
          constraints: { region: "top" },
        }),
        {
          type: "textarea",
          text,
          editable: false,
          selectable: true,
          background: null,
          font: { size: 13 },
          constraints: { region: "centre", size: { width: 680, height: 300 } },
        },
      ],
    });
  }
  if (command === "hourly") return hourly(s);
  if (command === "menu") {
    if (s.mode === "cities" && !cities().length && !s.query)
      return popup("actionsButton", [menuItem("Add City…", ["add-city", s.id])]);
    return menu(s, args[0] || "");
  }
  if (command === "maps") {
    const r = s.report!;
    return open(`https://maps.apple.com/?ll=${r.latitude},${r.longitude}&q=${encodeURIComponent(r.city)}`);
  }
  if (command === "website") return open(`https://wttr.in/${encodeURIComponent(s.city)}`);
  if (command === "copy") {
    const r = s.report!,
      h = summary(r, s.day, s.imperial);
    return copy(
      `${h.title}\n${h.day.date} · ${h.temperature} · ${h.description}\n${details(r, s.day, s.imperial)
        .map((d) => `${d.title}: ${d.value}`)
        .join(
          "\n",
        )}\nSources: wttr.in; AQI: Open-Meteo / CAMS · Weather fetched ${new Date(r.fetched).toISOString()}`,
    );
  }
  throw new Error("Unknown Weather command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(
    process.argv[2] === "save-city"
      ? update({ cityError: { text: error instanceof Error ? error.message : String(error) } })
      : errorStatus(error),
  );
}
