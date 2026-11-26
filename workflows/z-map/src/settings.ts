import { execFileSync } from "node:child_process";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { bool, cacheDir, dataDir, readJson, str, writeJson } from "./env.ts";
import { type Lang, type Locale, pickLang } from "./i18n.ts";
import { isMode, type Mode } from "./model.ts";
import { parseFavourites, type SavedPlaces } from "./parse.ts";
import type { Provider } from "./routes.ts";

export type OpenIn = "google" | "apple" | "osm" | "here";
export type Style = "auto" | "dark" | "light";
export type Tiles = "openfreemap" | "here" | "google";
export type Settings = {
  provider: Provider;
  /** Which map draws the routes; independent of where the routes come from. */
  tiles: Tiles;
  hereKey: string;
  googleKey: string;
  loc: Locale;
  lang: Lang;
  defaultMode: Mode;
  showQuick: boolean;
  clipboard: boolean;
  saved: SavedPlaces;
  style: Style;
  scale: number;
  stopNames: boolean;
  fonts: { fields: number; duration: number; info: number };
  width: number;
  mapHeight: number;
  startRegion: string;
  openIn: OpenIn;
  ua: string;
};

const number = (key: string, fallback: number, min: number, max: number): number => {
  const n = Number(str(key, String(fallback)));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const oneOf = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
  const value = str(key, fallback) as T;
  return values.includes(value) ? value : fallback;
};

const defaults = (key: string): string => {
  try {
    return execFileSync("/usr/bin/defaults", ["read", "-g", key], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

/** macOS region, 12/24-hour clock and units; probed once a day (each `defaults` call costs ~30 ms). */
const systemLocale = (): Omit<Locale, "lang"> => {
  const path = join(cacheDir(), "locale.json");
  const cached = readJson<{ at: number; value: Omit<Locale, "lang"> } | undefined>(path, undefined);
  if (cached && Date.now() - cached.at < 86_400_000) return cached.value;
  const locale = (defaults("AppleLocale").split("@")[0] || "en_US").replace("_", "-");
  const force24 = defaults("AppleICUForce24HourTime");
  const force12 = defaults("AppleICUForce12HourTime");
  const hour12 =
    force24 === "1"
      ? false
      : force12 === "1"
        ? true
        : new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hour12 === true;
  const units = defaults("AppleMeasurementUnits");
  const metric = units ? units === "Centimeters" : !/^en-(US|LR|MM)$/.test(locale);
  const value = { locale, hour12, metric };
  writeJson(path, { at: Date.now(), value });
  return value;
};

const placesFile = () => join(dataDir(), "places.json");
export const savedFavourites = (): SavedPlaces["favourites"] =>
  readJson<SavedPlaces["favourites"]>(placesFile(), []);
export const writeFavourites = (list: SavedPlaces["favourites"]): void => writeJson(placesFile(), list);

export const loadSettings = (): Settings => {
  const sys = systemLocale();
  const lang = pickLang(str("language", "auto"), sys.locale);
  const hereKey = str("here_api_key");
  const googleKey = str("google_api_key");
  const keys: Record<Provider, string> = { open: "-", here: hereKey, google: googleKey };
  const wanted = oneOf("provider", ["open", "here", "google"] as const, "open");
  const provider: Provider = keys[wanted] ? wanted : "open";
  const view = oneOf("map_view", ["auto", "openfreemap", "here", "google"] as const, "auto");
  const chosenTiles: Tiles = view === "auto" ? (provider === "open" ? "openfreemap" : provider) : view;
  const tiles: Tiles = chosenTiles === "openfreemap" || keys[chosenTiles] ? chosenTiles : "openfreemap";
  const contact = str("contact");
  const fromConfig = parseFavourites(str("saved_places"));
  const fromData = savedFavourites().filter(
    (f) => !fromConfig.some((c) => c.label.toLowerCase() === f.label.toLowerCase()),
  );
  const mode = str("default_mode", "transit");
  return {
    provider,
    tiles,
    hereKey,
    googleKey,
    loc: { ...sys, lang },
    lang,
    defaultMode: isMode(mode) ? mode : "transit",
    showQuick: bool("show_quick", true),
    clipboard: bool("clipboard_destination", true),
    saved: {
      home: str("home_address"),
      work: str("work_address"),
      favourites: [...fromConfig, ...fromData],
    },
    style: oneOf("map_style", ["auto", "dark", "light"] as const, "auto"),
    scale: number("map_scale", 1, 0.85, 1.3),
    stopNames: bool("map_stop_names", true),
    fonts: {
      fields: number("font_fields", 15, 10, 24),
      duration: number("font_duration", 32, 18, 48),
      info: number("font_info", 14, 10, 20),
    },
    width: number("window_width", 1180, 700, 2400),
    mapHeight: number("map_height", 620, 300, 1400),
    startRegion: str("start_region"),
    openIn: oneOf("open_in", ["google", "apple", "osm", "here"] as const, "google"),
    ua: `Alfred-ZMap-Workflow/${pkg.version}${contact ? ` (${contact})` : ""}`,
  };
};

/** HERE was chosen but no key was entered. */
/** The provider or map that was chosen but has no key, so open data is used instead. */
export const keyMissing = (): string | undefined => {
  const need = (choice: string) =>
    (choice === "here" && !str("here_api_key")) || (choice === "google" && !str("google_api_key"));
  const choice = [str("provider", "open"), str("map_view", "auto")].find(need);
  return choice === "here" ? "HERE" : choice === "google" ? "Google" : undefined;
};

/** `Europe/Berlin` → `Berlin`: the region place search is biased to when none is configured. */
export const regionName = (setting: string): string =>
  setting || (Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").at(-1) ?? "").replaceAll("_", " ");
