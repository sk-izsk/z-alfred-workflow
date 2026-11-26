// `zmap <command> <from> <to> <stop1> <stop2> <stop3> [extra]`: one JSON action on stdout per run.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { backBinding, displayWidth, shortcutLabel } from "../../../shared/ui-profile.ts";
import {
  act,
  emptySuggestions,
  type Json,
  mapView,
  mapWidth,
  quickButton,
  rest,
  ROUTE,
  run,
  suggestions,
  viaSlot,
} from "../ui/window.ts";
import { bool, cacheDir, str } from "./env.ts";
import { t } from "./i18n.ts";
import { directionsUrl, type Point, PROVIDER_NAMES } from "./links.ts";
import { modeAt, type Place } from "./model.ts";
import { pruneCache, readCache } from "./net.ts";
import type { Ctx } from "./open.ts";
import { clean, expandAlias, looksLikeAddress, MAX_STOPS, parseQuery } from "./parse.ts";
import { coordinates, type Entry, ensureRoutes, resolvePlace, routeKey, suggestPlaces } from "./routes.ts";
import {
  keyMissing,
  loadSettings,
  type OpenIn,
  regionName,
  savedFavourites,
  type Settings,
  writeFavourites,
} from "./settings.ts";
import { type Action, merge, popup, separator, sheet, update } from "./ui.ts";
import { hint, inputsKey, loadState, render, saveState, type State, type Suggestion } from "./view.ts";

const [command = "", ...args] = process.argv.slice(2);
const settings: Settings = loadSettings();
const lang = settings.lang;
const MUTED = "secondaryLabelColor";

/** Field texts from the action args; the number of stop fields is whatever is on screen. */
const readFields = (s: State) => {
  s.from = clean(args[0]);
  s.to = clean(args[1]);
  s.via = s.via.map((_, i) => clean(args[2 + i]));
};
const extra = () => clean(args[5]);
const FIELD_IDS = ["von", "nach", "via0", "via1", "via2"];

const stopFields = (s: State): Action =>
  merge(
    {
      replace: {
        ids: { viaSlot: viaSlot(s.via, (n) => t(lang, "stop", { n }), settings.fonts.fields) },
      },
    },
    update({
      viaButton: {
        image: {
          type: "symbol",
          src: s.via.length >= MAX_STOPS ? "minus.circle.fill" : "plus.circle.fill",
          size: { width: 26, height: 26 },
        },
      },
    }),
  );

const quickRow = (): Json[] => {
  if (!settings.showQuick) return [];
  const { home, work, favourites } = settings.saved;
  const fixed = [
    ...(home ? [quickButton("quickHome", `⌂ ${t(lang, "home")}`, act("dest", [t(lang, "home")]))] : []),
    ...(work ? [quickButton("quickWork", t(lang, "work"), act("dest", [t(lang, "work")]))] : []),
  ];
  return [
    ...fixed,
    ...favourites
      .slice(0, 4 - fixed.length)
      .map((f, i) => quickButton(`quickFav${i}`, `★ ${f.label}`, act("dest", [f.label]))),
  ];
};
// `replace` runs after `update` in Alfred's fixed order, so the new sidebar starts blank;
// callers follow it with the async route run, which renders from the cache.
const restView = (): Action => ({ replace: { ids: { rest: rest(quickRow(), settings.fonts) } } });

const bump = (s: State, needsRoute = true): void => {
  s.token = Date.now();
  s.error = undefined;
  s.needsRoute = needsRoute;
};

const status = (text: string, colour = MUTED): Action => update({ statusLabel: { text, colour } });
const routing = (): Action => status(t(lang, "routing"));

const cachedEntry = (s: State): Entry | undefined =>
  s.places && s.placesFor === inputsKey(s) && s.places.length > 1
    ? readCache<Entry>(routeKey(settings.provider, s.places))
    : undefined;

