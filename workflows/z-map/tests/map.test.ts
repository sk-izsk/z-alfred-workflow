import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep caches out of Alfred's folders.
const dir = mkdtempSync(join(tmpdir(), "zmap-test-"));
process.env.alfred_workflow_cache = join(dir, "cache");
process.env.alfred_workflow_data = join(dir, "data");

const { parseQuery, expandAlias, looksLikeAddress, parseFavourites, clean } = await import("../src/parse.ts");
const { decodePolyline, decodeFlexible } = await import("../src/polyline.ts");
const { chain } = await import("../src/model.ts");
const { directionsUrl } = await import("../src/links.ts");
const { longDuration, shortDuration, distance, pickLang } = await import("../src/i18n.ts");
const { stepRows, infoLine } = await import("../src/view.ts");
const { mapPage } = await import("../src/page.ts");
const { setFetcher } = await import("../src/net.ts");
const open = await import("../src/open.ts");
const { mapWindow, rest, viaSlot } = await import("../ui/window.ts");

const place = (label: string, lat: number, lon: number) => ({ query: label, label, lat, lon });
const loc = { lang: "en" as const, locale: "en-GB", hour12: false, metric: true };

describe("input", () => {
  test("place, routes and stops", () => {
    expect(parseQuery("Eiffel Tower")).toEqual({ from: "", to: "Eiffel Tower", via: [] });
    expect(parseQuery("A > B")).toEqual({ from: "A", to: "B", via: [] });
    expect(parseQuery("A > B > C > D > E > F")).toEqual({
      from: "A",
      to: "F",
      via: ["B", "C", "D"],
    });
    expect(parseQuery("from Old Town via Museum to Harbour")).toEqual({
      from: "Old Town",
      to: "Harbour",
      via: ["Museum"],
    });
    expect(parseQuery("von Markt über Park über Zoo nach Bahnhof")).toEqual({
      from: "Markt",
      to: "Bahnhof",
      via: ["Park", "Zoo"],
    });
    expect(parseQuery("<null>")).toEqual({ from: "", to: "", via: [] });
    expect(clean(" (null) ")).toBe("");
  });

  test("home, work and saved places", () => {
    const saved = {
      home: "Example Street 1",
      work: "Sample Road 2",
      favourites: parseFavourites("Gym = Test Lane 3\nbad line\nBakery=Main St = 4"),
    };
    expect(saved.favourites).toEqual([
      { label: "Gym", address: "Test Lane 3" },
      { label: "Bakery", address: "Main St = 4" },
    ]);
    expect(expandAlias("Zuhause", saved)).toBe("Example Street 1");
    expect(expandAlias("büro", saved)).toBe("Sample Road 2");
    expect(expandAlias("gym", saved)).toBe("Test Lane 3");
    expect(expandAlias("Harbour", saved)).toBe("Harbour");
    expect(expandAlias("home", { home: "", work: "", favourites: [] })).toBe("home");
  });

  test("clipboard addresses", () => {
    expect(looksLikeAddress("10 Example Street, Springfield")).toBe(true);
    expect(looksLikeAddress("https://example.com/a")).toBe(false);
    expect(looksLikeAddress("line one\nline two")).toBe(false);
    expect(looksLikeAddress('{"json":1}')).toBe(false);
    expect(looksLikeAddress("12")).toBe(false);
  });
});

describe("polylines", () => {
  test("Google polyline reference", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });
  test("HERE flexible polyline reference", () => {
    expect(decodeFlexible("BFoz5xJ67i1B1B7PzIhaxL7Y")).toEqual([
      [8.69821, 50.10228],
      [8.69567, 50.10201],
      [8.6915, 50.10063],
      [8.68752, 50.09878],
    ]);
  });
});

