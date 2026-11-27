import type { Mode, Place } from "./model.ts";
import type { OpenIn } from "./settings.ts";

export const PROVIDER_NAMES: Record<OpenIn, string> = {
  google: "Google Maps",
  apple: "Apple Maps",
  osm: "OpenStreetMap",
  here: "HERE WeGo",
};

/** What to send: the text the user typed (home/work expanded) and, when resolved, the place. */
export type Point = { text: string; place?: Place };

const coords = (p: Point) => (p.place ? `${p.place.lat},${p.place.lon}` : "");
const text = (p: Point) => p.text || p.place?.label || coords(p);
const q = (value: string) => encodeURIComponent(value);

const GOOGLE: Record<Mode, string> = {
  car: "driving",
  transit: "transit",
  bike: "bicycling",
  walk: "walking",
};
const APPLE: Record<Mode, string> = { car: "d", transit: "r", bike: "c", walk: "w" };
const OSM: Record<Mode, string> = {
  car: "fossgis_osrm_car",
  transit: "fossgis_osrm_car",
  bike: "fossgis_osrm_bike",
  walk: "fossgis_osrm_foot",
};
const WEGO: Record<Mode, string> = {
  car: "drive",
  transit: "publicTransport",
  bike: "bicycle",
  walk: "walk",
};

const search = (provider: OpenIn, target: Point): string => {
  const place = target.place;
  if (provider === "apple") return `https://maps.apple.com/?q=${q(text(target))}`;
  if (provider === "osm")
    return place
      ? `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=16/${place.lat}/${place.lon}`
      : `https://www.openstreetmap.org/search?query=${q(text(target))}`;
  if (provider === "here")
    return place
      ? `https://wego.here.com/?map=${place.lat},${place.lon},16`
      : `https://wego.here.com/search/${q(text(target))}`;
  return `https://www.google.com/maps/search/?api=1&query=${q(text(target))}`;
};

/**
 * A browser/app URL with the addresses filled in. `points` is [from, ...stops, to]; with fewer than two
 * filled points it opens a place search instead of directions.
 */
export const directionsUrl = (provider: OpenIn, points: Point[], mode: Mode): string => {
  const route = points.filter((p) => text(p));
  if (route.length < 2) return search(provider, route[0] ?? { text: "" });
  const [from, ...rest] = route as [Point, ...Point[]];
  const to = rest.at(-1) as Point;
  const stops = rest.slice(0, -1);
  switch (provider) {
    case "apple":
      return `https://maps.apple.com/?saddr=${q(text(from))}&daddr=${[...stops, to]
        .map((p) => q(text(p)))
        .join("+to:")}&dirflg=${APPLE[mode]}`;
    case "osm": // OSM directions take two points; stops are left out.
      return from.place && to.place
        ? `https://www.openstreetmap.org/directions?engine=${OSM[mode]}&route=${q(`${coords(from)};${coords(to)}`)}`
        : `https://www.openstreetmap.org/directions?from=${q(text(from))}&to=${q(text(to))}`;
    case "here":
      return `https://wego.here.com/directions/${WEGO[mode]}/${route
        .map((p) => (p.place ? `${q(text(p).replaceAll(":", " "))}:${coords(p)}` : q(text(p))))
        .join("/")}`;
    default: {
      const params = new URLSearchParams({
        api: "1",
        origin: text(from),
        destination: text(to),
        travelmode: GOOGLE[mode],
      });
      if (stops.length) params.set("waypoints", stops.map(text).join("|"));
      return `https://www.google.com/maps/dir/?${params}`;
    }
  }
};
