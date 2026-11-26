import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { clock, distance, type Key, type Locale, longDuration, shortDuration, t } from "./i18n.ts";
import { PROVIDER_NAMES } from "./links.ts";
import { type Leg, type Mode, MODES, type Option, type Place } from "./model.ts";
import { mapPage, pageOption, type PagePoint } from "./page.ts";
import type { Entry } from "./routes.ts";
import type { Settings } from "./settings.ts";
import { type Action, update } from "./ui.ts";

export type Suggestion = { label: string; detail?: string; saved?: boolean; place?: Place };
export type State = {
  from: string;
  to: string;
  via: string[];
  mode: Mode;
  alt: number;
  /** Bumped by every visible action; a late async answer with an older token is dropped. */
  token: number;
  places?: Place[];
  placesFor?: string;
  error?: string;
  /** Set by visible actions that need network work; the async `route` run clears it. */
  needsRoute?: boolean;
  /** Suggestions shown in the list while typing in one field (`von`, `nach`, `via0`…). */
  suggest?: { field: string; items: Suggestion[]; active?: number };
  /** Exact places picked from suggestions, by the text they put in a field. */
  pins?: Record<string, Place>;
  /** Start of the latest suggestion run; older runs drop their answer. */
  suggestStarted?: number;
  /** Where searches start; shown as the map before anything is routed. */
  area?: { lat: number; lon: number };
  page: number;
  picks: string[];
};

const stateFile = () => join(cacheDir(), "state.json");
export const loadState = (fallbackMode: Mode): State => ({
  from: "",
  to: "",
  via: [],
  mode: fallbackMode,
  alt: 0,
  token: 0,
  page: 0,
  picks: [],
  ...readJson<Partial<State>>(stateFile(), {}),
});
export const saveState = (s: State): void => writeJson(stateFile(), s);
export const inputsKey = (s: Pick<State, "from" | "to" | "via">) =>
  JSON.stringify([s.from, ...s.via.filter(Boolean), s.to]);

const ACCENT = "controlAccentColor";
const MUTED = "secondaryLabelColor";
const MODE_KEY: Record<Mode, Key> = {
  car: "car",
  transit: "transit",
  bike: "bike",
  walk: "walkMode",
};

type Row = Record<string, unknown>;
const minutes = (seconds: number, loc: Locale) => longDuration(seconds, loc.lang);

/** Itinerary rows: line header, departure and arrival per ride; walks and transfers in between. */
export const stepRows = (option: Option, loc: Locale): Row[] => {
  const rows: Row[] = [];
  const row = (values: Row) => rows.push({ uid: `s${rows.length}`, ...values });
  const legs = option.legs;
  legs.forEach((leg: Leg, i) => {
    const prev = legs[i - 1];
    const next = legs[i + 1];
    if (!leg.transit) {
      const walk = t(loc.lang, "walk", { min: minutes(leg.duration, loc) });
      if (prev?.transit && next?.transit && prev.to.time !== undefined && next.from.time !== undefined) {
        const gap = (next.from.time - prev.to.time) / 1000;
        row({
          "dots.text": "┊",
          "stext.text": `${t(loc.lang, "transfer", { min: minutes(gap, loc) })} (${walk})`,
          "stext.colour": MUTED,
        });
      } else
        row({
          "dots.text": "┊",
          "stext.text": leg.distance ? `${walk} · ${distance(leg.distance, loc)}` : walk,
          "stext.colour": MUTED,
        });
      return;
    }
    if (prev?.transit && prev.to.time !== undefined && leg.from.time !== undefined)
      row({
        "dots.text": "┊",
        "stext.text": t(loc.lang, "transfer", {
          min: minutes((leg.from.time - prev.to.time) / 1000, loc),
        }),
        "stext.colour": MUTED,
      });
    const colour = leg.color ?? ACCENT;
    const stops = leg.stops === 1 ? t(loc.lang, "station") : t(loc.lang, "stations", { n: leg.stops ?? 0 });
    row({
      "bar.background": colour,
      "stime.text": leg.line ?? "",
      "stime.colour": colour,
      "stext.text": [leg.headsign ? `→ ${leg.headsign}` : "", stops].filter(Boolean).join(" · "),
      "stext.colour": MUTED,
    });
    for (const stop of [leg.from, leg.to]) {
      const late = stop.delay ? ` ${t(loc.lang, "late", { n: stop.delay })}` : "";
      const track = stop.track ? ` · ${t(loc.lang, "platform", { p: stop.track })}` : "";
      row({
        "bar.background": colour,
        "stime.text": stop.time !== undefined ? clock(stop.time, loc, true) : "",
        "stime.colour": stop.delay ? "systemRedColor" : "labelColor",
        "stext.text": `${stop.name}${track}${late}`,
      });
    }
  });
  return rows;
};

