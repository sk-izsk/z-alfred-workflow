import languages from "../assets/languages.json" with { type: "json" };
import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson, str } from "./env.ts";
import { CHUNK_CHARACTERS, characterCount } from "./chunks.ts";
export { languages };
export type Translation = {
  text: string;
  original: string;
  pronunciation: string;
  from: string;
  to: string;
  fetched: number;
};
export const languageName = (code: string) =>
  code === "mul"
    ? "Multiple languages"
    : languages.find((l) => l.value.toLowerCase() === code.toLowerCase())?.title || code;
export const validLanguage = (code: string, source = false): boolean =>
  languages.some((l) => l.value === code && (source || code !== "auto"));
export const parseTranslation = (raw: unknown, original: string, to: string): Translation => {
  if (!Array.isArray(raw) || !Array.isArray(raw[0]))
    throw new Error("Google returned an unfamiliar translation response.");
  const text = raw[0]
    .map((r: unknown) => (Array.isArray(r) && typeof r[0] === "string" ? r[0] : ""))
    .join("");
  const pronunciation = raw[0].find(
    (r: unknown) => Array.isArray(r) && !r[0] && (typeof r[2] === "string" || typeof r[3] === "string"),
  );
  const from = typeof raw[2] === "string" ? raw[2] : Array.isArray(raw[8]?.[0]) ? raw[8][0][0] : "";
  if (!text || typeof from !== "string" || !from)
    throw new Error("Google returned no translation or detected language.");
  return {
    text,
    original,
    pronunciation: pronunciation?.[2] || pronunciation?.[3] || "",
    from,
    to,
    fetched: Date.now(),
  };
};
export const translate = async (
  text: string,
  from: string,
  to: string,
  fresh = false,
): Promise<Translation> => {
  if (!text.trim() || characterCount(text) > CHUNK_CHARACTERS)
    throw new Error("A translation part must contain 1–4,500 characters.");
  if (!validLanguage(from, true) || !validLanguage(to))
    throw new Error("Choose supported source and target languages.");
  const minutes = Math.max(0, Math.min(10080, Number(str("cache_minutes", "0")) || 0)),
    key = createHash("sha256")
      .update(JSON.stringify([text, from, to]))
      .digest("hex"),
    path = join(cacheDir(), `translation-${key}.json`),
    old = minutes ? readJson<Translation | null>(path, null) : null;
  if (old && !fresh && Date.now() - old.fetched < minutes * 60000) return old;
  const url = new URL("https://translate.google.com/translate_a/single");
  url.search = new URLSearchParams({
    client: "dict-chrome-ex",
    sl: from,
    tl: to,
    hl: to,
    ie: "UTF-8",
    oe: "UTF-8",
  }).toString();
  url.searchParams.append("dt", "t");
  url.searchParams.append("dt", "rm");
  // POST keeps translated text out of URL histories and access logs; same transport as the reference's long-text path.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ q: text }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429)
    throw new Error("Google is rate limiting requests. Wait and retry, or open Google Translate.");
  if (!response.ok) throw new Error(`Google Translate HTTP ${response.status}.`);
  const body = await response.text();
  if (body.length > 2e6) throw new Error("Translation response too large.");
  const result = parseTranslation(JSON.parse(body), text, to);
  if (minutes) writeJson(path, result);
  return result;
};

export const translatePart = async (
  part: string,
  from: string,
  to: string,
  fresh = false,
): Promise<Translation> => {
  const trimmed = part.trim();
  if (!trimmed)
    return {
      text: part,
      original: part,
      pronunciation: "",
      from: from === "auto" ? "" : from,
      to,
      fetched: Date.now(),
    };
  const prefix = part.slice(0, part.length - part.trimStart().length),
    suffix = part.slice(part.trimEnd().length);
  const result = await translate(trimmed, from, to, fresh);
  return { ...result, original: part, text: prefix + result.text + suffix };
};
