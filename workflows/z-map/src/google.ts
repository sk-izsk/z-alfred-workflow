// Google Places API (New) text search and Routes API v2. Needs the user's API key (sent as a header).
import type { Leg, Mode, Option, Place } from "./model.ts";
import { postJson } from "./net.ts";
import type { Ctx } from "./open.ts";
import { decodePolyline } from "./polyline.ts";

const key = (ctx: Ctx): string => {
  if (!ctx.googleKey) throw new Error("Google API key missing");
  return ctx.googleKey;
};
const headers = (ctx: Ctx, fields: string) => ({ "X-Goog-Api-Key": key(ctx), "X-Goog-FieldMask": fields });

type LatLng = { latitude: number; longitude: number };

/** Like the search box in Google Maps: best matches, preferring places within 50 km of `bias`. */
export const search = async (query: string, ctx: Ctx, limit = 1): Promise<Place[]> => {
  const data = await postJson<{
    places?: { displayName?: { text: string }; formattedAddress?: string; location: LatLng }[];
  }>(
    "https://places.googleapis.com/v1/places:searchText",
    {
      textQuery: query,
      languageCode: ctx.lang,
      ...(ctx.bias && {
        locationBias: {
          circle: { center: { latitude: ctx.bias.lat, longitude: ctx.bias.lon }, radius: 50_000 },
        },
      }),
    },
    ctx.ua,
    headers(ctx, "places.displayName,places.formattedAddress,places.location"),
  );
  return (data.places ?? []).slice(0, limit).map((hit) => ({
    query,
    label: hit.displayName?.text ?? query,
    detail: hit.formattedAddress,
    lat: hit.location.latitude,
    lon: hit.location.longitude,
  }));
};
export const geocode = async (query: string, ctx: Ctx) => (await search(query, ctx))[0];

type GStop = { name?: string; location?: { latLng: LatLng } };
export type GStep = {
  travelMode?: string;
  staticDuration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
  startLocation?: { latLng: LatLng };
  endLocation?: { latLng: LatLng };
  transitDetails?: {
    stopDetails?: {
      departureStop?: GStop;
      arrivalStop?: GStop;
      departureTime?: string;
      arrivalTime?: string;
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      vehicle?: { type?: string };
    };
  };
};
export type GRoute = {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline: string };
  legs?: { steps?: GStep[] }[];
};

const FIELDS = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.polyline.encodedPolyline",
  "routes.legs.steps.startLocation",
  "routes.legs.steps.endLocation",
  "routes.legs.steps.transitDetails",
].join(",");

const seconds = (duration?: string) => (duration ? Number.parseFloat(duration) : 0);
const ms = (iso?: string) => (iso ? Date.parse(iso) : undefined);
const colour = (hex?: string) => (hex ? (hex.startsWith("#") ? hex : `#${hex}`) : undefined);
const point = (stop: GStop | undefined, at: { latLng: LatLng } | undefined, fallback: string) => ({
  name: stop?.name ?? fallback,
  lat: (stop?.location ?? at)?.latLng.latitude ?? 0,
  lon: (stop?.location ?? at)?.latLng.longitude ?? 0,
});

/** Google splits walks into one step per turn: merge them, and make each ride one leg. */
export const transitOption = (route: GRoute, places: Place[], now = Date.now()): Option => {
  const steps = route.legs?.flatMap((l) => l.steps ?? []) ?? [];
  const names: [string, string] = [places[0]?.label ?? "", places.at(-1)?.label ?? ""];
  const legs: Leg[] = [];
  for (const step of steps) {
    const coords = step.polyline ? decodePolyline(step.polyline.encodedPolyline) : [];
    const ride = step.transitDetails;
    if (ride) {
      const stops = ride.stopDetails;
      const line = ride.transitLine;
      legs.push({
        mode: line?.vehicle?.type ?? "TRANSIT",
        transit: true,
        line: line?.nameShort ?? line?.name,
        color: colour(line?.color),
        textColor: colour(line?.textColor),
        headsign: ride.headsign,
        from: {
          ...point(stops?.departureStop, step.startLocation, names[0]),
          time: ms(stops?.departureTime),
        },
        to: { ...point(stops?.arrivalStop, step.endLocation, names[1]), time: ms(stops?.arrivalTime) },
        coords,
        stops: ride.stopCount,
        distance: step.distanceMeters,
        duration: seconds(step.staticDuration),
      });
      continue;
    }
    const last = legs.at(-1);
    if (last && !last.transit) {
      last.coords.push(...coords);
      last.duration += seconds(step.staticDuration);
      last.distance = (last.distance ?? 0) + (step.distanceMeters ?? 0);
      last.to = point(undefined, step.endLocation, names[1]);
    } else
      legs.push({
        mode: "WALK",
        transit: false,
        from: point(undefined, step.startLocation, names[0]),
        to: point(undefined, step.endLocation, names[1]),
        coords,
        distance: step.distanceMeters ?? 0,
        duration: seconds(step.staticDuration),
      });
  }
  const firstRide = legs.findIndex((l) => l.transit);
  const walkBefore = legs.slice(0, Math.max(0, firstRide)).reduce((sum, l) => sum + l.duration, 0);
  const rideStart = legs[firstRide]?.from.time;
  const dep = rideStart !== undefined ? rideStart - walkBefore * 1000 : now;
  const duration = seconds(route.duration);
  return {
    legs,
    dep,
    arr: dep + duration * 1000,
    duration,
    distance: route.distanceMeters,
    transfers: Math.max(0, legs.filter((l) => l.transit).length - 1),
  };
};

const TRAVEL: Record<Mode, string> = { car: "DRIVE", transit: "TRANSIT", bike: "BICYCLE", walk: "WALK" };
const waypoint = (p: Place) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });

/**
 * Up to three routes. Car times include live traffic. Transit takes no stops in the Routes API,
 * so the caller chains transit segments; car, bike and walk take stops directly.
 */
export const route = async (mode: Mode, places: Place[], ctx: Ctx, time?: number): Promise<Option[]> => {
  const first = places[0];
  const last = places.at(-1);
  if (!first || !last) return [];
  const stops = places.slice(1, -1);
  const data = await postJson<{ routes?: GRoute[] }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: waypoint(first),
      destination: waypoint(last),
      ...(stops.length && { intermediates: stops.map(waypoint) }),
      travelMode: TRAVEL[mode],
      ...(mode === "car" && { routingPreference: "TRAFFIC_AWARE" }),
      computeAlternativeRoutes: stops.length === 0,
      languageCode: ctx.lang,
      ...(time && { departureTime: new Date(time).toISOString() }),
    },
    ctx.ua,
    headers(ctx, FIELDS),
  );
  const now = Date.now();
  return (data.routes ?? []).slice(0, 3).map((r) => {
    if (mode === "transit") return transitOption(r, places, now);
    const duration = seconds(r.duration);
    return {
      duration,
      distance: r.distanceMeters,
      dep: now,
      arr: now + duration * 1000,
      legs: [
        {
          mode: mode === "car" ? "CAR" : mode === "bike" ? "BIKE" : "WALK",
          transit: false,
          from: { name: first.label, lat: first.lat, lon: first.lon },
          to: { name: last.label, lat: last.lat, lon: last.lon },
          coords: r.polyline ? decodePolyline(r.polyline.encodedPolyline) : [],
          distance: r.distanceMeters,
          duration,
        },
      ],
    };
  });
};
