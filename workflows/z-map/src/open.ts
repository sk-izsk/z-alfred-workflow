// Open data: Transitous (MOTIS) for places, transit and direct times; FOSSGIS OSRM for alternatives.
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import type { Lang } from "./i18n.ts";
import type { Leg, Mode, Option, Place, Stop } from "./model.ts";
import { getJson, sleep } from "./net.ts";
import { decodePolyline } from "./polyline.ts";

export type Ctx = {
  ua: string;
  lang: Lang;
  bias?: { lat: number; lon: number };
  hereKey?: string;
  googleKey?: string;
};
const TRANSITOUS = "https://api.transitous.org/api";

type GeoHit = {
  type?: string;
  name: string;
  lat: number;
  lon: number;
  areas?: { name: string; default?: boolean }[];
};
type PhotonHit = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

/** Street addresses get their city; stops and places keep their own name (no "München, Munich"). */
const label = (hit: GeoHit): string => {
  const area = hit.areas?.find((a) => a.default)?.name;
  return hit.type === "ADDRESS" && area ? `${hit.name}, ${area}` : hit.name;
};

const areas = (hit: GeoHit) =>
  [...new Set((hit.areas ?? []).filter((a) => a.default || a.name !== hit.name).map((a) => a.name))]
    .filter((name) => !label(hit).includes(name))
    .slice(-3)
    .toReversed()
    .join(", ");

/** Best matches first; Transitous, then Photon when Transitous fails or finds nothing. */
export const search = async (query: string, ctx: Ctx, limit = 1): Promise<Place[]> => {
  const params = new URLSearchParams({ text: query, language: ctx.lang, numResults: String(limit) });
  if (ctx.bias) params.set("place", `${ctx.bias.lat},${ctx.bias.lon}`);
  try {
    const hits = await getJson<GeoHit[]>(`${TRANSITOUS}/v1/geocode?${params}`, ctx.ua);
    if (hits.length)
      return hits
        .slice(0, limit)
        .map((hit) => ({ query, label: label(hit), detail: areas(hit), lat: hit.lat, lon: hit.lon }));
  } catch {
    // fall through to Photon
  }
  const photon = new URLSearchParams({ q: query, lang: ctx.lang, limit: String(limit) });
  if (ctx.bias) {
    photon.set("lat", String(ctx.bias.lat));
    photon.set("lon", String(ctx.bias.lon));
  }
  const result = await getJson<{ features: PhotonHit[] }>(`https://photon.komoot.io/api/?${photon}`, ctx.ua);
  return result.features.slice(0, limit).map((hit) => {
    const p = hit.properties;
    const name = p.name ?? [p.street, p.housenumber].filter(Boolean).join(" ");
    const [lon, lat] = hit.geometry.coordinates;
    return {
      query,
      label: [name, p.city].filter(Boolean).join(", ") || query,
      detail: [p.state, p.country].filter(Boolean).join(", "),
      lat,
      lon,
    };
  });
};
export const geocode = async (query: string, ctx: Ctx) => (await search(query, ctx))[0];

type TStop = {
  name: string;
  lat: number;
  lon: number;
  departure?: string;
  arrival?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
};
type TLeg = {
  mode: string;
  from: TStop;
  to: TStop;
  duration: number;
  distance?: number;
  headsign?: string;
  displayName?: string;
  routeShortName?: string;
  routeColor?: string;
  routeTextColor?: string;
  intermediateStops?: unknown[];
  legGeometry: { points: string; precision?: number };
};
type TItinerary = {
  duration: number;
  startTime: string;
  endTime: string;
  transfers: number;
  legs: TLeg[];
};
type TPlan = { itineraries?: TItinerary[]; direct?: TItinerary[] };

