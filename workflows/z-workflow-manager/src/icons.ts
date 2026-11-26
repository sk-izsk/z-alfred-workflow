import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir } from "./env.ts";
import type { Entry } from "./catalog.ts";
const file = (e: Entry) =>
  join(cacheDir(), `icon-${createHash("sha256").update(e.url).digest("hex").slice(0, 24)}.png`);
export const rowIcon = (e: Entry): string => (e.path ? e.icon : existsSync(file(e)) ? file(e) : e.icon);
export const loadIcons = async (entries: Entry[]): Promise<void> => {
  const batch = entries.filter((e) => !e.path && e.source === "gallery" && !existsSync(file(e))).slice(0, 12);
  for (let i = 0; i < batch.length; i += 4)
    await Promise.allSettled(
      batch.slice(i, i + 4).map(async (e) => {
        if (!/^https:\/\/alfred\.app\/workflows\/[a-z0-9-]+\/[a-z0-9-]+\/$/i.test(e.url)) return;
        const response = await fetch(`${e.url}icon.png`, { signal: AbortSignal.timeout(4000) });
        if (!response.ok || !response.body) return;
        const chunks: Uint8Array[] = [];
        let total = 0;
        for await (const c of response.body) {
          total += c.length;
          if (total > 300000) throw new Error("Icon too large");
          chunks.push(c);
        }
        const bytes = Buffer.concat(chunks);
        if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          writeFileSync(file(e), bytes, { mode: 0o600 });
      }),
    );
};
