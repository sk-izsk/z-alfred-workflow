import { rmSync } from "node:fs";
import { join } from "node:path";
import { bool, cacheDir, readJson, writeJson } from "../env.ts";
import { installExtension, localExtensions, uninstallExtension } from "../extensions.ts";
import type { GalleryExtension } from "../marketplace.ts";
import { configuredProfile, profileById } from "../profiles.ts";
import { applyTheme, currentTheme, themesIn } from "../themes.ts";
import { type Action, status } from "../ui.ts";

/**
 * Try a theme that isn't installed, like VS Code's "Browse Color Themes": install it for a moment and
 * switch to it. ⌘T again cycles through the pack's themes; ↩ (install) keeps it; moving to another
 * theme or closing the window uninstalls it and puts the old theme back.
 */
type Trial = { extId: string; installedByTrial: boolean; profileId: string; original: string; index: number };

const trialFile = () => join(cacheDir(), "theme-trial.json");
const pickFile = () => join(cacheDir(), "theme-trial-pick.json");
const readTrial = () => readJson<Trial | undefined>(trialFile(), undefined);

/** Undo the trial: uninstall what it installed, restore the theme from before. */
export const endTrial = async (): Promise<void> => {
  const t = readTrial();
  if (!t) return;
  rmSync(trialFile(), { force: true });
  const profile = profileById(t.profileId);
  if (t.installedByTrial) await uninstallExtension(t.extId, profile.name).catch(() => undefined);
  applyTheme(profile, t.original);
};

/** ↩ on the tried extension: keep it installed and applied. */
export const keepTrial = (id: string): boolean => {
  const t = readTrial();
  if (!t || t.extId.toLowerCase() !== id.toLowerCase()) return false;
  rmSync(trialFile(), { force: true });
  return true;
};

export const tryTheme = async (e: GalleryExtension): Promise<Action> => {
  if (!e.isTheme) return status(`${e.name} isn't a color theme`, "systemOrangeColor");
  const profile = await configuredProfile();
  const prev = readTrial();
  const same = prev?.extId.toLowerCase() === e.id.toLowerCase();
  const original = prev ? prev.original : currentTheme(profile);
  let installedByTrial = same ? prev!.installedByTrial : false;
  if (prev && !same && prev.installedByTrial) {
    await uninstallExtension(prev.extId, profileById(prev.profileId).name).catch(() => undefined);
  }
  const find = () =>
    localExtensions(profile.manifestPath).find((x) => x.id.toLowerCase() === e.id.toLowerCase());
  if (!find()) {
    await installExtension(e.id, profile.name);
    installedByTrial = true;
  }
  const ext = find();
  const themes = ext ? themesIn(ext.path, ext.pkg) : [];
  if (!themes.length) throw new Error(`${e.name} has no color themes`);
  const index = same ? prev!.index + 1 : 0;
  const theme = themes[index % themes.length]!;
  applyTheme(profile, theme.id);
  writeJson(trialFile(), { extId: e.id, installedByTrial, profileId: profile.id, original, index });
  const more = themes.length > 1 ? ` (${(index % themes.length) + 1}/${themes.length}, ⌘T next)` : "";
  return status(`Trying ${theme.label}${more} · ↩ keep · ⎋ undo`);
};

/**
 * Automatic mode: every selection change records the pick; after resting on it for a moment
 * (and only if it's still the pick) the theme is tried. Off unless enabled in the configuration.
 */
export const autoTry = async (e: GalleryExtension | undefined): Promise<Action> => {
  if (!e?.isTheme || !bool("theme_auto_try")) return {};
  const stamp = Date.now();
  writeJson(pickFile(), { id: e.id, stamp });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const pick = readJson<{ id: string; stamp: number }>(pickFile(), { id: "", stamp: 0 });
  if (pick.stamp !== stamp) return {}; // the user moved on
  return tryTheme(e);
};