const STREET = new Set(["WALK", "BIKE", "CAR", "RENTAL", "CAR_PARKING", "FLEX", "ODM"]);
const ms = (iso?: string) => (iso ? Date.parse(iso) : undefined);
const stop = (s: TStop, isArrival: boolean): Stop => {
  const time = ms(isArrival ? s.arrival : s.departure);
  const planned = ms(isArrival ? s.scheduledArrival : s.scheduledDeparture);
  const delay = time !== undefined && planned !== undefined ? Math.round((time - planned) / 60_000) : 0;
  return {
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    time,
    track: s.track ?? s.scheduledTrack,
    ...(delay > 0 && { delay }),
  };
};
const leg = (l: TLeg): Leg => {
  const transit = !STREET.has(l.mode);
  return {
    mode: l.mode,
    transit,
    line: transit ? (l.displayName ?? l.routeShortName) : undefined,
    color: transit && l.routeColor ? `#${l.routeColor}` : undefined,
    textColor: transit && l.routeTextColor ? `#${l.routeTextColor}` : undefined,
    headsign: l.headsign,
    from: stop(l.from, false),
    to: stop(l.to, true),
    coords: decodePolyline(l.legGeometry.points, l.legGeometry.precision ?? 6),
    stops: transit ? (l.intermediateStops?.length ?? 0) + 1 : undefined,
    distance: l.distance,
    duration: l.duration,
  };
};
const option = (it: TItinerary): Option => {
  const legs = it.legs.map(leg);
  const distance = legs.every((l) => l.distance !== undefined)
    ? legs.reduce((sum, l) => sum + (l.distance ?? 0), 0)
    : undefined;
  return {
    duration: it.duration,
    dep: ms(it.startTime),
    arr: ms(it.endTime),
    transfers: it.transfers,
    distance,
    legs,
  };
};
const DIRECT: Record<string, Mode> = { CAR: "car", BIKE: "bike", WALK: "walk" };

export type Plan = { transit: Option[]; direct: Partial<Record<Mode, Option>> };

/** Up to three transit connections (earliest arrival first) plus one direct car/bike/walk route each. */
export const plan = async (from: Place, to: Place, ctx: Ctx, time?: number): Promise<Plan> => {
  const params = new URLSearchParams({
    fromPlace: `${from.lat},${from.lon}`,
    toPlace: `${to.lat},${to.lon}`,
    directModes: "WALK,BIKE,CAR",
    maxDirectTime: "10800",
    numItineraries: "4",
    language: ctx.lang,
  });
  if (time) params.set("time", new Date(time).toISOString());
  const data = await getJson<TPlan>(`${TRANSITOUS}/v5/plan?${params}`, ctx.ua);
  const transit = (data.itineraries ?? [])
    .filter((it) => it.legs.some((l) => !STREET.has(l.mode)))
    .map(option)
    .toSorted((a, b) => (a.arr ?? 0) - (b.arr ?? 0))
    .slice(0, 3);
  const direct: Plan["direct"] = {};
  for (const it of data.direct ?? []) {
    const mode = DIRECT[it.legs[0]?.mode ?? ""];
    if (mode && !direct[mode]) direct[mode] = option(it);
  }
  return { transit, direct };
};

const OSRM: Record<Exclude<Mode, "transit">, string> = { car: "car", bike: "bike", walk: "foot" };
type OsrmRoute = {
  duration: number;
  distance: number;
  geometry: { coordinates: [number, number][] };
};

/** FOSSGIS asks for at most one request per second, shared across runs through a timestamp file. */
const throttle = async (): Promise<void> => {
  const path = join(cacheDir(), "osrm-last.json");
  const wait = readJson<number>(path, 0) + 1000 - Date.now();
  if (wait > 0) await sleep(Math.min(wait, 1000));
  writeJson(path, Date.now());
};

/** Up to three alternatives; OSRM gives alternatives only for routes without stops. */
export const osrm = async (mode: Exclude<Mode, "transit">, places: Place[], ctx: Ctx): Promise<Option[]> => {
  await throttle();
  const coords = places.map((p) => `${p.lon},${p.lat}`).join(";");
  const alternatives = places.length === 2 ? "3" : "false";
  const url = `https://routing.openstreetmap.de/routed-${OSRM[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=${alternatives}`;
  const data = await getJson<{ routes?: OsrmRoute[] }>(url, ctx.ua);
  const now = Date.now();
  const first = places[0];
  const last = places.at(-1);
  if (!first || !last) return [];
  return (data.routes ?? []).slice(0, 3).map((r) => ({
    duration: r.duration,
    distance: r.distance,
    dep: now,
    arr: now + r.duration * 1000,
    legs: [
      {
        mode: mode.toUpperCase(),
        transit: false,
        from: { name: first.label, lat: first.lat, lon: first.lon },
        to: { name: last.label, lat: last.lat, lon: last.lon },
        coords: r.geometry.coordinates,
        distance: r.distance,
        duration: r.duration,
      },
    ],
  }));
};
