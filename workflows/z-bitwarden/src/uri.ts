/** URL helpers for "items for the site you're on". */

// ponytail: tiny public-suffix list for common two-part TLDs; swap for the full PSL if matches go wrong.
const TWO_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.jp",
  "co.nz",
  "co.in",
  "com.br",
  "com.cn",
  "com.mx",
  "co.za",
  "com.tr",
  "com.sg",
]);

export const hostOf = (value: string): string => {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const baseDomain = (host: string): string => {
  const parts = host.split(".");
  const lastTwo = parts.slice(-2).join(".");
  return parts.length > 2 && TWO_PART_TLDS.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
};

/** Default Bitwarden match (base domain), which is what most people rely on. */
export const matchesSite = (itemUris: string[], pageUrl: string): boolean => {
  const pageHost = hostOf(pageUrl);
  if (!pageHost) return false;
  const pageBase = baseDomain(pageHost);
  return itemUris.some((uri) => {
    const host = hostOf(uri);
    return host !== "" && baseDomain(host) === pageBase;
  });
};

export const isWebUrl = (value: string): boolean => /^https?:\/\//i.test(value);