describe("routes", () => {
  const stop = (name: string, time: number) => ({ name, lat: 0, lon: 0, time });
  const ride = (line: string, from: number, to: number) => ({
    mode: "SUBURBAN",
    transit: true,
    line,
    color: "#0066ad",
    headsign: "Terminus",
    from: { ...stop("North", from), track: "4" },
    to: { ...stop("South", to), delay: 2 },
    coords: [] as [number, number][],
    stops: 3,
    duration: (to - from) / 1000,
  });

  test("stops chain into one option with a transfer", () => {
    const a = {
      duration: 600,
      dep: 0,
      arr: 600_000,
      transfers: 0,
      distance: 1000,
      legs: [ride("S1", 0, 600_000)],
    };
    const b = {
      duration: 300,
      dep: 900_000,
      arr: 1_200_000,
      transfers: 1,
      distance: 500,
      legs: [ride("S2", 900_000, 1_200_000)],
    };
    expect(chain([a, b])).toMatchObject({
      duration: 1200,
      transfers: 2,
      distance: 1500,
      dep: 0,
      arr: 1_200_000,
    });
  });

  test("itinerary rows and info line", () => {
    const option = {
      duration: 1200,
      dep: 0,
      arr: 1_200_000,
      transfers: 1,
      legs: [ride("S1", 0, 600_000), ride("U2", 900_000, 1_200_000)],
    };
    const utc = { ...loc, locale: "en-GB" };
    process.env.TZ = "UTC";
    const rows = stepRows(option, utc).map((r) => `${r["stime.text"] ?? ""}|${r["stext.text"]}`);
    expect(rows[0]).toBe("S1|→ Terminus · 3 stops");
    expect(rows[1]).toBe("0:00|North · Pl. 4");
    expect(rows[2]).toBe("0:10|South +2 min");
    expect(rows[3]).toBe("|Transfer · 5 min");
    expect(infoLine(option, "transit", { ...utc, locale: "de-DE", lang: "de" })).toBe(
      "ab 0:00 · an 0:20 · 1× umsteigen",
    );
    expect(infoLine({ duration: 600, distance: 40_100, legs: [] }, "car", utc, 0)).toBe("40.1 km · arr 0:10");
  });

  test("Transitous plan mapping (mocked network)", async () => {
    const leg = (mode: string, extra = {}) => ({
      mode,
      from: {
        name: "A",
        lat: 1,
        lon: 2,
        departure: "2026-01-01T10:00:00Z",
        scheduledDeparture: "2026-01-01T09:57:00Z",
        track: "3",
      },
      to: { name: "B", lat: 3, lon: 4, arrival: "2026-01-01T10:20:00Z" },
      duration: 1200,
      distance: 5000,
      legGeometry: { points: "_p~iF~ps|U", precision: 5 },
      ...extra,
    });
    const body = {
      itineraries: [
        {
          duration: 1200,
          startTime: "2026-01-01T10:00:00Z",
          endTime: "2026-01-01T10:20:00Z",
          transfers: 0,
          legs: [leg("SUBWAY", { displayName: "U2", routeColor: "da421e", intermediateStops: [{}, {}] })],
        },
      ],
      direct: [
        {
          duration: 900,
          startTime: "2026-01-01T10:00:00Z",
          endTime: "2026-01-01T10:15:00Z",
          transfers: 0,
          legs: [leg("CAR")],
        },
      ],
    };
    let seen = "";
    setFetcher(async (url) => {
      seen = url;
      return new Response(JSON.stringify(body));
    });
    const plan = await open.plan(place("A", 1, 2), place("B", 3, 4), { ua: "test", lang: "en" });
    expect(seen).toContain("directModes=WALK%2CBIKE%2CCAR");
    expect(plan.transit[0]?.legs[0]).toMatchObject({
      line: "U2",
      color: "#da421e",
      stops: 3,
      transit: true,
    });
    expect(plan.transit[0]?.legs[0]?.from).toMatchObject({ track: "3", delay: 3 });
    expect(plan.direct.car?.duration).toBe(900);
    expect(plan.direct.bike).toBeUndefined();
  });
});

describe("links", () => {
  const points = [
    { text: "Old Town", place: place("Old Town", 52.1, 13.1) },
    { text: "Museum" },
    { text: "Harbour", place: place("Harbour", 52.2, 13.2) },
  ];
  test("Google directions with stops and mode", () => {
    const url = new URL(directionsUrl("google", points, "bike"));
    expect(url.searchParams.get("origin")).toBe("Old Town");
    expect(url.searchParams.get("destination")).toBe("Harbour");
    expect(url.searchParams.get("waypoints")).toBe("Museum");
    expect(url.searchParams.get("travelmode")).toBe("bicycling");
  });
  test("other providers and place search", () => {
    expect(directionsUrl("apple", points, "transit")).toBe(
      "https://maps.apple.com/?saddr=Old%20Town&daddr=Museum+to:Harbour&dirflg=r",
    );
    expect(directionsUrl("osm", points, "car")).toContain("route=52.1%2C13.1%3B52.2%2C13.2");
    expect(directionsUrl("here", points, "walk")).toBe(
      "https://wego.here.com/directions/walk/Old%20Town:52.1,13.1/Museum/Harbour:52.2,13.2",
    );
    expect(directionsUrl("google", [{ text: "" }, { text: "Eiffel Tower" }], "car")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Eiffel%20Tower",
    );
  });
});

describe("i18n", () => {
  test("durations, distances, language", () => {
    expect(longDuration(5760, "de")).toBe("1 Std 36 Min");
    expect(longDuration(540, "en")).toBe("9 min");
    expect(shortDuration(3840, "en")).toBe("1:04 h");
    expect(shortDuration(undefined, "en")).toBe("–");
    expect(distance(40_100, { ...loc, locale: "de-DE" })).toBe("40,1 km");
    expect(distance(1609.344 * 3, { ...loc, metric: false })).toBe("3 mi");
    expect(pickLang("auto", "de-AT")).toBe("de");
    expect(pickLang("en", "de-AT")).toBe("en");
  });
});

describe("window", () => {
  const ids: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (typeof n.id === "string" && n.type) ids.push(n.id);
    for (const value of Object.values(n)) walk(value);
  };
  walk(mapWindow.window.root);
  walk(viaSlot(["", "", ""], String, 15));

  test("ids are unique, cell ids included", () => {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i && id !== "viaSlot");
    expect(dupes).toEqual([]);
  });

  test("replaced parts keep their grid slot (rest stays in row 1)", () => {
    const left = mapWindow.window.root.components[0] as {
      components: { components: { constraints: unknown }[] }[];
    };
    const original = JSON.stringify(left.components[0]?.components[1]?.constraints);
    expect(JSON.stringify(rest([{ id: "x" }], { duration: 32, info: 14 }).constraints)).toBe(original);
    expect(JSON.stringify(rest([], { duration: 32, info: 14 }).constraints)).toBe(original);
  });

  test("British keys and the link rule", () => {
    const text = JSON.stringify(mapWindow);
    expect(text).not.toMatch(/"(color|center|behavior|trigger)"\s*:/);
    expect(text).toContain('"openlinksexternally":"^https?:"');
  });

  test("map page escapes its data", () => {
    const html = mapPage({
      provider: "open",
      style: "auto",
      lang: "en",
      scale: 1,
      stopNames: true,
      chosen: 0,
      options: [],
      points: [{ lon: 1, lat: 2, kind: "end", label: "</script><b>x" }],
      attribution: "Routes: Transitous",
    });
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("maplibre-gl@5");
  });
});
