import { createHash } from "node:crypto";
import { join } from "node:path";
import { statSync } from "node:fs";
import { cacheDir, readJson, str, writeJson } from "./env.ts";
import { gh } from "./proc.ts";
import { host, object, array, text, type Json } from "./model.ts";
export const hostname = () => host(str("github_host", "github.com"));
export const api = async (endpoint: string, method = "GET", body?: Json, fresh = false): Promise<unknown> => {
  if (!/^[a-zA-Z0-9_/?=&%:.,+@-]+$/.test(endpoint) || endpoint.includes(".."))
    throw new Error("Invalid GitHub endpoint.");
  const key = createHash("sha256").update(`${hostname()}:${endpoint}`).digest("hex");
  const path = join(cacheDir(), `${key}.json`);
  if (method === "GET" && !fresh) {
    try {
      if (Date.now() - statSync(path).mtimeMs < 30_000) return readJson(path, null);
    } catch {
      /* No cached response yet. */
    }
  }
  const args = [
    "api",
    "--hostname",
    hostname(),
    endpoint,
    "--method",
    method,
    ...(body ? ["--input", "-"] : []),
  ];
  const out = await gh(args, body ? JSON.stringify(body) : "");
  const result = out ? JSON.parse(out) : null;
  if (method === "GET") writeJson(path, result);
  return result;
};
export const graphql = async (query: string, variables: Json = {}): Promise<Json> => {
  const result = object(
    JSON.parse(
      await gh(
        ["api", "--hostname", hostname(), "graphql", "--input", "-"],
        JSON.stringify({ query, variables }),
      ),
    ),
  );
  if (Array.isArray(result.errors))
    throw new Error(result.errors.map((e) => text(object(e).message)).join("; "));
  return object(result.data);
};
export const viewer = async (): Promise<Json> => object(await api("user"));
export const endpointRepo = (repo: string, suffix = ""): string =>
  `repos/${repo}${suffix ? "/" + suffix : ""}`;

export const allPages = async (endpoint: string, key?: string): Promise<Json[]> => {
  const rows: Json[] = [],
    seen = new Set<string>();
  for (let page = 1; ; page++) {
    const response = await api(`${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const items = array(key ? object(response)[key] : response);
    if (
      items.length &&
      items.every((item) => seen.has(text(item.node_id) || text(item.id) || JSON.stringify(item)))
    )
      break;
    for (const item of items) {
      seen.add(text(item.node_id) || text(item.id) || JSON.stringify(item));
      rows.push(item);
    }
    if (items.length < 100) break;
  }
  return rows;
};
