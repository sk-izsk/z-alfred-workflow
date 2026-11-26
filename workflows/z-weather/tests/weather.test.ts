import { forecastCards } from "../src/forecast.ts";
import { airCategory, airForDate, parseAirQuality, loadAirQuality } from "../src/air-quality.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  cityQuery,
  parseReport,
  temperature,
  condition,
  details,
  summary,
  hourLabel,
  value,
} from "../src/model.ts";
import { components, detailPane } from "../ui/window.ts";
import { create, save, read, cities, addCity, removeCity } from "../src/state.ts";
import { report, key } from "../src/api.ts";
const root = mkdtempSync(join(tmpdir(), "weather-tests-"));
const previous = { ...process.env };
process.env.alfred_workflow_cache = join(root, "cache");
process.env.alfred_workflow_data = join(root, "data");
process.env.cities = "Example City, Example Country; London, UK";
afterAll(() => {
  for (const k of ["alfred_workflow_cache", "alfred_workflow_data", "cities"]) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
  rmSync(root, { recursive: true, force: true });
});
const hour = {
  time: "1200",
  tempC: "10",
  tempF: "50",
  FeelsLikeC: "8",
  FeelsLikeF: "46",
  weatherCode: "116",
  weatherDesc: [{ value: "Partly cloudy" }],
  humidity: "75",
  cloudcover: "50",
  windspeedKmph: "24",
  windspeedMiles: "15",
  winddir16Point: "S",
  winddirDegree: "180",
  uvIndex: "2",
  pressure: "1007",
  pressureInches: "29.74",
  visibility: "10",
  visibilityMiles: "6",
  precipMM: "0.2",
  precipInches: "0.01",
  chanceofrain: "20",
};
const raw = {
  nearest_area: [
    {
      areaName: [{ value: "Example City" }],
      region: [{ value: "Example Region" }],
      country: [{ value: "Example Country" }],
      latitude: "51.5",
      longitude: "-0.1",
    },
  ],
  current_condition: [{ ...hour, temp_C: "12", temp_F: "54", observation_time: "11:00 AM" }],
  weather: [
    {
      date: "2026-11-24",
      sunHour: "9.3",
      mintempC: "7",
      maxtempC: "13",
      mintempF: "45",
      maxtempF: "55",
      hourly: [{ ...hour, time: "900" }, hour],
      astronomy: [
        { sunrise: "06:38 AM", sunset: "05:47 PM", moon_phase: "Full Moon", moon_illumination: "100" },
      ],
    },
    { date: "2026-11-25", sunHour: "8.0", hourly: [{ ...hour, tempC: "9", tempF: "48" }], astronomy: [] },
  ],
};
const parsed = () => parseReport(structuredClone(raw), "Example City");
describe("weather measurements", () => {
  test("validates city queries before URL construction", () => {
    expect(cityQuery(" London, UK ")).toBe("London, UK");
    expect(() => cityQuery("x")).toThrow();
    expect(() => cityQuery("City\nCountry")).toThrow();
    expect(() => cityQuery("x".repeat(161))).toThrow();
  });
  test("parses resolved location and actual forecast dates", () => {
    expect(parsed()).toMatchObject({ city: "Example City", latitude: 51.5, longitude: -0.1 });
    expect(parsed().days).toHaveLength(2);
  });
  test("rejects missing weather and invalid coordinates", () => {
    expect(() => parseReport({}, "Example")).toThrow();
    expect(() =>
      parseReport({ ...raw, nearest_area: [{ ...raw.nearest_area[0], latitude: "999" }] }, "Example"),
    ).toThrow();
  });
  test("current and forecast temperatures use their own fields", () => {
    expect(temperature(raw.current_condition[0]!, false, true)).toBe("12 °C");
    expect(temperature(hour, true)).toBe("50 °F");
    expect(summary(parsed(), 1, false).temperature).toBe("9 °C");
  });
  test("details include every screenshot measurement", () => {
    const rows = details(parsed(), 0, false);
    for (const title of [
      "Feels Like",
      "UV Index",
      "Pressure",
      "Visibility",
      "Coordinates",
      "Sunrise / Sunset",
      "Humidity",
      "Wind",
      "Sunshine",
    ])
      expect(rows.some((r) => r.title === title)).toBe(true);
    expect(rows.find((r) => r.title === "Pressure")?.value).toBe("1007 hPa");
  });
  test("imperial uses provider conversions and missing values stay unknown", () => {
    expect(details(parsed(), 0, true).find((r) => r.title === "Pressure")?.value).toBe("29.74 inHg");
    expect(value(undefined, "% ")).toBe("—");
    expect(value("not a number")).toBe("—");
    expect(value("0", "mm")).toBe("0 mm");
  });
  test("maps conditions to colorful native symbols", () => {
    expect(condition(113).icon).toBe("sun.max.fill");
    expect(condition(296).colour).toBe("systemBlueColor");
    expect(condition(389).icon).toContain("bolt");
    expect(condition(999).icon).toBe("questionmark.circle");
  });
  test("hour labels are local forecast slots", () => {
    expect(hourLabel("0")).toBe("00:00");
    expect(hourLabel("1200")).toBe("12:00");
    expect(hourLabel("9999")).toBe("—");
  });
});
const invoke = (...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), ...args], {
      encoding: "utf8",
      env: {
        HOME: process.env.HOME,
        PATH: "/usr/bin:/bin",
        alfred_workflow_cache: process.env.alfred_workflow_cache,
        alfred_workflow_data: process.env.alfred_workflow_data,
        cities: process.env.cities,
      },
    }),
  );

