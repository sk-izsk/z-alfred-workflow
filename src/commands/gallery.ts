import { editor, shortName } from "../editors.ts";
import { extensionUri, installExtension, localExtensions, uninstallExtension } from "../extensions.ts";
import { openUrl } from "../launch.ts";
import {
  type GalleryExtension,
  cachedIcon,
  compact,
  fetchIcons,
  galleryName,
  itemUrl,
  searchGallery,
} from "../marketplace.ts";
import { existsSync } from "node:fs";
import { cacheDir, readJson, writeJson } from "../env.ts";
import { join } from "node:path";
import { type Action, copy, finish, merge, popup, rows, separator, status, update } from "../ui.ts";
import { entry, icon, zedNotice } from "./common.ts";
import { confirmUninstall } from "./extensions.ts";

/** The last results, so row actions (↩, ⌘K) don't search the Marketplace again. */
const lastFile = () => join(cacheDir(), "gallery-last.json");

const installedIds = () => new Set(localExtensions().map((e) => e.id.toLowerCase()));

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

const show = (list: GalleryExtension[], note: string): Action => {
  const installed = installedIds();
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

export const gallerySearch = async ([text = ""]: string[]): Promise<Action> => {
  if (editor().kind === "zed") return zedNotice("The Marketplace");
  if (!text.trim()) return merge(rows("items", []), status(`Type to search ${galleryName()}`));
  const list = await searchGallery(text);
  writeJson(lastFile(), list);
  await fetchIcons(list);
  return merge(
    show(
      list,
      list.length ? `${list.length} results from ${galleryName()}` : `No extensions match “${text}”`,
    ),
    update({ sectionLabel: { text: "Found Extensions" } }),
  );
};

export const gallery = async ([action = "", id = ""]: string[]): Promise<Action> => {
  const e = readJson<GalleryExtension[]>(lastFile(), []).find((x) => x.id === id);
  if (!e) throw new Error("Select an extension first");
  const installed = installedIds().has(id.toLowerCase());
  const item = entry("gallery", id);
  const refresh = (note: string) => show(readJson<GalleryExtension[]>(lastFile(), []), note);
  switch (action) {
    case "install":
      await installExtension(id);
      return refresh(`Installed ${e.name}`);
    case "browser":
      await openUrl(itemUrl(id));
      return finish();
    case "open":
      await openUrl(extensionUri(id));
      return finish();
    case "copy-id":
      return merge(copy(id), status(`Copied ${id}`));
    case "uninstall":
      return confirmUninstall("gallery", id, e.name);
    case "uninstall-yes":
      await uninstallExtension(id);
      return refresh(`Uninstalled ${e.name}`);
    case "menu":
      return popup("actionsButton", [
        item(installed ? "Reinstall Extension" : "Install Extension", "install", "↩"),
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
