import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson, str } from "./env.ts";
export type Provider = "open-er" | "allratestoday" | "exchangerate-api" | "unirate";
export type Rates = {
  provider: Provider;
  date: string;
  asof: string;
  fetched: number;
  rates: Record<string, number>;
  stale: boolean;
};
export const provider = (): Provider => {
  const value = str("provider", "open-er");
  if (!["open-er", "allratestoday", "exchangerate-api", "unirate"].includes(value))
    throw new Error("Choose a supported rate provider.");
  return value as Provider;
};
export const parseRates = (raw: any, p: Provider, requested = ""): Rates => {
  const rates: Record<string, number> = {};
  let date = "",
    asof = "";
  if (p === "allratestoday") {
    if (!Array.isArray(raw?.rates) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.rate_date))
      throw new Error("ECB provider returned no dated rate table.");
    rates.EUR = 1;
    date = raw.rate_date;
    asof = date;
    for (const row of raw.rates)
      if (
        row.base === "EUR" &&
        /^[A-Z]{3}$/.test(row.quote) &&
        typeof row.value === "number" &&
        Number.isFinite(row.value) &&
        row.value > 0
      )
        rates[row.quote] = row.value;
  } else {
    if (raw?.result === "error" || raw?.error)
      throw new Error("Provider rejected the request. Check your key and plan’s historical-rate access.");
    const table = p === "exchangerate-api" ? raw?.conversion_rates : raw?.rates;
    if (!table || typeof table !== "object" || Array.isArray(table))
      throw new Error("Provider returned no exchange rates.");
    for (const [code, value] of Object.entries(table)) {
      const n =
        typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
      if (/^[A-Z]{3}$/.test(code) && Number.isFinite(n) && n > 0) rates[code] = n;
    }
    const base = raw.base_code || raw.base || "USD";
    if (!/^[A-Z]{3}$/.test(base)) throw new Error("Provider returned an invalid base currency.");
    rates[base] = 1;
    if (requested) {
      date = raw.year
        ? `${raw.year}-${String(raw.month).padStart(2, "0")}-${String(raw.day).padStart(2, "0")}`
        : typeof raw.date === "string"
          ? raw.date.slice(0, 10)
          : "";
      if (date !== requested)
        throw new Error(
          "Provider did not verify the requested historical date; current rates were not substituted.",
        );
      asof = date;
    } else if (
      typeof raw.time_last_update_utc === "string" &&
      Number.isFinite(Date.parse(raw.time_last_update_utc))
    ) {
      asof = new Date(raw.time_last_update_utc).toISOString();
      date = asof.slice(0, 10);
    } else if (typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)) {
      asof = new Date(raw.timestamp * 1000).toISOString();
      date = asof.slice(0, 10);
    } else {
      asof = "Provider timestamp unavailable";
    }
  }
  if (Object.keys(rates).length < 2) throw new Error("Provider returned an empty rate table.");
  return {
    provider: p,
    date,
    asof,
    fetched: Date.now(),
    rates,
    stale: p === "allratestoday" && raw.stale === true,
  };
};
export const loadRates = async (date = "", fresh = false): Promise<Rates> => {
  const p = provider(),
    key = str("api_key");
  if ((p === "allratestoday" || p === "open-er") && date)
    throw new Error(
      "This no-key provider has no history. Choose a keyed provider with historical access, or clear the date.",
    );
  if (p !== "allratestoday" && p !== "open-er" && !key)
    throw new Error("Add this provider’s API key in Workflow Configuration.");
  const identity = createHash("sha256").update(`${p}:${key}:${date}`).digest("hex").slice(0, 24),
    path = join(cacheDir(), `rates-${identity}.json`),
    old = readJson<Rates | null>(path, null);
  if (old && !fresh && Date.now() - old.fetched < 3600000) return old;
  try {
    let url =
      p === "open-er"
        ? "https://open.er-api.com/v6/latest/USD"
        : "https://allratestoday.com/api/open/central-bank/ecb";
    if (p === "exchangerate-api")
      url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/${date ? `history/USD/${date.split("-").map(Number).join("/")}` : "latest/USD"}`;
    if (p === "unirate")
      url = `https://api.unirateapi.com/api/${date ? "historical/rates" : "rates"}?${new URLSearchParams({ from: "USD", api_key: key, ...(date ? { date } : {}) })}`;
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new Error("Could not reach the rate provider. Check your connection.");
    }
    if (!response.ok)
      throw new Error(`Rate provider HTTP ${response.status}. Check your API key, quota and plan.`);
    const body = await response.text();
    if (body.length > 2e6) throw new Error("Rate response too large.");
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new Error("Rate provider returned invalid JSON.");
    }
    const result = parseRates(raw, p, date);
    writeJson(path, result);
    return result;
  } catch (error) {
    if (old) return { ...old, stale: true };
    throw error;
  }
};