const points = (s: State): Point[] => {
  const texts = [s.from, ...s.via.filter(Boolean), s.to];
  const resolved = s.placesFor === inputsKey(s) ? s.places : undefined;
  const places = resolved && resolved.length === texts.filter(Boolean).length ? resolved : undefined;
  let i = 0;
  return texts.map((text) =>
    text ? { text: expandAlias(text, settings.saved), place: places?.[i++] } : { text: "" },
  );
};
const linkFor = (s: State, provider: OpenIn) => directionsUrl(provider, points(s), s.mode);
const chosenProvider = (): OpenIn => {
  const value = extra();
  return value in PROVIDER_NAMES ? (value as OpenIn) : settings.openIn;
};

/** Place search is biased to the configured region, or the city of the Mac's time zone. */
/**
 * Where searches start: "Search near" if set, else your Home (people search near home), else the
 * city of the Mac's time zone (America/Toronto covers Montreal too, so it's only a last resort).
 */
const homeArea = async (base: Ctx): Promise<Place | undefined> => {
  const home = settings.saved.home;
  const region = settings.startRegion;
  try {
    if (region) return await resolvePlace(region, "open", base);
    if (home) return await resolvePlace(home, "open", base);
    const zone = regionName("");
    return zone ? await resolvePlace(zone, "open", base) : undefined;
  } catch {
    return undefined;
  }
};
const context = async (): Promise<Ctx> => {
  const base: Ctx = { ua: settings.ua, lang, hereKey: settings.hereKey, googleKey: settings.googleKey };
  const place = await homeArea(base);
  return place ? { ...base, bias: { lat: place.lat, lon: place.lon } } : base;
};

const clipboard = (): string => {
  try {
    return execFileSync("/usr/bin/pbpaste", { encoding: "utf8", timeout: 1000 }).trim();
  } catch {
    return "";
  }
};