describe("saved cities and navigation", () => {
  test("supports multiple predefined cities and persistent add/remove", () => {
    expect(cities()).toHaveLength(2);
    addCity("Paris, France");
    addCity("Paris, France");
    expect(cities().filter((c) => c.query === "Paris, France")).toHaveLength(1);
    removeCity(key("Paris, France"));
    expect(cities().some((c) => c.query === "Paris, France")).toBe(false);
    removeCity(key("London, UK"));
    expect(cities().some((c) => c.query === "London, UK")).toBe(false);
    addCity("London, UK");
    expect(cities().some((c) => c.query === "London, UK")).toBe(true);
  });
  test("Back from details restores the parent query and selected city", () => {
    const s = create("Example");
    s.selected = key("Example City, Example Country");
    s.mode = "details";
    s.city = "Example City";
    s.report = parsed();
    save(s);
    const result = invoke("back", s.id);
    expect(result).not.toHaveProperty("finish");
    expect(
      result.update.ids.root.components[0].components.some(
        (c: any) => c.id === "searchField" && c.text === "Example",
      ),
    ).toBe(true);
    const population = invoke("populate", s.id);
    expect(population.update.ids.items.select).toBe(s.selected);
    expect(invoke("back", s.id).finish.variables.weather_out).toBe("back");
  });
  test("direct city launch does not invent a previous list level", () => {
    const s = create("Example City");
    s.mode = "details";
    s.fromList = false;
    s.report = parsed();
    save(s);
    expect(invoke("back", s.id).finish.variables.weather_out).toBe("back");
  });
  test("forecast dates and units rerender without losing report", () => {
    const s = create("");
    s.mode = "details";
    s.report = parsed();
    save(s);
    expect(invoke("day", s.id, "1")).toHaveProperty("update");
    expect(invoke("units", s.id, "imperial")).toHaveProperty("update");
    expect(invoke("day", s.id, "99").update.ids.statusLabel.colour).toBe("systemRedColor");
  });
  test("native screen IDs and footer Back binding are unique", () => {
    const state = create("");
    for (const mode of ["cities", "details"] as const) {
      state.mode = mode;
      state.report = parsed();
      const ids: string[] = [],
        back: string[] = [];
      const visit = (v: unknown): void => {
        if (!v || typeof v !== "object") return;
        if (Array.isArray(v)) {
          v.forEach(visit);
          return;
        }
        const o = v as Record<string, unknown>;
        if (typeof o.id === "string") ids.push(o.id);
        if (o.shortcut === "{var:back_shortcut}") back.push(String(o.id));
        Object.values(o).forEach(visit);
      };
      visit(components(state));
      expect(new Set(ids).size).toBe(ids.length);
      expect(back).toEqual(["footerBack"]);
    }
  });
});
describe("provider cache", () => {
  test("fresh data is cached, failed refresh is visibly stale", async () => {
    const old = globalThis.fetch;
    let requests = 0;
    try {
      globalThis.fetch = (async () => {
        requests++;
        return new Response(JSON.stringify(raw), { status: 200 });
      }) as unknown as typeof fetch;
      const first = await report("Cache Test City");
      expect(first.stale).toBe(false);
      await report("Cache Test City");
      expect(requests).toBe(1);
      globalThis.fetch = (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch;
      expect((await report("Cache Test City", true)).stale).toBe(true);
    } finally {
      globalThis.fetch = old;
    }
  });
  test("a failed first fetch is an error, never fabricated weather", async () => {
    const old = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response("unavailable", { status: 503 })) as unknown as typeof fetch;
      await expect(report("Missing City Never Cached", true)).rejects.toThrow("HTTP 503");
    } finally {
      globalThis.fetch = old;
    }
  });
});

