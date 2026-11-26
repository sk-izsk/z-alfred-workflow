import { join } from "node:path";
import { str, dataDir, readJson, writeJson } from "./env.ts";
import type { State } from "./state.ts";
import { currencyCode2Name as names, currencyCode2CountryAndRegion as countries } from "./catalog.ts";
export const quickBases = (s: State): string[] => {
  const primary = str("base_currency", "USD").toUpperCase();
  const codes = [
    primary,
    str("secondary_currency", primary === "USD" ? "CAD" : "USD").toUpperCase(),
    str("third_currency", "BDT").toUpperCase(),
  ];
  const saved = readJson<{ signature: string; codes: string[] } | null>(
    join(dataDir(), "quick-favorites.json"),
    null,
  );
  const selected =
    saved?.signature === JSON.stringify(codes) && Array.isArray(saved.codes) ? saved.codes : codes;
  return [...new Set(selected)].filter((code) => !!s.rates?.rates[code]).slice(0, 3);
};
export const baseMatches = (s: State, query = ""): string[] => {
  const favorites = quickBases(s),
    words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return Object.keys(s.rates?.rates || {})
    .filter((code) =>
      words.every((word) =>
        `${code} ${names[code] || ""} ${countries[code] || ""}`.toLowerCase().includes(word),
      ),
    )
    .toSorted((a, b) => Number(favorites.includes(b)) - Number(favorites.includes(a)) || a.localeCompare(b));
};

export const toggleQuickFavorite = (s: State, code: string): void => {
  if (!s.rates?.rates[code]) throw new Error("Choose a supported currency.");
  const current = quickBases(s);
  if (!current.includes(code) && current.length >= 3)
    throw new Error("Remove a quick favorite before adding another. The limit is three.");
  const primary = str("base_currency", "USD").toUpperCase();
  const configured = [
    primary,
    str("secondary_currency", primary === "USD" ? "CAD" : "USD").toUpperCase(),
    str("third_currency", "BDT").toUpperCase(),
  ];
  writeJson(join(dataDir(), "quick-favorites.json"), {
    signature: JSON.stringify(configured),
    codes: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
  });
};
