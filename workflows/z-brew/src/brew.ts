import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import { bool, cacheDir, readJson, str, writeJson } from "./env.ts";
import { installedPackages, mergeInstalled, normalize, type Package, packageName } from "./model.ts";
import { run, type RunResult } from "./proc.ts";

export const executable = (): string => {
  const custom = str("brew_path");
  for (const path of custom ? [custom] : ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]) {
    try {
      accessSync(path, constants.X_OK);
      if (!path.startsWith("/")) throw new Error();
      return path;
    } catch {
      /* Try next standard location. */
    }
  }
  throw new Error("Homebrew not found. Set its executable in Workflow Configuration.");
};
export const readBrew = (args: string[], timeoutMs = 120000): Promise<RunResult> =>
  run(executable(), args, {
    timeoutMs,
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
      HOMEBREW_NO_AUTO_UPDATE: "1",
      HOMEBREW_NO_ANALYTICS: "1",
      HOMEBREW_NO_ENV_HINTS: "1",
    },
  });
export const jsonBrew = async (args: string[], findings = false): Promise<any> => {
  const result = await readBrew(args);
  if (result.code !== 0 && !(findings && result.code === 1 && result.stdout.trim()))
    throw new Error(result.stderr.trim() || `brew ${args[0]} failed.`);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`brew ${args[0]} returned an unsupported response. Update Homebrew and retry.`);
  }
};
export const localPackages = async (): Promise<Package[]> =>
  installedPackages(await jsonBrew(["info", "--json=v2", "--installed"]));
const cachePath = (name: string) => join(cacheDir(), `${name}.json`);
export const cached = <T>(name: string, lifetime: number): T | undefined => {
  const value = readJson<{ at: number; data: T } | null>(cachePath(name), null);
  return value && Date.now() - value.at < lifetime ? value.data : undefined;
};
export const store = (name: string, data: unknown): void =>
  writeJson(cachePath(name), { at: Date.now(), data });
export const fetchJSON = async (url: string): Promise<any> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Homebrew API returned ${response.status}. Try refreshing.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty Homebrew API response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Homebrew API response is too large.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};
export const catalog = async (refresh = false): Promise<Package[]> => {
  const old = cached<Package[]>("catalog", 6 * 3600000);
  if (old && !refresh) return old;
  const [formula, cask] = await Promise.all([
    fetchJSON("https://formulae.brew.sh/api/formula.json"),
    fetchJSON("https://formulae.brew.sh/api/cask.json"),
  ]);
  if (!Array.isArray(formula) || !Array.isArray(cask)) throw new Error("Unexpected Homebrew catalog format.");
  const packages = [...formula.map((p) => normalize(p, "formula")), ...cask.map((p) => normalize(p, "cask"))];
  store("catalog", packages);
  return packages;
};
export const loadPackages = async (search: boolean, refresh = false): Promise<Package[]> => {
  const local = await localPackages();
  store("installed", local);
  return search ? mergeInstalled(await catalog(refresh), local) : local;
};
export const details = async (p: Package): Promise<Package> => {
  const result = await jsonBrew(["info", "--json=v2", `--${p.kind}`, packageName(p.token)]);
  const raw = p.kind === "formula" ? result.formulae?.[0] : result.casks?.[0];
  return raw ? normalize(raw, p.kind) : p;
};
export const outdatedPackages = async (): Promise<Package[]> => {
  const args = ["outdated", "--json=v2", ...(bool("greedy_upgrades") ? ["--greedy"] : [])];
  const [local, result] = await Promise.all([localPackages(), jsonBrew(args, true)]);
  if (!Array.isArray(result.formulae) || !Array.isArray(result.casks))
    throw new Error("Unexpected Homebrew upgrade response.");
  const upgrades = new Map([
    ...result.formulae.map((r: any) => [`formula:${r.name}`, r]),
    ...result.casks.map((r: any) => [`cask:${r.name}`, r]),
  ] as [string, any][]);
  return local
    .map((p) => {
      const raw = upgrades.get(p.id) || upgrades.get(`${p.kind}:${p.token.split("/").at(-1)}`);
      return raw ? { ...p, outdated: true, version: String(raw.current_version || p.version) } : p;
    })
    .filter((p) => p.outdated);
};