const nodes = (input: unknown): Record<string, any>[] => {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap(nodes);
  const object = input as Record<string, any>;
  return [object, ...Object.values(object).flatMap(nodes)];
};
describe("native split report and pagination", () => {
  test("forecast belongs to the overview and detail rows occupy separate vertical positions", () => {
    const s = create("");
    s.mode = "details";
    s.report = parsed();
    const tree = nodes(components(s)),
      overview = tree.find((n) => n.id === "weatherOverview");
    expect(nodes(overview).some((n) => n.id === "forecastPanel")).toBe(true);
    expect(tree.some((n) => n.type === "webkitview")).toBe(false);
    const rows = nodes(detailPane(s)).find((n) => n.id === "detailRows")!;
    expect(rows.layout).toBe("grid");
    expect(rows.rows).toBe(11);
    expect(rows.components).toHaveLength(11);
    expect(tree.some((n) => n.id === "detailsDown")).toBe(false);
    expect(tree.some((n) => n.id === "forecastNext")).toBe(true);
  });
  test("arrows clamp at the last measurement and preserve report state", () => {
    const s = create("");
    s.mode = "details";
    s.report = parsed();
    save(s);
    invoke("detail-scroll", s.id, "100");
    expect(read(s.id).detailOffset).toBe(0);
    expect(nodes(invoke("detail-scroll", s.id, "-100")).find((n) => n.id === "detailTitle0")?.text).toBe(
      "AQI (US)",
    );
    expect(read(s.id).detailOffset).toBe(0);
  });
  test("forecast pages keep hourly data, clamp edges and reset when switching tabs or dates", () => {
    const s = create("");
    s.mode = "details";
    s.report = parsed();
    s.report.days[0]!.hourly = Array.from({ length: 8 }, (_, i) => ({ ...hour, time: String(i * 300) }));
    save(s);
    invoke("forecast-scroll", s.id, "4");
    expect(read(s.id).forecastOffset).toBe(4);
    invoke("forecast-scroll", s.id, "100");
    expect(read(s.id).forecastOffset).toBe(5);
    invoke("forecast-mode", s.id, "daily");
    expect(read(s.id).forecastOffset).toBe(0);
    invoke("day", s.id, "1");
    expect(read(s.id).forecastOffset).toBe(0);
    expect(read(s.id).report!.days).toHaveLength(2);
  });
  test("forecast uses its own date, units and day/night conditions", () => {
    const r = parsed();
    r.days[0]!.hourly = [{ ...hour, time: "0", weatherCode: "113" }, hour];
    const cards = forecastCards(r, 0, true, "hourly");
    expect(cards[0]).toMatchObject({ emoji: "🌙", temperature: 50, time: "00:00" });
    expect(forecastCards(r, 1, false, "hourly")[0]).toMatchObject({ date: "2026-11-25", temperature: 9 });
    expect(forecastCards(r, 0, false, "daily")[0]).toMatchObject({ temperature: 13, low: 7 });
  });
});
const airRaw = {
  timezone: "Europe/London",
  current: { time: "2026-11-24T12:00", us_aqi: 56, european_aqi: 37, pm2_5: null, pm10: 13 },
  hourly: { time: ["2026-11-25T12:00"], us_aqi: [102] },
};
describe("air quality", () => {
  test("missing pollutants stay unknown and categories use US thresholds", () => {
    expect(parseAirQuality(airRaw).current.pm25).toBeNull();
    for (const [index, label] of [
      [0, "Good"],
      [50, "Good"],
      [51, "Moderate"],
      [101, "Unhealthy for sensitive groups"],
      [151, "Unhealthy"],
      [201, "Very unhealthy"],
      [301, "Hazardous"],
    ] as const)
      expect(airCategory(index).label).toBe(label);
    expect(airCategory(null).label).toBe("Unavailable");
    expect(() => parseAirQuality({ current: {} })).toThrow();
  });
  test("future AQI never falls back to a current reading", () => {
    const air = parseAirQuality(airRaw);
    expect(airForDate(air, "2026-11-24", true).index).toBe(56);
    expect(airForDate(air, "2026-11-25", false).index).toBe(102);
    expect(airForDate(air, "2026-11-26", false).index).toBeNull();
  });
  test("a failed AQI fetch keeps cached timestamps and never blocks weather", async () => {
    const old = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify(airRaw))) as unknown as typeof fetch;
      const first = await loadAirQuality(1, 2, true);
      expect(first?.current.us).toBe(56);
      globalThis.fetch = (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch;
      const stale = await loadAirQuality(1, 2, true);
      expect(stale).toMatchObject({ stale: true, fetched: first!.fetched });
      expect(await loadAirQuality(3, 4, true)).toBeNull();
    } finally {
      globalThis.fetch = old;
    }
  });
});

