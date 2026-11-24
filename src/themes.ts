import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSetting, setSetting } from "./jsonc.ts";
import { type Pkg, builtinExtensionDirs, localExtensions, nls, readJsonFile } from "./extensions.ts";
import { writeFileSync } from "node:fs";
import type { Profile } from "./profiles.ts";

export type ThemeKind = "dark" | "light" | "hc";

export type Theme = {
  /** The value VS Code stores in `workbench.colorTheme`. */
  id: string;
  label: string;
  /** The extension it comes from ("One Dark Pro", "Theme Defaults"…). */
  pack: string;
  kind: ThemeKind;
};

const KEY = "workbench.colorTheme";

const kindOf = (uiTheme = ""): ThemeKind =>
  uiTheme.startsWith("hc") ? "hc" : uiTheme === "vs" ? "light" : "dark";

/** Every color theme an extension folder contributes (packs often contribute several). */
export const themesIn = (dir: string, pkg?: Pkg): Theme[] => {
  const p = pkg ?? readJsonFile<Pkg>(join(dir, "package.json")) ?? {};
  const pack = nls(dir, p.displayName) || p.name || "";
  return (p.contributes?.themes ?? []).map((t) => {
    const label = nls(dir, t.label) || t.id || "";
    return { id: t.id ?? label, label, pack, kind: kindOf(t.uiTheme) };
  });
};

/** Built-in themes + themes from the extensions installed in this profile. */
export const profileThemes = (profile: Profile): Theme[] => {
  const seen = new Set<string>();
  return [
    ...localExtensions(profile.manifestPath).flatMap((e) => themesIn(e.path, e.pkg)),
    ...builtinExtensionDirs().flatMap((dir) => themesIn(dir)),
  ]
    .filter((t) => t.id && !seen.has(t.id) && seen.add(t.id))
    .toSorted((a, b) => a.label.localeCompare(b.label));
};

const read = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "{}";
  }
};

export const currentTheme = (profile: Profile): string => getSetting(read(profile.settingsPath), KEY) ?? "";

/** VS Code watches settings.json, so open windows on this profile switch immediately. */
export const applyTheme = (profile: Profile, id: string): void =>
  writeFileSync(profile.settingsPath, setSetting(read(profile.settingsPath), KEY, id));
