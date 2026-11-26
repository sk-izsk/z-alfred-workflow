import { createHash, randomUUID } from "node:crypto";
export const tools = [
  ["json", "Format JSON"],
  ["json-min", "Minify JSON"],
  ["json-sort", "Sort JSON Keys"],
  ["base64", "Base64 Encode"],
  ["base64-decode", "Base64 Decode"],
  ["url", "URL Encode"],
  ["url-decode", "URL Decode"],
  ["query", "Parse Query String"],
  ["jwt", "Decode JWT · Unverified"],
  ["sha256", "SHA-256"],
  ["sha512", "SHA-512"],
  ["md5", "MD5 · Legacy Fingerprint"],
  ["uuid", "Generate UUID"],
  ["unix", "Unix Time → ISO"],
  ["iso", "Date → Unix Time"],
  ["upper", "Uppercase"],
  ["lower", "Lowercase"],
  ["title", "Title Case"],
  ["camel", "camelCase"],
  ["pascal", "PascalCase"],
  ["snake", "snake_case"],
  ["kebab", "kebab-case"],
  ["trim", "Trim Text"],
  ["trim-lines", "Trim Lines"],
  ["sort-lines", "Sort Lines"],
  ["unique", "Remove Duplicate Lines"],
  ["empty", "Remove Empty Lines"],
  ["reverse", "Reverse Lines"],
  ["escape", "JSON String Escape"],
  ["unescape", "JSON String Unescape"],
  ["html", "HTML Entity Encode"],
  ["html-decode", "Decode Common HTML Entities"],
  ["inspect", "Inspect Text"],
] as const;
const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, sorted(x)]),
        )
      : v;
const words = (text: string): string[] =>
  text
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const transform = (id: string, input: string): string => {
  if (input.length > 50000 || Buffer.byteLength(input) > 120000)
    throw new Error("Input limit is 50,000 characters / 120 KB.");
  let result: string;
  switch (id) {
    case "json":
      result = JSON.stringify(JSON.parse(input), null, 2);
      break;
    case "json-min":
      result = JSON.stringify(JSON.parse(input));
      break;
    case "json-sort":
      result = JSON.stringify(sorted(JSON.parse(input)), null, 2);
      break;
    case "base64":
      result = Buffer.from(input, "utf8").toString("base64");
      break;
    case "base64-decode": {
      const value = input.replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1)
        throw new Error("Invalid Base64 text.");
      result = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(value, "base64"));
      break;
    }
    case "url":
      result = encodeURIComponent(input);
      break;
    case "url-decode":
      result = decodeURIComponent(input);
      break;
    case "query": {
      const value = input.includes("?") ? input.slice(input.indexOf("?") + 1) : input.replace(/^\?/, "");
      const pairs = new URLSearchParams(value);
      const out: Record<string, string[]> = Object.create(null);
      for (const [k, v] of pairs) {
        (out[k] ??= []).push(v);
      }
      result = JSON.stringify(out, null, 2);
      break;
    }
    case "jwt": {
      const parts = input.trim().split(".");
      if (parts.length !== 3) throw new Error("Expected a three-part JWT. Signatures are not verified.");
      const parse = (part: string) =>
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(part, "base64url")));
      result = JSON.stringify(
        {
          warning: "Decoded only. Signature and claims are NOT verified.",
          header: parse(parts[0]!),
          payload: parse(parts[1]!),
        },
        null,
        2,
      );
      break;
    }
    case "sha256":
    case "sha512":
    case "md5":
      result = createHash(id).update(input, "utf8").digest("hex");
      break;
    case "uuid":
      result = randomUUID();
      break;
    case "unix": {
      const n = Number(input.trim());
      if (!input.trim() || !Number.isFinite(n)) throw new Error("Enter Unix seconds or milliseconds.");
      result = new Date(Math.abs(n) < 1e11 ? n * 1000 : n).toISOString();
      break;
    }
    case "iso": {
      const date = new Date(input.trim());
      if (!Number.isFinite(date.getTime()))
        throw new Error("Enter a valid date, including a timezone where applicable.");
      result = String(Math.floor(date.getTime() / 1000));
      break;
    }
    case "upper":
      result = input.toUpperCase();
      break;
    case "lower":
      result = input.toLowerCase();
      break;
    case "title":
      result = words(input).map(cap).join(" ");
      break;
    case "camel": {
      const w = words(input);
      result = (w[0] || "") + w.slice(1).map(cap).join("");
      break;
    }
    case "pascal":
      result = words(input).map(cap).join("");
      break;
    case "snake":
      result = words(input).join("_");
      break;
    case "kebab":
      result = words(input).join("-");
      break;
    case "trim":
      result = input.trim();
      break;
    case "trim-lines":
      result = input
        .split(/\r?\n/)
        .map((x) => x.trim())
        .join("\n");
      break;
    case "sort-lines":
      result = input.split(/\r?\n/).toSorted().join("\n");
      break;
    case "unique":
      result = [...new Set(input.split(/\r?\n/))].join("\n");
      break;
    case "empty":
      result = input
        .split(/\r?\n/)
        .filter((x) => x.trim())
        .join("\n");
      break;
    case "reverse":
      result = input.split(/\r?\n/).toReversed().join("\n");
      break;
    case "escape":
      result = JSON.stringify(input);
      break;
    case "unescape": {
      const parsed = JSON.parse(input);
      if (typeof parsed !== "string") throw new Error("Enter a JSON string literal.");
      result = parsed;
      break;
    }
    case "html":
      result = input.replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
      );
      break;
    case "html-decode":
      result = input.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (all, code: string) => {
        if (code.startsWith("#")) {
          const n =
            code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
          return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
        }
        return (
          ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" } as Record<string, string>)[
            code.toLowerCase()
          ] || all
        );
      });
      break;
    case "inspect":
      result = JSON.stringify(
        {
          utf16Units: input.length,
          unicodeCodePoints: [...input].length,
          utf8Bytes: Buffer.byteLength(input),
          lines: input ? input.split(/\r?\n/).length : 0,
          words: input.trim() ? input.trim().split(/\s+/).length : 0,
        },
        null,
        2,
      );
      break;
    default:
      throw new Error("Select a supported transformation.");
  }
  if (result.length > 120000 || Buffer.byteLength(result) > 120000)
    throw new Error("Transformed output exceeds 120 KB.");
  return result;
};