const commands: Record<string, (s: State) => Action | Promise<Action>> = {
  /** Runs first on launch: Back binding, window width and map size from configuration. */
  "ui-profile": () => {
    const back = backBinding({ str, bool });
    const available = displayWidth();
    const width =
      Number.isFinite(available) && available > 80
        ? Math.min(settings.width, Math.floor(available - 40))
        : settings.width;
    return {
      variables: {
        back_shortcut: back.shortcut,
        back_label: back.label,
        actions_label: shortcutLabel(str("actions_shortcut", "⌘K")),
      },
      update: {
        ids: Object.fromEntries(
          args.map((id) => [id, { text: `Back  ${back.label}`, shortcut: back.shortcut }]),
        ),
      },
      replace: { ids: { mapBox: mapView(mapWidth(width), settings.mapHeight) } },
      window: { resize: { width } },
    };
  },

  launch: (s) => {
    pruneCache();
    let query = parseQuery(args[0] ?? "");
    if (!query.from && !query.to && settings.clipboard) {
      const copied = clipboard();
      if (looksLikeAddress(copied))
        query = { from: settings.saved.home ? t(lang, "home") : "", to: copied, via: [] };
    }
    Object.assign(s, query, {
      mode: settings.defaultMode,
      alt: 0,
      places: undefined,
      placesFor: undefined,
      suggest: undefined,
      pins: undefined,
    });
    // With nothing to route, the async run still shows the map around your area.
    bump(s, true);
    const size = settings.fonts.fields;
    return merge(
      update({
        von: { text: s.from, placeholder: t(lang, "from"), font: { size } },
        nach: { text: s.to, placeholder: t(lang, "to"), font: { size } },
        statusLabel: keyMissing()
          ? { text: t(lang, "keyMissing", { provider: keyMissing() ?? "" }), colour: "systemOrangeColor" }
          : { text: s.to ? t(lang, "routing") : hint(settings), colour: MUTED },
      }),
      stopFields(s),
      restView(),
    );
  },

  /** ↩: route, or open the chosen provider when nothing changed since the last route. */
  enter: (s) => {
    const before = inputsKey(s);
    readFields(s);
    if (s.suggest?.active !== undefined) return choose(s, `sg${s.suggest.active}`);
    const hadSuggestions = Boolean(s.suggest);
    s.suggest = undefined;
    if (!s.to && !s.from) return status(t(lang, "needsTo"), "systemOrangeColor");
    if (!s.to) [s.to, s.from] = [s.from, ""];
    if (inputsKey(s) === before && s.placesFor === before && !s.error) {
      bump(s, false);
      return { open: { type: "url", src: linkFor(s, settings.openIn) } };
    }
    s.alt = 0;
    bump(s);
    return merge(
      update({ von: { text: s.from }, nach: { text: s.to } }),
      hadSuggestions ? hideSuggestions() : {},
      routing(),
    );
  },

  /** Async after a typing pause: saved places that match, then the provider's places. */
  suggest: async (s) => {
    const field = extra();
    const index = FIELD_IDS.indexOf(field);
    const text = clean(args[index]);
    const started = Date.now();
    const token = s.token;
    s.suggestStarted = started;
    saveState(s);
    const items: Suggestion[] = [];
    if (index >= 0 && text.length >= 2 && !coordinates(text)) {
      const needle = text.toLowerCase();
      const { home, work, favourites } = settings.saved;
      const saved = [
        ...(home ? [{ label: t(lang, "home"), address: home }] : []),
        ...(work ? [{ label: t(lang, "work"), address: work }] : []),
        ...favourites,
      ];
      for (const f of saved)
        if (`${f.label} ${f.address}`.toLowerCase().includes(needle))
          items.push({ label: f.label, detail: f.address, saved: true });
      try {
        // Like routing: other fields search near the start once it's known.
        const ctx = await context();
        const from = readFrom(s);
        const start =
          field === "von" || !from
            ? undefined
            : (s.pins?.[from] ??
              (await resolvePlace(expandAlias(from, settings.saved), settings.provider, ctx).catch(
                () => undefined,
              )));
        const near = start ? { ...ctx, bias: { lat: start.lat, lon: start.lon } } : ctx;
        const places = await suggestPlaces(text, settings.provider, near);
        for (const place of places) items.push({ label: place.label, detail: place.detail, place });
      } catch {
        // Offline or rejected key: saved places still show; routing will report the error.
      }
    }
    // Typing went on (a newer pause runs its own search) or ↩ already routed: drop this answer.
    const now = loadState(settings.defaultMode);
    if (index < 0 || now.suggestStarted !== started || now.token !== token) return {};
    if (!items.length) {
      if (!now.suggest) return {};
      now.suggest = undefined;
      saveState(now);
      return merge(hideSuggestions(), status(hint(settings)));
    }
    now.suggest = { field, items: items.slice(0, 8) };
    saveState(now);
    return merge(showSuggestions(now), status(t(lang, "suggestHint")));
  },

  /** ↓ / ↑ while suggestions show: move the highlight that ↩ takes. */
  "suggest-move": (s) => {
    const list = s.suggest;
    if (!list?.items.length) return {};
    const step = Number(extra()) || 1;
    const next = (list.active ?? (step > 0 ? -1 : list.items.length)) + step;
    list.active = Math.min(list.items.length - 1, Math.max(0, next));
    return update({ suggestList: { data: { src: suggestionData(s) } } });
  },

  /** A click on a suggestion. */
  choose: (s) => {
    readFields(s);
    return choose(s, extra());
  },

  mode: (s) => {
    readFields(s);
    s.mode = modeAt(Number(extra()));
    s.alt = 0;
    const entry = cachedEntry(s);
    const complete = entry && (settings.provider !== "open" || entry.full.includes(s.mode));
    bump(s, !complete);
    return entry ? render(s, settings, entry) : routing();
  },

  swap: (s) => {
    readFields(s);
    [s.from, s.to] = [s.to, s.from];
    s.via.reverse();
    s.alt = 0;
    bump(s, Boolean(s.to));
    return merge(
      update({ von: { text: s.from }, nach: { text: s.to } }),
      s.via.length ? stopFields(s) : {},
      s.to ? routing() : {},
    );
  },

  /** Quick buttons fill From while it's empty, otherwise To; with both filled, route. */
  dest: (s) => {
    readFields(s);
    if (!s.from) s.from = extra();
    else s.to = extra();
    s.alt = 0;
    bump(s, Boolean(s.from && s.to));
    return merge(update({ von: { text: s.from }, nach: { text: s.to } }), s.to ? routing() : {});
  },

  "add-stop": (s) => {
    readFields(s);
    if (s.via.length >= MAX_STOPS) return removeStop(s);
    s.via.push("");
    return stopFields(s);
  },

  "remove-stop": (s) => {
    readFields(s);
    return removeStop(s);
  },

  alt: (s) => {
    const entry = cachedEntry(s);
    const n = Number(extra());
    if (!entry || n >= (entry.routes[s.mode]?.length ?? 0)) return {};
    s.alt = n;
    return render(s, settings, entry);
  },

  /** A click on an alternative reloads the page with `?alt=N&t=…`; each address is handled once. */
  pick: (s) => {
    const match = /[?&]alt=(\d+)&t=(\d+)/.exec(args[0] ?? "");
    const stamp = match?.[2];
    if (!match || !stamp || s.picks.includes(stamp)) return {};
    s.picks = [...s.picks.slice(-19), stamp];
    const entry = cachedEntry(s);
    if (!entry) return {};
    s.alt = Number(match[1]);
    return render(s, settings, entry, false);
  },

  open: (s) => {
    readFields(s);
    return { open: { type: "url", src: linkFor(s, chosenProvider()) } };
  },

  copy: (s) => {
    readFields(s);
    return merge({ copy: { type: "text", src: linkFor(s, chosenProvider()) } }, status(t(lang, "copied")));
  },

  menu: (s) => {
    readFields(s);
    const providers = (Object.keys(PROVIDER_NAMES) as OpenIn[]).toSorted((a, b) =>
      a === settings.openIn ? -1 : b === settings.openIn ? 1 : 0,
    );
    const item = (text: string, action: Json | Json[], key = "") => ({
      text: key ? `${text}   ${key}` : text,
      action,
    });
    return popup("actionsButton", [
      ...providers.map((p, i) =>
        item(t(lang, "openIn", { provider: PROVIDER_NAMES[p] }), run("open", [p]), i ? "" : "⌘O"),
      ),
      item(t(lang, "copyLink", { provider: PROVIDER_NAMES[settings.openIn] }), run("copy")),
      separator,
      item(t(lang, "swap"), act("swap"), "⌘T"),
      ...(s.via.length < MAX_STOPS ? [item(t(lang, "addStop"), run("add-stop"), "⌘U")] : []),
      ...(s.via.length ? [item(t(lang, "removeStop"), act("remove-stop"), "⇧⌘U")] : []),
      separator,
      ...(s.to ? [item(t(lang, "savePlace"), run("save-place"))] : []),
      ...savedFavourites().map((f) =>
        item(t(lang, "removePlace", { label: f.label }), act("remove-place", [f.label])),
      ),
      item(t(lang, "clear"), run("clear")),
    ]);
  },

  "save-place": (s) => {
    readFields(s);
    return sheet("savePlace", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 10,
      components: [
        { type: "label", text: t(lang, "saveTitle"), font: { size: 15, weight: "semibold" } },
        { type: "label", text: expandAlias(s.to, settings.saved), colour: MUTED },
        {
          id: "placeName",
          type: "textfield",
          text: s.to.slice(0, 24),
          placeholder: t(lang, "saveName"),
          focus: true,
          constraints: { size: { width: 320 } },
        },
        {
          id: "savePlaceButton",
          type: "button",
          text: `${t(lang, "save")}  ↩`,
          shortcut: "↩",
          constraints: { region: "bottom" },
          events: [
            {
              triggers: "actioned",
              action: [
                run("save-place-confirm", ["{value:placeName.text}"]),
                { type: "json", src: { sheet: { close: "savePlace" } } },
                ROUTE,
              ],
            },
          ],
        },
      ],
    });
  },

  "save-place-confirm": (s) => {
    readFields(s);
    const label = extra();
    const address = expandAlias(s.to, settings.saved);
    if (!label || !address) return {};
    const same = (f: { label: string }) => f.label.toLowerCase() === label.toLowerCase();
    writeFavourites([...savedFavourites().filter((f) => !same(f)), { label, address }]);
    settings.saved.favourites = [...settings.saved.favourites.filter((f) => !same(f)), { label, address }];
    bump(s);
    return merge(restView(), status(t(lang, "saved", { label })));
  },

  "remove-place": (s) => {
    readFields(s);
    const label = extra();
    writeFavourites(savedFavourites().filter((f) => f.label !== label));
    settings.saved.favourites = settings.saved.favourites.filter((f) => f.label !== label);
    bump(s);
    return restView();
  },

  clear: (s) => {
    Object.assign(s, {
      from: "",
      to: "",
      via: [],
      places: undefined,
      placesFor: undefined,
      alt: 0,
    });
    bump(s, false);
    return merge(
      update({
        von: { text: "" },
        nach: { text: "" },
        durationLabel: { text: "" },
        infoLabel: { text: "" },
        steps: { data: { src: [] } },
      }),
      hideSuggestions(),
      s.area ? render(s, settings, undefined) : {},
      stopFields(s),
      status(hint(settings)),
    );
  },

  /** Async: geocoding and routing; answers only if no newer action happened meanwhile. */
  route: async (s) => {
    if (!s.needsRoute) return {};
    const token = s.token;
    const key = inputsKey(s);
    const texts = [s.from, ...s.via.filter(Boolean), s.to].filter(Boolean);
    if (!texts.length) {
      const ctx = await context();
      const now = loadState(settings.defaultMode);
      if (now.token !== token || !ctx.bias) return {};
      Object.assign(now, { area: ctx.bias, needsRoute: false, places: undefined });
      const action = render(now, settings, undefined);
      saveState(now);
      return action;
    }
    const latest = () => {
      const now = loadState(settings.defaultMode);
      return now.token === token ? now : undefined;
    };
    try {
      const ctx = await context();
      let places = s.placesFor === key ? s.places : undefined;
      if (!places) {
        // The start is biased to the region; the other places to the start, as in "Hauptbahnhof".
        const resolve = async (text: string, bias: Ctx) =>
          s.pins?.[text] ?? resolvePlace(expandAlias(text, settings.saved), settings.provider, bias);
        const [first, ...others] = texts;
        const start = first === undefined ? undefined : await resolve(first, ctx);
        const near = start ? { ...ctx, bias: { lat: start.lat, lon: start.lon } } : ctx;
        const found = [start, ...(await Promise.all(others.map((text) => resolve(text, near))))];
        const missing = found.findIndex((p) => !p);
        if (missing >= 0) throw new Error(t(lang, "notFound", { q: texts[missing] ?? "" }));
        places = found as Place[];
      }
      const entry =
        places.length > 1 ? await ensureRoutes(settings.provider, places, s.mode, ctx) : undefined;
      const now = latest();
      if (!now) return {};
      const dropdown = Boolean(now.suggest);
      Object.assign(now, { places, placesFor: key, error: undefined, needsRoute: false, suggest: undefined });
      const action = merge(render(now, settings, entry), dropdown ? hideSuggestions() : {});
      saveState(now);
      return action;
    } catch (error) {
      const now = latest();
      if (!now) return {};
      const message = error instanceof Error ? error.message : String(error);
      now.error = /fetch failed|timeout|abort|ENOTFOUND/i.test(message)
        ? t(lang, "offline", { msg: message })
        : message;
      now.needsRoute = false;
      saveState(now);
      return render(now, settings, undefined, false);
    }
  },

  /** Run Script after the window closes: Back reopens Alfred's main search. */
  post: () => {
    if (process.env.map_out === "back")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application id "com.runningwithcrayons.Alfred" to search ""'],
        { timeout: 5000 },
      );
    return {};
  },
};