test("smoke, haze and unfamiliar provider codes have meaningful icons", () => {
  expect(condition(711, "Smoke").icon).toBe("cloud.fog.fill");
  expect(condition(999, "Haze").icon).toBe("cloud.fog.fill");
  expect(condition(999, "Light rain").icon).toBe("cloud.rain.fill");
  const r = parsed();
  r.days[0]!.hourly = [{ ...hour, weatherCode: "711", weatherDesc: [{ value: "Smoke" }] }];
  expect(forecastCards(r, 0, false, "hourly")[0]?.emoji).toBe("🌫️");
});
test("cache lifetime is configurable and failure metadata never makes data fresh", async () => {
  const oldFetch = globalThis.fetch,
    oldMinutes = process.env.cache_minutes;
  try {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify(raw));
    }) as unknown as typeof fetch;
    const query = "TTL Example City";
    await report(query);
    const path = join(root, "cache", `report-${key(query)}.json`);
    const stored = JSON.parse(await Bun.file(path).text());
    stored.fetched = Date.now() - 120000;
    await Bun.write(path, JSON.stringify(stored));
    process.env.cache_minutes = "10";
    await report(query);
    expect(calls).toBe(1);
    process.env.cache_minutes = "1";
    await report(query);
    expect(calls).toBe(2);
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const failed = await report(query, true);
    expect(failed.stale).toBe(true);
    expect((await report(query)).stale).toBe(true);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldMinutes === undefined) delete process.env.cache_minutes;
    else process.env.cache_minutes = oldMinutes;
  }
});

test("daily range uses the selected units and handles absent provider values", () => {
  const r = {
    days: [{ maxtempC: "12", mintempC: "-2", maxtempF: "54", mintempF: "28" }],
    current: {},
    city: "Example",
    region: "",
    country: "Example",
  } as any;
  expect(summary(r, 0, false).high).toBe("12 °C");
  expect(summary(r, 0, false).low).toBe("-2 °C");
  expect(summary(r, 0, true).high).toBe("54 °F");
  delete r.days[0].mintempF;
  expect(summary(r, 0, true).low).toBe("—");
});
