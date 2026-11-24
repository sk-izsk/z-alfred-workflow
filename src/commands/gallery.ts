import { existsSync } from "node:fs";
import { join } from "node:path";
import { editor, shortName } from "../editors.ts";
import { extensionUri, installExtension, localExtensions, uninstallExtension } from "../extensions.ts";
import { cacheDir, readJson, writeJson } from "../env.ts";
import { openUrl } from "../launch.ts";
import {
  CATEGORIES,
  type GalleryExtension,
  cachedIcon,
  compact,
  fetchIcons,
  galleryName,
  itemUrl,
  searchGallery,
} from "../marketplace.ts";
import { configuredProfile, profiles } from "../profiles.ts";
import {
  type Action,
  copy,
  finish,
  menuItem,
  merge,
  popup,
  rows,
  separator,
  status,
  update,
  vars,
} from "../ui.ts";
import { entry, icon, zedNotice } from "./common.ts";
import { confirmUninstall, previewSheet } from "./extensions.ts";

/** Most installed (per category), cached for an hour: the window opens with a full list at no cost. */
const popular = async (cat: string): Promise<GalleryExtension[]> => {
  const file = join(cacheDir(), `gallery-popular-${cat.replace(/\W+/g, "-") || "all"}.json`);
  const cache = readJson<{ at: number; list: GalleryExtension[] }>(file, { at: 0, list: [] });
  if (Date.now() - cache.at < 3_600_000 && cache.list.length) return cache.list;
  const list = await searchGallery("", cat);
  writeJson(file, { at: Date.now(), list });
  return list;
};

/** The last results, so row actions (↩, ⌘K) don't search the Marketplace again. */
const lastFile = () => join(cacheDir(), "gallery-last.json");

/** "Installed" means installed in the configured profile (Workflow Configuration → VS Code Profile). */
const installedIds = async () =>
  new Set(localExtensions((await configuredProfile()).manifestPath).map((e) => e.id.toLowerCase()));

const validCategory = (c = "") => (CATEGORIES.includes(c) ? c : "");

export const toRow = (e: GalleryExtension, installed: Set<string>) => {
  const file = cachedIcon(e.id);
  return {
    uid: e.id,
    ...(existsSync(file) ? icon("file", file) : icon("symbol", "puzzlepiece.extension")),
    "rowTitle.text": e.name,
    "rowDetail.text": e.publisher,
    "rowInstalledPill.hidden": !installed.has(e.id.toLowerCase()),
    "rowInstalls.text": e.installs === undefined ? "" : compact(e.installs),
    "rowDownload.hidden": e.installs === undefined,
    "rowVersion.text": e.version,
    "rowVersionPill.hidden": !e.version,
  };
};

const show = async (list: GalleryExtension[], note: string): Promise<Action> => {
  const installed = await installedIds();
  return merge(
    rows(
      "items",
      list.map((e) => toRow(e, installed)),
    ),
    status(note),
  );
};

export const galleryInit = async (): Promise<Action> =>
  editor().kind === "zed" ? zedNotice("The Marketplace") : status(`Type to search ${galleryName()}`);

export const galleryPickers = async (): Promise<Action> =>
  editor().kind === "zed"
    ? {}
    : update({
        categoryPicker: {
          items: [
            { text: "All Categories", value: "" },
            { type: "separator" },
            ...CATEGORIES.map((c) => ({ text: c, value: c })),
          ],
          selected: validCategory(process.env.gallery_category),
        },
      });

export const gallerySearch = async ([text = "", category = ""]: string[]): Promise<Action> => {
  if (editor().kind === "zed") return zedNotice("The Marketplace");
  const cat = validCategory(category);
  const remember = vars({ gallery_category: cat });
  const list = text.trim() ? await searchGallery(text, cat) : await popular(cat);
  writeJson(lastFile(), list);
  await fetchIcons(list);
  const what = text.trim() ? `“${text.trim()}”` : `most installed${cat ? ` ${cat}` : ""}`;
  return merge(
    remember,
    await show(
      list,
      list.length ? `${list.length} results for ${what} · ${galleryName()}` : `Nothing found for ${what}`,
    ),
  );
};

export const gallery = async ([action = "", id = "", profileName = ""]: string[]): Promise<Action> => {
  const e = readJson<GalleryExtension[]>(lastFile(), []).find((x) => x.id === id);
  if (!e) throw new Error("Select an extension first");
  const profile = await configuredProfile();
  const installed = (await installedIds()).has(id.toLowerCase());
  const item = entry("gallery", id);
  const refresh = (note: string) => show(readJson<GalleryExtension[]>(lastFile(), []), note);
  switch (action) {
    case "install":
      await installExtension(id, profileName || profile.name);
      return refresh(`Installed ${e.name} in ${profileName || profile.name}`);
    case "browser":
      await openUrl(itemUrl(id));
      return finish();
    case "preview":
      return previewSheet(id, e.name);
    case "open":
      await openUrl(extensionUri(id));
      return finish();
    case "copy-id":
      return merge(copy(id), status(`Copied ${id}`));
    case "uninstall":
      return confirmUninstall("gallery", id, e.name, profile.name);
    case "uninstall-yes":
      await uninstallExtension(id, profile.name);
      return refresh(`Uninstalled ${e.name} from ${profile.name}`);
    case "menu":
      return popup("actionsButton", [
        item(installed ? `Reinstall in ${profile.name}` : `Install in ${profile.name}`, "install", "↩"),
        {
          text: "Install in Another Profile",
          submenu: profiles().map((p) => menuItem(p.name, ["gallery", "install", id, p.name])),
        },
        separator,
        item("Preview", "preview", "⌘Y"),
        item(`Open in ${shortName()}`, "open"),
        item("Open in Browser", "browser", "⇧⌘O"),
        separator,
        item("Copy Extension ID", "copy-id", "⇧⌘C"),
        ...(installed ? [separator, item("Uninstall Extension…", "uninstall")] : []),
      ]);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
