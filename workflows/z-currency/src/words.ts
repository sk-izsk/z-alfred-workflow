// Currency names, words and symbols people type, mapped to ISO codes: "euros", "bucks", "₹", "C$".
import { currencyCode2Name as names } from "./catalog.ts";

/** Common words (singular; plurals are handled) that aren't the catalog's full names. */
const WORDS: Record<string, string> = {
  euro: "EUR",
  dollar: "USD",
  buck: "USD",
  "us dollar": "USD",
  "american dollar": "USD",
  "canadian dollar": "CAD",
  loonie: "CAD",
  "australian dollar": "AUD",
  aussie: "AUD",
  "new zealand dollar": "NZD",
  "hong kong dollar": "HKD",
  "singapore dollar": "SGD",
  pound: "GBP",
  quid: "GBP",
  sterling: "GBP",
  "british pound": "GBP",
  yen: "JPY",
  rupee: "INR",
  "indian rupee": "INR",
  "pakistani rupee": "PKR",
  yuan: "CNY",
  renminbi: "CNY",
  rmb: "CNY",
  franc: "CHF",
  "swiss franc": "CHF",
  peso: "MXN",
  "mexican peso": "MXN",
  real: "BRL",
  reai: "BRL",
  won: "KRW",
  ruble: "RUB",
  rouble: "RUB",
  lira: "TRY",
  rand: "ZAR",
  dirham: "AED",
  riyal: "SAR",
  ringgit: "MYR",
  baht: "THB",
  dong: "VND",
  shekel: "ILS",
  krona: "SEK",
  krone: "NOK",
  "danish krone": "DKK",
  zloty: "PLN",
  forint: "HUF",
  taka: "BDT",
  naira: "NGN",
};
/** Symbols, longest first so "C$" wins over "$". "$" alone means US dollars. */
const SYMBOLS: [string, string][] = [
  ["us$", "USD"],
  ["ca$", "CAD"],
  ["c$", "CAD"],
  ["au$", "AUD"],
  ["a$", "AUD"],
  ["nz$", "NZD"],
  ["hk$", "HKD"],
  ["s$", "SGD"],
  ["r$", "BRL"],
  ["$", "USD"],
  ["€", "EUR"],
  ["£", "GBP"],
  ["¥", "JPY"],
  ["₹", "INR"],
  ["₩", "KRW"],
  ["₽", "RUB"],
  ["₺", "TRY"],
  ["₱", "PHP"],
  ["฿", "THB"],
  ["₫", "VND"],
  ["₪", "ILS"],
];
/** A regex alternation of every symbol, longest first. */
export const SYMBOL_PATTERN = SYMBOLS.map(([s]) => s.replace(/\$/g, "\\$")).join("|");

const CATALOG: Record<string, string> = Object.fromEntries(
  Object.entries(names).map(([code, name]) => [name.toLowerCase(), code]),
);
/** "euros" → "euro", "rupees" → "rupee", "reais" → "reai" (listed above); "swiss" stays. */
const singular = (word: string) => word.replace(/(?<=[a-z]{2}[a-rt-z])s$/, "");

/** The ISO code for what someone typed (a code, a name, a word or a symbol), or undefined. */
export const currencyOf = (text: string): string | undefined => {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return undefined;
  const symbol = SYMBOLS.find(([s]) => s === t);
  if (symbol) return symbol[1];
  if (/^[a-z]{3}$/.test(t) && names[t.toUpperCase()]) return t.toUpperCase();
  const one = t.split(" ").map(singular).join(" ");
  return WORDS[t] ?? WORDS[one] ?? CATALOG[t] ?? CATALOG[one];
};