/** The From text as typed now (the suggest command gets every field's current text). */
function readFrom(s: State): string {
  return clean(args[0]) || s.from;
}

/** Dropdown rows; the highlighted one is drawn from row data, not the dataview selection. */
function suggestionData(s: State): Json[] {
  const active = s.suggest?.active;
  const on = "alfredSelectedResultTextColor";
  return (s.suggest?.items ?? []).map((item, i) => ({
    uid: `sg${i}`,
    "sgRow.background": i === active ? "alfredSelectedResultBackgroundColor" : null,
    "sgIcon.image": {
      type: "symbol",
      src: item.saved ? "star.fill" : "mappin.circle.fill",
      size: { width: 18, height: 18 },
    },
    "sgIcon.contenttintcolour": item.saved ? "systemYellowColor" : i === active ? on : MUTED,
    "sgTitle.text": item.label,
    "sgTitle.colour": i === active ? on : "labelColor",
    "sgDetail.text": item.detail ?? "",
    "sgDetail.colour": i === active ? on : MUTED,
  }));
}
const showSuggestions = (s: State): Action => ({
  replace: { ids: { suggestSlot: suggestions(suggestionData(s)) } },
});
const hideSuggestions = (): Action => ({ replace: { ids: { suggestSlot: emptySuggestions } } });

