export const MAX_STOPS = 3;
export type Query = { from: string; to: string; via: string[] };

/** Alfred passes missing values as `<null>` and booleans as 1/0 or true/false. */
export const clean = (value: string | undefined): string => {
  const text = (value ?? "").trim();
  return text === "<null>" || text === "(null)" ? "" : text;
};

const sentence = /^(?:from|von)\s+(.+?)(?:\s+(?:via|über|ueber)\s+(.+?))?\s+(?:to|nach)\s+(.+)$/i;

/**
 * `Eiffel Tower` (place) · `A > B` · `A > B > C` · `from A via B to C` · `von A über B nach C`.
 * Up to three stops; extra stops are dropped.
 */
export const parseQuery = (raw: string): Query => {
  const text = clean(raw).replace(/\s+/g, " ");
  if (!text) return { from: "", to: "", via: [] };
  if (text.includes(">")) {
    const parts = text.split(">").map((p) => p.trim());
    return {
      from: parts[0] ?? "",
      to: parts.at(-1) ?? "",
      via: parts.slice(1, -1).filter(Boolean).slice(0, MAX_STOPS),
    };
  }
  const match = sentence.exec(text);
  if (match)
    return {
      from: match[1]?.trim() ?? "",
      to: match[3]?.trim() ?? "",
      via: (match[2] ?? "")
        .split(/\s+(?:via|über|ueber)\s+/i)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, MAX_STOPS),
    };
  return { from: "", to: text, via: [] };
};

/** A clipboard value worth routing to: one short line, not a URL or a path. */
export const looksLikeAddress = (text: string): boolean => {
  const value = text.trim();
  return (
    value.length >= 3 &&
    value.length <= 200 &&
    !/[\r\n]/.test(value) &&
    /\p{L}/u.test(value) &&
    !/^(?:[a-z][a-z0-9+.-]*:|\/|~\/)/i.test(value) &&
    !/[{}<>=;|\\]/.test(value)
  );
};

const HOME = ["home", "zuhause", "daheim", "zu hause"];
const WORK = ["work", "office", "arbeit", "büro", "buero"];

export type SavedPlaces = {
  home: string;
  work: string;
  favourites: { label: string; address: string }[];
};

/** `Gym = Some Street 1` lines; blank lines and lines without `=` are ignored. */
export const parseFavourites = (text: string): SavedPlaces["favourites"] =>
  text
    .split(/[\n;]/)
    .map((line) => line.split("="))
    .filter((parts) => parts.length >= 2)
    .map(([label, ...rest]) => ({ label: (label ?? "").trim(), address: rest.join("=").trim() }))
    .filter((f) => f.label && f.address);

/** Resolves home/work aliases and favourite labels to addresses; other input is returned as is. */
export const expandAlias = (input: string, saved: SavedPlaces): string => {
  const key = input.trim().toLowerCase();
  if (HOME.includes(key) && saved.home) return saved.home;
  if (WORK.includes(key) && saved.work) return saved.work;
  return saved.favourites.find((f) => f.label.toLowerCase() === key)?.address ?? input.trim();
};
