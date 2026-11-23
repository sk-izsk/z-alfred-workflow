import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bool, cacheDir } from "./env.ts";
import { publicEnv } from "./proc.ts";

/**
 * Website icons from Bitwarden's own icon server (what the official apps use).
 * Fetched in the background and cached; a `.none` marker stops re-asking for sites without one.
 */
const dir = () => {
  const path = join(cacheDir(), "icons");
  mkdirSync(path, { recursive: true });
  return path;
};

const safe = (host: string) => host.replace(/[^a-z0-9.-]/gi, "");

export const iconsEnabled = (): boolean => bool("fetch_favicons", true);

/** Path of a cached icon for this host, or "" (not fetched yet / none exists). */
export const cachedIcon = (host: string): string => {
  if (!host || !iconsEnabled()) return "";
  const file = join(dir(), `${safe(host)}.png`);
  return existsSync(file) ? file : "";
};

const missing = (hosts: string[]): string[] =>
  [...new Set(hosts.map(safe).filter(Boolean))].filter(
    (h) => !existsSync(join(dir(), `${h}.png`)) && !existsSync(join(dir(), `${h}.none`)),
  );

const fetchOne = async (host: string): Promise<void> => {
  try {
    const res = await fetch(`https://icons.bitwarden.net/${host}/icon.png`, {
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) throw new Error("no icon");
    writeFileSync(join(dir(), `${host}.png`), Buffer.from(await res.arrayBuffer()));
  } catch {
    writeFileSync(join(dir(), `${host}.none`), "");
  }
};

/** `bwa fetch-icons host…`: 6 at a time. */
export const fetchIcons = async (hosts: string[]): Promise<void> => {
  const queue = missing(hosts);
  const worker = async () => {
    for (let host = queue.shift(); host; host = queue.shift()) await fetchOne(host);
  };
  await Promise.all(Array.from({ length: 6 }, worker));
};

/** Kick off a detached fetch so the window never waits for the network. */
export const fetchIconsLater = (hosts: string[]): void => {
  const todo = iconsEnabled() ? missing(hosts) : [];
  if (!todo.length) return;
  spawn(process.execPath, [process.argv[1] ?? "", "fetch-icons", ...todo], {
    detached: true,
    stdio: "ignore",
    env: publicEnv(),
  }).unref();
};
