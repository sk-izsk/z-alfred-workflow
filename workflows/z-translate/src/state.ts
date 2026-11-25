import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { cacheDir, dataDir, readJson, writeJson, str } from "./env.ts";
import { validLanguage, type Translation } from "./api.ts";
export type State = {
  id: string;
  returnTo: string;
  query: string;
  from: string;
  to: string;
  result?: Translation;
  error?: boolean;
  job?: { parts: string[]; done: Translation[]; fresh: boolean; failed: boolean };
  request: string;
  at: number;
  status: string;
};
const file = (id: string) => {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Reopen Translate.");
  return join(cacheDir(), `window-${id}.json`);
};
export const save = (s: State): void => writeJson(file(s.id), s);
export const read = (id: string): State => {
  const s = readJson<State | null>(file(id), null);
  if (!s || Date.now() - s.at > 86400000) throw new Error("Reopen Translate.");
  return s;
};
export const remember = (s: State): void =>
  writeJson(join(dataDir(), "languages.json"), { from: s.from, to: s.to });
export const create = (query: string, returnTo = ""): State => {
  const root = cacheDir();
  for (const name of readdirSync(root))
    if (/^(?:window-[a-f0-9-]{36}|translation-[a-f0-9]{64})\.json$/.test(name)) {
      try {
        const path = join(root, name);
        const lifetime = name.startsWith("window-")
          ? 86400000
          : Math.max(0, Math.min(10080, Number(str("cache_minutes", "0")) || 0)) * 60000;
        if (Date.now() - statSync(path).mtimeMs > lifetime) unlinkSync(path);
      } catch {}
    }
  const pref = readJson<{ from?: string; to?: string }>(join(dataDir(), "languages.json"), {}),
    from = pref.from || str("source_language", "auto"),
    to = pref.to || str("target_language", "en");
  if (!validLanguage(from, true) || !validLanguage(to))
    throw new Error("Set supported source and target languages in Configuration.");
  const s: State = {
    id: randomUUID(),
    returnTo,
    query,
    from,
    to,
    request: randomUUID(),
    at: Date.now(),
    status: "Google Translate",
  };
  save(s);
  return s;
};
