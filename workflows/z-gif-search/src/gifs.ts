import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, dataDir, readJson, writeJson, str } from "./env.ts";
export type Gif = {
  id: string;
  title: string;
  url: string;
  preview: string;
  page: string;
  provider: string;
  previewPath?: string;
};
export const providers = ["giphy", "klipy", "direct", "finer"] as const;
export type Provider = (typeof providers)[number];
export const validURL = (value: unknown): string => {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /(^|\.)(giphy\.com|tenor\.com|klipy\.com|klipynetwork\.com|thefinergifs\.club)$/.test(
        url.hostname,
      )
      ? url.href
      : "";
  } catch {
    return "";
  }
};
export const normalize = (raw: any, provider: Provider): Gif[] => {
  const rows =
    provider === "finer" ? raw?.results : provider === "klipy" ? raw?.results : raw?.data;
  if (!Array.isArray(rows)) throw new Error("Unexpected GIF provider response.");
  return rows.slice(0, 50).flatMap((r: any) => {
    const id = String(provider === "finer" ? r.fields?.fileid || "" : r.id || "").slice(0, 200);
    const url = validURL(
      provider === "finer"
        ? `https://media.thefinergifs.club/${encodeURIComponent(id)}.gif`
        : provider === "klipy"
          ? r.media_formats?.gif?.url
          : r.images?.original?.url,
    );
    const preview =
      validURL(
        provider === "klipy"
          ? r.media_formats?.tinygif?.url
          : r.images?.fixed_width?.url || r.images?.fixed_width_small?.url,
      ) || url;
    if (!id || !url) return [];
    return [
      {
        id: `${provider}:${id}`,
        title: String(r.title || r.content_description || r.fields?.text || "GIF").slice(0, 300),
        url,
        preview,
        page: validURL(r.url || r.itemurl) || url,
        provider,
      },
    ];
  });
};
export const bounded = async (res: Response, maximum: number): Promise<Uint8Array> => {
  if (!res.ok) throw new Error(`GIF service unavailable (HTTP ${res.status}).`);
  if (Number(res.headers.get("content-length")) > maximum)
    throw new Error("GIF response is too large.");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Empty GIF response.");
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > maximum) throw new Error("GIF response is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const out = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};
export const search = async (
  query: string,
  provider: Provider,
  page = 0,
  fresh = false,
): Promise<{ rows: Gif[]; at: number; more: boolean }> => {
  if (query.length > 50) throw new Error("Search supports up to 50 characters.");
  if (!providers.includes(provider) || !Number.isInteger(page) || page < 0 || page > 20)
    throw new Error("Invalid GIF search.");
  if (provider === "finer" && !query) return { rows: [], at: Date.now(), more: false };
  const signature = createHash("sha256")
      .update(JSON.stringify([provider, query, page]))
      .digest("hex"),
    file = join(cacheDir(), `search-${signature}.json`);
  const old = readJson<{ rows: Gif[]; at: number; more: boolean } | null>(file, null);
  const ttl = Math.max(0, Math.min(60, Number(str("refresh_minutes", "5")) || 0)) * 60000;
  if (!fresh && old && Date.now() - old.at < ttl) return old;
  const limit = 24;
  const url = new URL(
    provider === "direct"
      ? `https://api.giphy.com/v1/gifs/${query ? "search" : "trending"}`
      : provider === "finer"
        ? "https://api.thefinergifs.club/search"
        : `https://gif-search.raycast.com/api/${provider}`,
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(page * limit));
  if (query) url.searchParams.set("q", query);
  if (provider === "direct") {
    const key = str("giphy_key");
    if (!key)
      throw new Error(
        "Add your GIPHY API key in Workflow Configuration, or choose GIPHY reference service.",
      );
    url.searchParams.set("api_key", key);
  }
  if (provider === "giphy" || provider === "direct") {
    url.searchParams.set("rating", "pg-13");
    url.searchParams.set("lang", "en");
  }
  if (provider === "klipy") {
    url.searchParams.set("media_filter", "gif,tinygif");
    if (page) throw new Error("Klipy pagination is unavailable; refine your search.");
  }
  if (provider === "finer") {
    url.searchParams.set("q.parser", "simple");
    url.searchParams.set("size", String(limit));
    url.searchParams.set("start", String(page * limit));
  }
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  } catch {
    throw new Error("GIF service could not be reached. Try Refresh or another provider.");
  }
  const bytes = await bounded(response, 4e6);
  const rows = normalize(JSON.parse(new TextDecoder().decode(bytes)), provider);
  const result = { rows, at: Date.now(), more: rows.length === limit && provider !== "klipy" };
  writeJson(file, result);
  return result;
};
export type Preferences = { layout: "list" | "grid"; favorites: Gif[]; recent: Gif[] };
export const preferences = (): Preferences => {
  const p = readJson<Partial<Preferences>>(join(dataDir(), "preferences.json"), {});
  const valid = (a: unknown): Gif[] =>
    Array.isArray(a)
      ? a
          .filter(
            (e: any) =>
              typeof e.id === "string" &&
              typeof e.title === "string" &&
              validURL(e.url) &&
              validURL(e.preview) &&
              validURL(e.page),
          )
          .slice(0, 200)
      : [];
  return {
    layout: p.layout === "list" ? "list" : "grid",
    favorites: valid(p.favorites),
    recent: valid(p.recent),
  };
};
export const savePreferences = (p: Preferences): void =>
  writeJson(join(dataDir(), "preferences.json"), p);
export const remember = (e: Gif, favorite = false): void => {
  const p = preferences();
  if (favorite)
    p.favorites = p.favorites.some((x) => x.id === e.id)
      ? p.favorites.filter((x) => x.id !== e.id)
      : [e, ...p.favorites].slice(0, 200);
  else p.recent = [e, ...p.recent.filter((x) => x.id !== e.id)].slice(0, 80);
  savePreferences(p);
};

export const thumbnails = async (rows: Gif[]): Promise<void> => {
  for (let offset = 0; offset < rows.length; offset += 6) {
    await Promise.all(
      rows.slice(offset, offset + 6).map(async (e) => {
        const url = validURL(e.preview);
        if (!url) return;
        const path = join(
          cacheDir(),
          `preview-${createHash("sha256").update(url).digest("hex")}.gif`,
        );
        if (existsSync(path)) {
          e.previewPath = path;
          return;
        }
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: "error" });
          const bytes = await bounded(res, 1500000);
          if (!["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.slice(0, 6)))) return;
          writeFileSync(path, bytes, { mode: 0o600 });
          e.previewPath = path;
        } catch {
          /* Keep the result usable when a preview host fails. */
        }
      }),
    );
  }
};
