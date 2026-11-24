import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { exec } from "./proc.ts";
import { type Package } from "./model.ts";
import { type Item } from "./state.ts";
const normalized = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.app$/i, "")
    .replace(/[^a-z0-9]/g, "");
export const appMatches = (name: string, version: string, p: Package): boolean =>
  p.kind === "cask" &&
  !p.installed.length &&
  !p.disabled &&
  p.apps.some((app) => normalized(basename(app)) === normalized(name)) &&
  !!version;
export const adoptableApps = async (packages: Package[]): Promise<Item[]> => {
  const results: Item[] = [];
  for (const directory of ["/Applications", join(homedir(), "Applications")]) {
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory).filter((n) => n.endsWith(".app"))) {
      const path = join(directory, name);
      let version = "";
      try {
        version = await exec("/usr/bin/plutil", [
          "-extract",
          "CFBundleShortVersionString",
          "raw",
          "-o",
          "-",
          join(path, "Contents/Info.plist"),
        ]);
      } catch {
        continue;
      }
      for (const p of packages.filter((candidate) => appMatches(name, version, candidate))) {
        const matches = version === p.version.split(",")[0];
        results.push({
          id: `app:${p.id}:${name}`,
          title: name.slice(0, -4),
          description: `${matches ? "Version matches" : "Check version"} · Preview before adoption`,
          value: `${version} → ${p.version}`,
          colour: matches ? "systemGreenColor" : "systemOrangeColor",
          icon: "app",
          path,
          packageId: p.id,
        });
      }
    }
  }
  return results.toSorted((a, b) => a.title.localeCompare(b.title));
};
