import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";
import { cityQuery, parseReport, type Report } from "./model.ts";
export const key = (q: string): string =>
  createHash("sha256").update(q.trim().toLowerCase()).digest("hex").slice(0, 24);
export const cached = (query: string): Report | undefined =>
  readJson<Report | undefined>(join(cacheDir(), `report-${key(query)}.json`), undefined);
export const report = async (query: string, fresh = false): Promise<{ report: Report; stale: boolean }> => {
  const q = cityQuery(query),
    old = cached(q);
  if (old && !fresh && Date.now() - old.fetched < 10 * 60000) return { report: old, stale: false };
  try {
    const response = await fetch(`https://wttr.in/${encodeURIComponent(q)}?format=j1`, {
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/json", "User-Agent": "Alfred-Weather/0.1.0" },
    });
    if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
    const body = await response.text();
    if (body.length > 2e6) throw new Error("Weather response exceeded the size limit.");
    const data = parseReport(JSON.parse(body), q);
    writeJson(join(cacheDir(), `report-${key(q)}.json`), data);
    return { report: data, stale: false };
  } catch (error) {
    if (old) return { report: old, stale: true };
    throw new Error(
      `Could not load weather. Check the city and connection. ${error instanceof Error ? error.message : ""}`,
      { cause: error },
    );
  }
};
