import * as google from "./google.ts";
import * as here from "./here.ts";
import { chain, type Mode, type Option, type Place, type Routes } from "./model.ts";
import { cached, MINUTE, readCache, TTL, writeCache } from "./net.ts";
import * as open from "./open.ts";
import type { Ctx } from "./open.ts";

export type Provider = "open" | "here" | "google";
/** `full` lists modes whose alternatives were fetched; others may only have Transitous' direct time. */
export type Entry = { routes: Routes; full: Mode[] };
type Direct = Exclude<Mode, "transit">;
const DIRECT: Direct[] = ["car", "bike", "walk"];

const point = (p: { lat: number; lon: number }) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
export const routeKey = (provider: Provider, places: Place[]) =>
  `route|${provider}|${places.map(point).join(";")}`;

/** `45.4769, -73.6187` (as copied from Google Maps) is used as is: an exact pin, no search. */
export const coordinates = (query: string): Place | undefined => {
  const match = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(query);
  const lat = Number(match?.[1]);
  const lon = Number(match?.[2]);
  return match && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { query, label: query.trim(), lat, lon }
    : undefined;
};

const SEARCH = { open: open.search, here: here.search, google: google.search };

export const resolvePlace = (query: string, provider: Provider, ctx: Ctx): Promise<Place | undefined> => {
  const exact = coordinates(query);
  if (exact) return Promise.resolve(exact);
  const bias = ctx.bias ? point(ctx.bias) : "";
  return cached(
    `place|${provider}|${ctx.lang}|${bias}|${query.toLowerCase()}`,
    TTL.place,
    async () => (await SEARCH[provider](query, ctx, 1))[0],
  );
};

/** Suggestions while typing: five matches, cached for a day. */
export const suggestPlaces = (query: string, provider: Provider, ctx: Ctx): Promise<Place[]> => {
  const bias = ctx.bias ? point(ctx.bias) : "";
  return cached(`suggest|${provider}|${ctx.lang}|${bias}|${query.toLowerCase()}`, 24 * 60 * MINUTE, () =>
    SEARCH[provider](query, ctx, 5),
  );
};

const pairs = (places: Place[]): [Place, Place][] => places.slice(1).map((to, i) => [places[i] as Place, to]);

/** Transit with stops: each segment departs after the previous one arrives. */
const chained = async (
  places: Place[],
  segment: (from: Place, to: Place, time?: number) => Promise<Option[]>,
): Promise<Option[]> => {
  if (places.length === 2) {
    const [from, to] = places as [Place, Place];
    return segment(from, to);
  }
  const parts: Option[] = [];
  for (const [from, to] of pairs(places)) {
    const best = (await segment(from, to, parts.at(-1)?.arr))[0];
    if (!best) return [];
    parts.push(best);
  }
  const joined = chain(parts);
  return joined ? [joined] : [];
};

const settle = async <T>(work: Promise<T>, errors: unknown[] = []): Promise<T | undefined> => {
  try {
    return await work;
  } catch (error) {
    errors.push(error);
    return undefined;
  }
};

/** HERE and Google: every mode in parallel, one request each (transit with stops chained). */
const KEYED = {
  here: {
    name: "HERE",
    transit: (a: Place, b: Place, ctx: Ctx, time?: number) => here.transit(a, b, ctx, time),
    route: (m: Direct, places: Place[], ctx: Ctx) => here.route(m, places, ctx),
  },
  google: {
    name: "Google",
    transit: (a: Place, b: Place, ctx: Ctx, time?: number) => google.route("transit", [a, b], ctx, time),
    route: (m: Direct, places: Place[], ctx: Ctx) => google.route(m, places, ctx),
  },
};

/** Fills the cache entry for these places so that `mode` (and the mode buttons) can be shown. */
export const ensureRoutes = async (
  provider: Provider,
  places: Place[],
  mode: Mode,
  ctx: Ctx,
): Promise<Entry> => {
  const key = routeKey(provider, places);
  const entry = readCache<Entry>(key) ?? { routes: {}, full: [] };
  if (provider !== "open") {
    if (!entry.full.length) {
      const api = KEYED[provider];
      const errors: unknown[] = [];
      const [transit, ...direct] = await Promise.all([
        settle(
          chained(places, (a, b, time) => api.transit(a, b, ctx, time)),
          errors,
        ),
        ...DIRECT.map((m) => settle(api.route(m, places, ctx), errors)),
      ]);
      entry.routes.transit = transit ?? [];
      DIRECT.forEach((m, i) => (entry.routes[m] = direct[i] ?? []));
      // Nothing at all usually means a rejected key: show the service's own explanation.
      if (Object.values(entry.routes).every((list) => !list?.length))
        throw errors[0] instanceof Error ? errors[0] : new Error(`${api.name} returned no routes`);
      entry.full = ["transit", ...DIRECT];
    }
  } else {
    if (!entry.routes.transit) {
      if (places.length === 2) {
        const [from, to] = places as [Place, Place];
        const plan = await open.plan(from, to, ctx);
        entry.routes.transit = plan.transit;
        for (const m of DIRECT) entry.routes[m] = plan.direct[m] ? [plan.direct[m]] : [];
      } else {
        entry.routes.transit =
          (await settle(
            chained(places, async (a, b, time) => {
              // A short leg between stops may have no ride at all: walk it, as Google does.
              const plan = await open.plan(a, b, ctx, time);
              return plan.transit.length ? plan.transit : plan.direct.walk ? [plan.direct.walk] : [];
            }),
          )) ?? [];
      }
      entry.full = ["transit"];
    }
    // OSRM allows one request per second: fetch the shown mode, or all three when there are stops.
    // Transitous plans direct trips up to three hours; longer car trips come from OSRM.
    const longCar = !entry.routes.car?.length ? ["car" as const] : [];
    const wanted = places.length > 2 ? DIRECT : mode === "transit" ? longCar : [mode];
    for (const m of wanted.filter((w) => !entry.full.includes(w))) {
      const alternatives = await settle(open.osrm(m, places, ctx));
      if (alternatives?.length) entry.routes[m] = alternatives;
      entry.full.push(m);
    }
  }
  writeCache(key, entry, TTL.route);
  return entry;
};
