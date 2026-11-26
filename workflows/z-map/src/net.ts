import { createHash } from "node:crypto";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: Fetcher = (url, init) => fetch(url, init);
/** Tests replace the network here. */
export const setFetcher = (next: Fetcher): void => {
  fetcher = next;
};

const send = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    // Google explains rejected keys in the body; show that instead of a bare status.
    const detail = await response
      .json()
      .then((body: { error?: { message?: string } }) => body.error?.message)
      .catch(() => undefined);
    throw new Error(`HTTP ${response.status} from ${new URL(url).host}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
};

export const getJson = <T>(url: string, userAgent: string): Promise<T> =>
  send<T>(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });

/** POST with a JSON body; secrets go in headers, never in the URL. */
export const postJson = <T>(
  url: string,
  body: unknown,
  userAgent: string,
  headers: Record<string, string>,
): Promise<T> =>
  send<T>(url, {
    method: "POST",
    headers: { "User-Agent": userAgent, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

export const MINUTE = 60_000;
export const TTL = { route: 10 * MINUTE, error: MINUTE, place: 7 * 24 * 60 * MINUTE };

type Entry<T> = { at: number; ttl: number; value?: T; error?: string };
const file = (key: string) => join(cacheDir(), `c-${createHash("sha1").update(key).digest("hex")}.json`);

export const readCache = <T>(key: string): T | undefined => {
  const entry = readJson<Entry<T> | undefined>(file(key), undefined);
  if (!entry || Date.now() - entry.at > entry.ttl) return undefined;
  if (entry.error) throw new Error(entry.error);
  return entry.value;
};
export const writeCache = <T>(key: string, value: T, ttl: number): void =>
  writeJson(file(key), { at: Date.now(), ttl, value } satisfies Entry<T>);

/** Cached call; failures are cached for a minute so a broken service isn't hammered. */
export const cached = async <T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> => {
  const hit = readCache<T>(key);
  if (hit !== undefined) return hit;
  try {
    const value = await load();
    writeCache(key, value, ttl);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(file(key), { at: Date.now(), ttl: TTL.error, error: message } satisfies Entry<T>);
    throw error;
  }
};

/** Drops entries older than the longest TTL; cheap enough to run on launch. */
export const pruneCache = (): void => {
  const dir = cacheDir();
  const limit = Date.now() - TTL.place;
  for (const name of readdirSync(dir))
    if (name.startsWith("c-") && statSync(join(dir, name)).mtimeMs < limit) unlinkSync(join(dir, name));
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