/** Puts a suggestion into its field, pins its exact place, and routes once From and To are set. */
function choose(s: State, uid: string): Action {
  if (!/^sg\d+$/.test(uid)) return {}; // a click on an itinerary row
  const item = s.suggest?.items[Number(uid.slice(2))];
  const field = s.suggest?.field ?? "";
  s.suggest = undefined;
  if (!item) return {};
  if (item.place)
    s.pins = { ...Object.fromEntries(Object.entries(s.pins ?? {}).slice(-19)), [item.label]: item.place };
  if (field === "von") s.from = item.label;
  else if (field === "nach") s.to = item.label;
  else s.via[Number(field.slice(3))] = item.label;
  const ready = Boolean(s.to);
  s.alt = 0;
  bump(s, ready);
  return merge(
    update({ [field]: { text: item.label } }),
    hideSuggestions(),
    ready ? routing() : status(hint(settings)),
  );
}

function removeStop(s: State): Action {
  const removed = s.via.pop();
  if (removed) bump(s);
  return merge(stopFields(s), removed ? routing() : {});
}

/** stdout to a pipe is asynchronous on macOS: wait for the flush before exiting. */
const emit = (action: Action) =>
  new Promise<void>((resolve) => process.stdout.write(JSON.stringify(action), () => resolve()));

/**
 * Which commands Alfred ran, for diagnosing keys and buttons that seem to do nothing. Field texts
 * are not logged, only their lengths. Local only (Alfred's cache folder), last 300 lines.
 */
const logCommand = (): void => {
  try {
    const path = join(cacheDir(), "commands.log");
    const lengths = args.slice(0, 5).map((a) => clean(a).length);
    const detail = ["mode", "alt", "suggest", "suggest-move", "choose", "pick"].includes(command)
      ? ` ${clean(args[5]).slice(0, 12)}`
      : "";
    const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n").slice(-299) : [];
    writeFileSync(
      path,
      [...lines, `${new Date().toISOString()} ${command} [${lengths}]${detail}`].join("\n"),
    );
  } catch {
    // never let logging break the window
  }
};

const main = async (): Promise<void> => {
  logCommand();
  const handler = commands[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);
  const s = loadState(settings.defaultMode);
  const action = await handler(s);
  if (!["route", "suggest", "post", "ui-profile"].includes(command)) saveState(s);
  await emit(action);
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return emit(update({ statusLabel: { text: message, colour: "systemRedColor" } }));
  })
  .finally(() => process.exit(0));
