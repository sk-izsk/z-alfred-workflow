import { SYMBOL_PATTERN, currencyOf } from "./words.ts";
// Arithmetic only: never evaluate JavaScript supplied through an Alfred query.
export const calculate = (input: string): number => {
  if (input.length > 200 || /[^\d\s.()+*/^%-]/.test(input))
    throw new Error("Use numbers and arithmetic operators only.");
  const tokens = input.match(/\d*\.\d+|\d+\.?\d*|[^\s]/g) || [];
  let at = 0,
    depth = 0;
  const primary = (): number => {
    if (++depth > 40) throw new Error("Expression is too deeply nested.");
    let result: number;
    if (tokens[at] === "(") {
      at++;
      result = sum();
      if (tokens[at++] !== ")") throw new Error("Close the parentheses.");
    } else {
      const token = tokens[at++];
      if (!token || !/^\d*\.?\d+(?:\.\d*)?$/.test(token)) throw new Error("Enter a valid amount.");
      result = Number(token);
    }
    while (tokens[at] === "%") {
      at++;
      result /= 100;
    }
    depth--;
    return result;
  };
  const power = (): number => {
    const left = primary();
    if (tokens[at] === "^") {
      at++;
      return left ** unary();
    }
    return left;
  };
  const unary = (): number => {
    if (tokens[at] === "+" || tokens[at] === "-") {
      const sign = tokens[at++];
      if (++depth > 40) throw new Error("Expression is too deeply nested.");
      const n = unary();
      depth--;
      return sign === "-" ? -n : n;
    }
    return power();
  };
  const product = (): number => {
    let n = unary();
    while (tokens[at] === "*" || tokens[at] === "/") {
      const op = tokens[at++],
        r = unary();
      if (op === "/" && r === 0) throw new Error("Cannot divide by zero.");
      n = op === "*" ? n * r : n / r;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const op = tokens[at++],
        r = product();
      n = op === "+" ? n + r : n - r;
    }
    return n;
  };
  const result = sum();
  if (at !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e15)
    throw new Error("Amount is invalid or too large.");
  return result;
};
export const validDate = (input: string): string => {
  const m = input.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) throw new Error("Use YYYY-MM-DD for the rate date.");
  const date = `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  if (new Date(`${date}T12:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error("Invalid calendar date.");
  if (date > new Date().toISOString().slice(0, 10)) throw new Error("Choose today or a past date.");
  return date;
};
export type Query = {
  amount: number;
  /** What to show: a code (lower case), a country or a name. */
  filter: string;
  date: string;
  /** The currency the amount is in, when the query names one ("100 euros"); else "" (the base). */
  from: string;
};
/** "1,250" → "1250", "2.5k" → "(2.5*1000)", "3m" → "(3*1000000)": still plain arithmetic. */
const numbers = (s: string) =>
  s
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/(\d+(?:\.\d+)?)\s*k\b/gi, "($1*1000)")
    .replace(/(\d+(?:\.\d+)?)\s*m\b/gi, "($1*1000000)");
/**
 * Plain amounts and filters as before ("100+24/12 in canada at 2021-09-25"), plus natural language:
 * "100 euros in cad", "€100 to usd", "convert 2.5k yen to cad", "100 eur", "cad to inr".
 */
export const parseQuery = (text: string): Query => {
  if (text.length > 300) throw new Error("Query is too long.");
  const dateMatch = text.match(/\s+at\s+(\S+)\s*$/i),
    date = dateMatch ? validDate(dateMatch[1]!) : "";
  let query = (dateMatch ? text.slice(0, dateMatch.index) : text)
    .trim()
    .replace(/^(?:convert|how much is|what(?:'s| is))\s+/i, "")
    .replace(/\?$/, "");
  let from = "";
  // A symbol before or right after the amount: "$100", "C$ 50", "100€".
  const lead = query.match(new RegExp(`^(${SYMBOL_PATTERN})\\s*`, "i"));
  if (lead) {
    from = currencyOf(lead[1]!) || "";
    query = query.slice(lead[0].length);
  }
  query = numbers(query);
  const prefix = query.match(/^[\d\s.()+*/^%-]+/),
    expression = prefix?.[0].trim() || "";
  let rest = query.slice(prefix?.[0].length || 0).trim();
  const trail = rest.match(new RegExp(`^(${SYMBOL_PATTERN})(?=\\s|$)\\s*`, "i"));
  if (trail && !from) {
    from = currencyOf(trail[1]!) || "";
    rest = rest.slice(trail[0].length);
  }
  let filter = rest.replace(/^(?:in|to|into|as)\s+/i, "");
  // "<currency> in|to <target>": the amount's currency, then what to show.
  const split = rest.match(/^(.+?)\s+(?:in|to|into|as)\s+(.+)$/i);
  if (split && currencyOf(split[1]!)) {
    from = currencyOf(split[1]!)!;
    filter = split[2]!;
  } else if (!/^(?:in|to|into|as)\s/i.test(rest) && currencyOf(rest)) {
    // "100 euros": the amount's currency, shown in every currency.
    from = currencyOf(rest)!;
    filter = "";
  }
  // A target that names a currency becomes its code, so "in canadian dollars" finds CAD.
  const target = currencyOf(filter);
  return {
    amount: expression ? calculate(expression) : 1,
    filter: (target || filter).trim().toLowerCase(),
    date,
    from,
  };
};
