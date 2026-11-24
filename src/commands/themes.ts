import { rmSync } from "node:fs";
import { join } from "node:path";
import { editor } from "../editors.ts";
import { bool, cacheDir, readJson, writeJson } from "../env.ts";
import { type Profile, configuredProfile, profileById } from "../profiles.ts";
import { type Theme, type ThemeKind, applyTheme, currentTheme, profileThemes } from "../themes.ts";
import { type Action, merge, rows, status, update, vars } from "../ui.ts";
import { icon, zedNotice } from "./common.ts";

const KIND_LABEL: Record<ThemeKind, string> = { dark: "Dark", light: "Light", hc: "High Contrast" };
export const THEME_KINDS = [
  { text: "All Themes", value: "all" },
  { text: "Dark", value: "dark" },
  { text: "Light", value: "light" },
  { text: "High Contrast", value: "hc" },
];

const validKind = (k = "") => (THEME_KINDS.some((x) => x.value === k) ? k : "all");

export const toRow = (t: Theme, current: string) => ({
  uid: t.id,
  ...icon("symbol", t.kind === "light" ? "sun.max" : t.kind === "hc" ? "circle.lefthalf.filled" : "moon"),
  "rowTitle.text": t.label,
  "rowDetail.text": t.pack,
  "rowCurrent.hidden": t.id !== current,
  "rowKind.text": KIND_LABEL[t.kind],
  match: [t.label, t.pack, t.id].join(" "),
});

const load = (profile: Profile, kind: string, note?: string): Action => {
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
  const kind = validKind(process.env.theme_kind);
  return merge(vars({ theme_kind: kind }), load(await configuredProfile(), kind));
};

/** Picker choices, on their own (a bad picker update must never empty the list). */
export const themePickers = async (): Promise<Action> =>
  editor().kind === "zed"
    ? {}
    : update({ kindPicker: { items: THEME_KINDS, selected: validKind(process.env.theme_kind) } });

export const themeFilter = async ([kind = "all"]: string[]): Promise<Action> =>
  merge(vars({ theme_kind: validKind(kind) }), load(await configuredProfile(), validKind(kind)));

// ── live preview (like VS Code's own picker): the theme before the first preview is remembered,
//    ↩ keeps the new one, ⎋ / closing (the window's `quit` event) puts the old one back ──

type Preview = { profileId: string; original: string };
const previewFile = () => join(cacheDir(), "theme-preview.json");

const restore = async (): Promise<void> => {
  const state = readJson<Preview | undefined>(previewFile(), undefined);
  if (!state) return;
  rmSync(previewFile(), { force: true });
  applyTheme(profileById(state.profileId), state.original);
};

export const themeRestore = async (): Promise<Action> => (await restore(), {});

export const theme = async ([action = "", id = ""]: string[]): Promise<Action> => {
  const profile = await configuredProfile();
  switch (action) {
    case "apply":
      if (!id) throw new Error("Select a theme first");
      rmSync(previewFile(), { force: true }); // committed: nothing to restore
      applyTheme(profile, id);
      return load(profile, validKind(process.env.theme_kind), `Applied ${id} to ${profile.name}`);
    case "preview": {
      if (!id || !bool("theme_preview", true)) return {};
      const saved = readJson<Preview | undefined>(previewFile(), undefined);
      if (!saved) writeJson(previewFile(), { profileId: profile.id, original: currentTheme(profile) });
      applyTheme(profile, id);
      return {};
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
