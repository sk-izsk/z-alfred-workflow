import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { bool, cacheDir, readJson, writeJson } from "../env.ts";
import { DEFAULT_PROFILE, profileById, profiles, recentProfile } from "../profiles.ts";
import { recents } from "../projects.ts";
import { type Theme, type ThemeKind, applyTheme, currentTheme, profileThemes } from "../themes.ts";
import { type Action, merge, rows, status, update, vars } from "../ui.ts";
import { icon, zedNotice } from "./common.ts";
import { editor } from "../editors.ts";

const KIND_LABEL: Record<ThemeKind, string> = { dark: "Dark", light: "Light", hc: "High Contrast" };
export const THEME_KINDS = [
  { text: "All Themes", value: "all" },
  { text: "Dark", value: "dark" },
  { text: "Light", value: "light" },
  { text: "High Contrast", value: "hc" },
];

const validKind = (k = "") => (THEME_KINDS.some((x) => x.value === k) ? k : "all");

/** The saved profile, else the profile of the last opened project. */
const pickProfile = async (saved = ""): Promise<string> => {
  if (saved && profiles().some((p) => p.id === saved)) return saved;
  return recentProfile((await recents()).map((p) => p.uri));
};

export const toRow = (t: Theme, current: string) => ({
  uid: t.id,
  ...icon("symbol", t.kind === "light" ? "sun.max" : t.kind === "hc" ? "circle.lefthalf.filled" : "moon"),
  "rowTitle.text": t.label,
  "rowDetail.text": t.pack,
  "rowCurrent.hidden": t.id !== current,
  "rowKind.text": KIND_LABEL[t.kind],
  match: [t.label, t.pack, t.id].join(" "),
});

const load = (profileId: string, kind: string, note?: string): Action => {
  const profile = profileById(profileId);
  const current = currentTheme(profile);
  const list = profileThemes(profile).filter((t) => kind === "all" || t.kind === kind);
  return merge(
    rows(
      "items",
      list.map((t) => toRow(t, current)),
    ),
    status(note ?? `${profile.name} · ${current || "default theme"}`),
  );
};

export const themeInit = async (): Promise<Action> => {
  if (editor().kind === "zed") return zedNotice("Theme switching");
  const profileId = await pickProfile(process.env.theme_profile);
  const kind = validKind(process.env.theme_kind);
  return merge(vars({ theme_profile: profileId, theme_kind: kind }), load(profileId, kind));
};

/** Picker choices, on their own (a bad picker update must never empty the list). */
export const themePickers = async (): Promise<Action> => {
  if (editor().kind === "zed") return {};
  const profileId = await pickProfile(process.env.theme_profile);
  return update({
    profilePicker: { items: profiles().map((p) => ({ text: p.name, value: p.id })), selected: profileId },
    kindPicker: { items: THEME_KINDS, selected: validKind(process.env.theme_kind) },
  });
};

export const themeFilter = async ([profileId = DEFAULT_PROFILE, kind = "all"]: string[]): Promise<Action> => {
  await restore(); // switching profile ends any preview on the old one
  return merge(
    vars({ theme_profile: profileId, theme_kind: validKind(kind) }),
    load(profileId, validKind(kind)),
  );
};

// ── live preview: remember the theme before the first preview; ⎋ (quit) puts it back ──

type Preview = { profileId: string; original: string };
const previewFile = () => join(cacheDir(), "theme-preview.json");

const restore = async (): Promise<void> => {
  const state = readJson<Preview | undefined>(previewFile(), undefined);
  if (!state) return;
  rmSync(previewFile(), { force: true });
  if (state.original) applyTheme(profileById(state.profileId), state.original);
};

export const themeRestore = async (): Promise<Action> => (await restore(), {});

export const theme = async ([
  action = "",
  id = "",
  profileId = DEFAULT_PROFILE,
]: string[]): Promise<Action> => {
  const profile = profileById(profileId);
  const kind = validKind(process.env.theme_kind);
  switch (action) {
    case "apply":
      if (!id) throw new Error("Select a theme first");
      rmSync(previewFile(), { force: true }); // committed: nothing to restore
      applyTheme(profile, id);
      return load(profile.id, kind, `Applied ${id} to ${profile.name}`);
    case "preview":
      if (!id || !bool("theme_preview")) return {};
      if (!existsSync(previewFile()))
        writeJson(previewFile(), { profileId: profile.id, original: currentTheme(profile) });
      applyTheme(profile, id);
      return {};
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