/** `dep 12:55 · arr 19:22 · 5× transfer` for transit, `40.1 km · arr 13:43` otherwise. */
export const infoLine = (option: Option, mode: Mode, loc: Locale, now = Date.now()): string => {
  const parts: string[] = [];
  if (mode === "transit") {
    if (option.dep !== undefined) parts.push(t(loc.lang, "dep", { t: clock(option.dep, loc) }));
    if (option.arr !== undefined) parts.push(t(loc.lang, "arr", { t: clock(option.arr, loc) }));
    parts.push(option.transfers ? t(loc.lang, "transfers", { n: option.transfers }) : t(loc.lang, "direct"));
  } else {
    if (option.distance) parts.push(distance(option.distance, loc));
    parts.push(t(loc.lang, "arr", { t: clock(now + option.duration * 1000, loc) }));
  }
  return parts.join(" · ");
};

const chipLabel = (option: Option, mode: Mode, loc: Locale) =>
  mode === "transit" && option.dep !== undefined
    ? `${t(loc.lang, "dep", { t: clock(option.dep, loc) })} · ${shortDuration(option.duration, loc.lang)}`
    : shortDuration(option.duration, loc.lang);

const points = (places: Place[]): PagePoint[] =>
  places.map((p, i) => ({
    lon: p.lon,
    lat: p.lat,
    label: p.label,
    kind: places.length === 1 || i === places.length - 1 ? "end" : i === 0 ? "start" : "stop",
  }));

/** Writes the next of four rotating page files: the web view only reloads when `src` changes. */
const writeMap = (s: State, settings: Settings, entry: Entry | undefined): string => {
  const options = entry?.routes[s.mode] ?? [];
  s.page = (s.page + 1) % 4;
  const path = join(cacheDir(), `map-${s.page}.html`);
  const usesOsrm = settings.provider === "open" && s.mode !== "transit" && entry?.full.includes(s.mode);
  writeFileSync(
    path,
    mapPage({
      tiles: settings.tiles,
      tilesKey: { openfreemap: undefined, here: settings.hereKey, google: settings.googleKey }[
        settings.tiles
      ],
      style: settings.style,
      lang: settings.lang,
      scale: settings.scale,
      stopNames: settings.stopNames,
      chosen: Math.min(s.alt, Math.max(0, options.length - 1)),
      options: options.map((o) => pageOption(o, chipLabel(o, s.mode, settings.loc))),
      points: points(s.places ?? []),
      center: s.area ? [s.area.lon, s.area.lat] : undefined,
      attribution: {
        open: `Routes: Transitous${usesOsrm ? " · FOSSGIS OSRM" : ""}`,
        here: "Routes: HERE",
        google: "Routes: Google",
      }[settings.provider],
    }),
  );
  return path;
};

export const hint = (settings: Settings): string =>
  t(settings.lang, "hint", { provider: PROVIDER_NAMES[settings.openIn] });

/** The whole sidebar (and, with `map`, a new map page) for the current state. */
export const render = (s: State, settings: Settings, entry: Entry | undefined, map = true): Action => {
  const lang = settings.lang;
  const options = entry?.routes[s.mode] ?? [];
  const option = options[s.alt] ?? options[0];
  const ids: Record<string, Action> = {};
  MODES.forEach((m, i) => {
    const colour = m === s.mode ? ACCENT : MUTED;
    ids[`modeBtn${i}`] = { contenttintcolour: colour, tooltip: t(lang, MODE_KEY[m]) };
    ids[`modeTime${i}`] = { text: shortDuration(entry?.routes[m]?.[0]?.duration, lang), colour };
  });
  for (const i of [0, 1, 2])
    ids[`alt${i}`] = {
      hidden: options.length < 2 || i >= options.length,
      contenttintcolour: i === s.alt ? ACCENT : MUTED,
    };
  const place = !s.from && s.places?.length === 1 ? s.places[0] : undefined;
  ids.durationLabel = { text: option ? longDuration(option.duration, lang) : "" };
  ids.infoLabel = {
    text: place
      ? place.label
      : option
        ? infoLine(option, s.mode, settings.loc)
        : entry
          ? t(lang, "noRoute", { mode: t(lang, MODE_KEY[s.mode]) })
          : "",
  };
  ids.steps = {
    data: { src: option && s.mode === "transit" ? stepRows(option, settings.loc) : [] },
    select: "",
  };
  ids.statusLabel = s.error
    ? { text: s.error, colour: "systemRedColor" }
    : { text: hint(settings), colour: MUTED };
  const idle = !s.places?.length && s.area;
  if (map && (entry || place || idle)) ids.map = { src: writeMap(s, settings, entry) };
  return update(ids, true);
};
