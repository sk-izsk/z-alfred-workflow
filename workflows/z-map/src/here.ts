// HERE Geocoding & Search v7, Routing v8 and Public Transit v8. Needs the user's API key.
import type { Leg, Mode, Option, Place } from "./model.ts";
import { getJson } from "./net.ts";
import type { Ctx } from "./open.ts";
import { decodeFlexible } from "./polyline.ts";

const key = (ctx: Ctx): string => {
  if (!ctx.hereKey) throw new Error("HERE API key missing");
  return ctx.hereKey;
};
const at = (p: Place) => `${p.lat},${p.lon}`;

type HPlace = { name?: string; location: { lat: number; lng: number }; platform?: string };
type HPoint = { time?: string; delay?: number; place: HPlace };
type HSection = {
  type: string;
  departure: HPoint;
  arrival: HPoint;
  polyline?: string;
  summary?: { duration: number; length: number };
  travelSummary?: { duration: number; length: number };
  transport?: {
    mode: string;
    name?: string;
    shortName?: string;
    headsign?: string;
    color?: string;
    textColor?: string;
  };
  intermediateStops?: unknown[];
};
type HRoutes = { routes?: { sections: HSection[] }[] };

export const search = async (query: string, ctx: Ctx, limit = 1): Promise<Place[]> => {
  const params = new URLSearchParams({ q: query, lang: ctx.lang, limit: String(limit), apiKey: key(ctx) });
  if (ctx.bias) params.set("at", `${ctx.bias.lat},${ctx.bias.lon}`);
  const data = await getJson<{
    items?: {
      title: string;
      address?: { city?: string; countryName?: string };
      position: { lat: number; lng: number };
    }[];
  }>(`https://geocode.search.hereapi.com/v1/geocode?${params}`, ctx.ua);
  return (data.items ?? []).map((hit) => ({
    query,
    label: hit.title,
    detail: [hit.address?.city, hit.address?.countryName].filter(Boolean).join(", "),
    lat: hit.position.lat,
    lon: hit.position.lng,
  }));
};
export const geocode = async (query: string, ctx: Ctx) => (await search(query, ctx))[0];

const ms = (iso?: string) => (iso ? Date.parse(iso) : undefined);
const stopOf = (p: HPoint, fallback: string) => ({
  name: p.place.name ?? fallback,
  lat: p.place.location.lat,
  lon: p.place.location.lng,
  time: ms(p.time),
  track: p.place.platform,
  ...(p.delay && p.delay >= 60 && { delay: Math.round(p.delay / 60) }),
});

const legOf = (s: HSection, names: [string, string]): Leg => {
  const summary = s.travelSummary ?? s.summary;
  const transit = s.type === "transit";
  const dep = ms(s.departure.time);
  const arr = ms(s.arrival.time);
  return {
    mode: transit ? (s.transport?.mode ?? "transit").toUpperCase() : s.type === "pedestrian" ? "WALK" : "CAR",
    transit,
    line: transit ? (s.transport?.shortName ?? s.transport?.name) : undefined,
    color: transit ? s.transport?.color : undefined,
    textColor: transit ? s.transport?.textColor : undefined,
    headsign: s.transport?.headsign,
    from: stopOf(s.departure, names[0]),
    to: stopOf(s.arrival, names[1]),
    coords: s.polyline ? decodeFlexible(s.polyline) : [],
    stops: transit ? (s.intermediateStops?.length ?? 0) + 1 : undefined,
    distance: summary?.length,
    duration: summary?.duration ?? (dep !== undefined && arr !== undefined ? (arr - dep) / 1000 : 0),
  };
};

export const optionOf = (sections: HSection[], places: Place[]): Option => {
  const names: [string, string] = [places[0]?.label ?? "", places.at(-1)?.label ?? ""];
  const legs = sections.map((s) => legOf(s, names));
  const dep = legs[0]?.from.time;
  const arr = legs.at(-1)?.to.time;
  return {
    legs,
    dep,
    arr,
    duration:
      dep !== undefined && arr !== undefined
        ? (arr - dep) / 1000
        : legs.reduce((sum, l) => sum + l.duration, 0),
    distance: legs.reduce((sum, l) => sum + (l.distance ?? 0), 0),
    transfers: Math.max(0, legs.filter((l) => l.transit).length - 1),
  };
};

const MODE: Record<Exclude<Mode, "transit">, string> = {
  car: "car",
  bike: "bicycle",
  walk: "pedestrian",
};

/** Car/bike/walk with stops in one request, up to three routes. */
export const route = async (mode: Exclude<Mode, "transit">, places: Place[], ctx: Ctx): Promise<Option[]> => {
  const first = places[0];
  const last = places.at(-1);
  if (!first || !last) return [];
  const params = new URLSearchParams({
    transportMode: MODE[mode],
    origin: at(first),
    destination: at(last),
    return: "polyline,summary",
    alternatives: places.length === 2 ? "2" : "0",
    lang: ctx.lang,
    apiKey: key(ctx),
  });
  for (const via of places.slice(1, -1)) params.append("via", at(via));
  const data = await getJson<HRoutes>(`https://router.hereapi.com/v8/routes?${params}`, ctx.ua);
  return (data.routes ?? []).slice(0, 3).map((r) => optionOf(r.sections, places));
};

/** One transit segment; the caller chains segments for stops. */
export const transit = async (from: Place, to: Place, ctx: Ctx, time?: number): Promise<Option[]> => {
  const params = new URLSearchParams({
    origin: at(from),
    destination: at(to),
    return: "polyline,travelSummary,intermediate",
    alternatives: "2",
    lang: ctx.lang,
    apiKey: key(ctx),
  });
  if (time) params.set("departureTime", new Date(time).toISOString());
  const data = await getJson<HRoutes>(`https://transit.router.hereapi.com/v8/routes?${params}`, ctx.ua);
  return (data.routes ?? [])
    .filter((r) => r.sections.some((s) => s.type === "transit"))
    .map((r) => optionOf(r.sections, [from, to]))
    .toSorted((a, b) => (a.arr ?? 0) - (b.arr ?? 0))
    .slice(0, 3);
};
