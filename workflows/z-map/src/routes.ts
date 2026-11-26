import * as here from "./here.ts";
import { chain, type Mode, type Option, type Place, type Routes } from "./model.ts";
import { cached, readCache, TTL, writeCache } from "./net.ts";
import * as open from "./open.ts";
import type { Ctx } from "./open.ts";

export type Provider = "open" | "here";
/** `full` lists modes whose alternatives were fetched; others may only have Transitous' direct time. */
export type Entry = { routes: Routes; full: Mode[] };
type Direct = Exclude<Mode, "transit">;
const DIRECT: Direct[] = ["car", "bike", "walk"];

const point = (p: { lat: number; lon: number }) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
export const routeKey = (provider: Provider, places: Place[]) =>
  `route|${provider}|${places.map(point).join(";")}`;

export const resolvePlace = (query: string, provider: Provider, ctx: Ctx): Promise<Place | undefined> => {
  const bias = ctx.bias ? point(ctx.bias) : "";
  return cached(`place|${provider}|${ctx.lang}|${bias}|${query.toLowerCase()}`, TTL.place, () =>
    (provider === "here" ? here.geocode : open.geocode)(query, ctx),
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

const settle = async <T>(work: Promise<T>): Promise<T | undefined> => {
  try {
    return await work;
  } catch {
    return undefined;
  }
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
  if (provider === "here") {
    if (!entry.full.length) {
      const [transit, ...direct] = await Promise.all([
        settle(chained(places, (a, b, time) => here.transit(a, b, ctx, time))),
        ...DIRECT.map((m) => settle(here.route(m, places, ctx))),
      ]);
      entry.routes.transit = transit ?? [];
      DIRECT.forEach((m, i) => (entry.routes[m] = direct[i] ?? []));
      if (Object.values(entry.routes).every((list) => !list?.length))
        throw new Error("HERE returned no routes");
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
